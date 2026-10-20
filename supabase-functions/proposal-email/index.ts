import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { render } from './mail.ts';

// Sends proposal emails through the company's own email account (saved under Connected apps).
//   action 'link'   : a signed-in company member emails the customer their proposal link (to read now, sign later)
//   action 'signed' : after the customer signs, emails the full signed copy to them and to the company
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const isEmail = (s: unknown) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function emailConfig(companyId: string) {
  const { data: i } = await admin.from('integrations').select('account_label').eq('company_id', companyId).eq('provider', 'resend').maybeSingle();
  const { data: s } = await admin.from('integration_secrets').select('secret').eq('company_id', companyId).eq('provider', 'resend').maybeSingle();
  if (!s?.secret || !i?.account_label) return null;
  return { key: s.secret as string, from: i.account_label as string };
}

async function send(cfg: { key: string; from: string }, to: string[], subject: string, html: string, bcc: string[] = []) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to, subject, html, ...(bcc.length ? { bcc } : {}) }),
  });
  if (!r.ok) throw new Error('The email service refused the message (' + r.status + ')');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { action, token } = await req.json();
    if (!token || typeof token !== 'string') return reply({ error: 'bad_request' }, 400);
    const { data: p } = await admin.from('proposals').select('*').eq('token', token).maybeSingle();
    if (!p) return reply({ error: 'not_found' }, 404);
    const { data: view } = await admin.rpc('get_proposal', { p_token: token });
    const cfg = await emailConfig(p.company_id);

    if (action === 'link') {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = await admin.auth.getUser(jwt);
      if (!u?.user) return reply({ error: 'not_signed_in' }, 401);
      const { data: prof } = await admin.from('profiles').select('is_developer').eq('user_id', u.user.id).maybeSingle();
      const { data: mem } = await admin.from('memberships').select('role').eq('user_id', u.user.id).eq('company_id', p.company_id).maybeSingle();
      if (!mem && !prof?.is_developer) return reply({ error: 'not_allowed' }, 403);
      if (!isEmail(p.customer_email)) return reply({ error: 'no_customer_email' });
      if (!cfg) return reply({ error: 'email_not_set_up' });
      const { html } = render(view, token, 'link');
      await send(cfg, [p.customer_email], `Your water plan from ${view.company_name}`, html);
      await admin.from('proposals').update({ status: p.status === 'signed' ? 'signed' : 'sent', sent_at: new Date().toISOString(), link_email_sent_at: new Date().toISOString() }).eq('id', p.id);
      return reply({ ok: true });
    }

    if (action === 'signed') {
      if (p.status !== 'signed') return reply({ error: 'not_signed' }, 400);
      if (p.signed_email_sent_at && p.owner_alert_sent_at) return reply({ ok: true, already: true });
      if (!cfg) return reply({ error: 'email_not_set_up' });

      // who counts as the owner: the company's admins who are not platform developers, plus an optional shared inbox
      const { data: admins } = await admin.from('memberships').select('user_id').eq('company_id', p.company_id).eq('role', 'admin');
      const ids = (admins || []).map((a: any) => a.user_id);
      const { data: profs } = ids.length ? await admin.from('profiles').select('email,is_developer').in('user_id', ids) : { data: [] as any[] };
      const { data: co } = await admin.from('companies').select('settings').eq('id', p.company_id).maybeSingle();
      const { data: creator } = await admin.from('profiles').select('email').eq('user_id', p.created_by).maybeSingle();
      let owners = (profs || []).filter((x: any) => !x.is_developer).map((x: any) => x.email);
      if (isEmail(co?.settings?.notifyEmail)) owners.push(co!.settings.notifyEmail);
      if (!owners.filter(isEmail).length) owners = (profs || []).map((x: any) => x.email); // nobody else yet: the developer
      owners = Array.from(new Set(owners.filter(isEmail).map((e: string) => e.toLowerCase())));
      const technician = isEmail(creator?.email) ? [creator!.email as string] : [];

      // The owner's alert goes first, and each message stands alone: if one fails, the other still goes out.
      const problems: string[] = [];
      if (!p.owner_alert_sent_at && owners.length) {
        try {
          const total = Math.round(Number(view.snapshot?.total) || 0).toLocaleString('en-US');
          const { html } = render(view, token, 'signed', { email: p.customer_email, phone: p.customer_phone, technician: view.snapshot?.preparedBy });
          await send(cfg, owners, `Signed: ${view.signed_name || view.customer_name} approved the ${view.snapshot?.option} option ($${total})`, html);
          await admin.from('proposals').update({ owner_alert_sent_at: new Date().toISOString() }).eq('id', p.id);
        } catch (e) { problems.push('owner alert: ' + String((e as Error).message || e)); }
      }
      if (!p.signed_email_sent_at) {
        try {
          if (isEmail(p.customer_email)) {
            const { html } = render(view, token, 'signed');
            await send(cfg, [p.customer_email], `Your signed proposal from ${view.company_name}`, html, technician);
          }
          await admin.from('proposals').update({ signed_email_sent_at: new Date().toISOString() }).eq('id', p.id);
        } catch (e) { problems.push('customer copy: ' + String((e as Error).message || e)); }
      }
      if (problems.length) return reply({ error: 'failed', message: problems.join(' | ') }, 500);
      if (!isEmail(p.customer_email) && !owners.length && !technician.length) return reply({ error: 'no_recipient' });
      return reply({ ok: true });
    }
    return reply({ error: 'bad_action' }, 400);
  } catch (e) {
    return reply({ error: 'failed', message: String((e as Error).message || e) }, 500);
  }
});
