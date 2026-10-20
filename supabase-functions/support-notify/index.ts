import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Emails a support request to whoever is set to receive them (platform settings: support_mode and support_email).
//   support_mode 'platform' : (testing) every request goes to support_email, the developer
//   support_mode 'company'  : (live) a request goes to the owners of the company it came from, plus that company's shared inbox.
//   Bug reports and feature ideas always go to the developer, in either mode, because an owner cannot fix the app.
//   A bug report's screenshot is attached to the email.
// It uses the ticket's own company email account if it has one, otherwise the first company that has one.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const isEmail = (s: unknown) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function emailConfig(companyId: string) {
  const get = async (id: string) => {
    const { data: i } = await admin.from('integrations').select('account_label').eq('company_id', id).eq('provider', 'resend').maybeSingle();
    const { data: s } = await admin.from('integration_secrets').select('secret').eq('company_id', id).eq('provider', 'resend').maybeSingle();
    return s?.secret && i?.account_label ? { key: s.secret as string, from: i.account_label as string } : null;
  };
  const own = await get(companyId);
  if (own) return own;
  const { data: any1 } = await admin.from('integrations').select('company_id').eq('provider', 'resend').limit(1);
  return any1?.[0] ? await get(any1[0].company_id) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { ticket_id } = await req.json();
    if (!Number.isInteger(ticket_id)) return reply({ error: 'bad_request' }, 400);
    const { data: t } = await admin.from('tickets').select('*').eq('id', ticket_id).maybeSingle();
    if (!t) return reply({ error: 'not_found' }, 404);
    if (t.notified_at) return reply({ ok: true, already: true });
    if (Date.now() - new Date(t.created_at).getTime() > 10 * 60 * 1000) return reply({ error: 'too_old' }, 400);
    const cfg = await emailConfig(t.company_id);
    if (!cfg) return reply({ error: 'email_not_set_up' });

    const { data: ps } = await admin.from('platform_settings').select('settings').eq('id', true).maybeSingle();
    const mode = ps?.settings?.support_mode === 'company' ? 'company' : 'platform';
    const platformEmail = isEmail(ps?.settings?.support_email) ? (ps!.settings.support_email as string) : null;
    const isBug = ['Something went wrong (bug)', 'Feature idea'].includes(t.topic);
    let to: string[] = [];
    if (mode === 'company' && !isBug) {
      const { data: admins } = await admin.from('memberships').select('user_id').eq('company_id', t.company_id).eq('role', 'admin');
      const ids = (admins || []).map((a: any) => a.user_id);
      const { data: profs } = ids.length ? await admin.from('profiles').select('email,is_developer').in('user_id', ids) : { data: [] as any[] };
      const { data: co0 } = await admin.from('companies').select('settings').eq('id', t.company_id).maybeSingle();
      to = (profs || []).filter((x: any) => !x.is_developer).map((x: any) => x.email);
      if (isEmail(co0?.settings?.notifyEmail)) to.push(co0!.settings.notifyEmail);
    }
    if (!to.filter(isEmail).length && platformEmail) to = [platformEmail]; // platform mode, or nobody to send to yet
    to = Array.from(new Set(to.filter(isEmail).map((e) => e.toLowerCase())));
    if (!to.length) return reply({ error: 'no_recipient' });

    const { data: co } = await admin.from('companies').select('name').eq('id', t.company_id).maybeSingle();
    const { data: au } = await admin.from('profiles').select('email,display_name').eq('user_id', t.author_id).maybeSingle();
    const who = au?.display_name || au?.email || 'Someone';
    const sm = typeof t.screenshot === 'string' ? /^data:image\/(\w+);base64,([\s\S]+)$/.exec(t.screenshot) : null;
    const shot = sm ? { ext: sm[1] === 'jpeg' ? 'jpg' : sm[1], b64: sm[2] } : null;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0d2550;max-width:560px">
<div style="background:#0b2a5c;color:#fff;padding:16px 20px;font-weight:700">${t.urgent ? 'URGENT support request' : 'New support request'}</div>
<div style="padding:18px 20px;border:1px solid #e1e6ee;border-top:0;line-height:1.55">
<p style="margin:0 0 6px"><b>${esc(who)}</b> at <b>${esc(co?.name || 'a company')}</b></p>
<p style="margin:0 0 6px;color:#556070">Topic: ${esc(t.topic)}</p>
<p style="margin:14px 0;padding:12px;background:#f3f6fb;border-left:3px solid #1f72d6;white-space:pre-wrap">${esc(t.body)}</p>
<p style="margin:0;color:#556070">${au?.email ? 'Reply to this email to answer ' + esc(au.email) + '.' : ''} The request is also in the app under Home, then All support tickets.${shot ? ' The screenshot is attached.' : ''}</p></div></div>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to, subject: `${t.urgent ? 'URGENT: ' : ''}Support: ${who} (${co?.name || ''}) ${t.topic}`, html, ...(isEmail(au?.email) ? { reply_to: au!.email } : {}), ...(shot ? { attachments: [{ filename: 'screenshot.' + shot.ext, content: shot.b64 }] } : {}) }),
    });
    if (!r.ok) return reply({ error: 'failed', message: 'The email service refused the message (' + r.status + ')' }, 500);
    await admin.from('tickets').update({ notified_at: new Date().toISOString() }).eq('id', t.id);
    return reply({ ok: true, sent_to: mode === 'company' && !isBug && to[0] !== platformEmail ? 'company owners' : 'platform support' });
  } catch (e) {
    return reply({ error: 'failed', message: String((e as Error).message || e) }, 500);
  }
});
