import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush } from './webpush.ts';

// Sends phone alerts (web push).
//   type 'test'            : a signed-in person sends themselves a test alert
//   type 'proposal_signed' : the business owners (and the technician who made it) hear that a proposal was signed
//   type 'ticket'          : support requests reach the person who should handle them (same rules as the support email)
// The last two are called by the database itself, with a private secret. Nobody else can trigger them.
const APP = Deno.env.get('APP_URL') || 'https://app.thesoftwaterspecialists.com';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const money = (n: unknown) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

async function deliver(userIds: string[], payload: Record<string, unknown>, cfg: { publicKey: string; privateKey: string; subject: string }, urgent = false) {
  const out = { phones: 0, sent: 0, removed: 0, failed: 0 };
  if (!userIds.length) return out;
  const { data: subs } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id', Array.from(new Set(userIds)));
  out.phones = (subs || []).length;
  await Promise.all((subs || []).map(async (s: any) => {
    try {
      const status = await sendPush(s, payload, cfg, urgent);
      if (status >= 200 && status < 300) out.sent++;
      else if (status === 404 || status === 410) { out.removed++; await admin.from('push_subscriptions').delete().eq('id', s.id); }
      else out.failed++;
    } catch { out.failed++; }
  }));
  return out;
}

async function ownersOf(companyId: string) {
  const { data: m } = await admin.from('memberships').select('user_id').eq('company_id', companyId).eq('role', 'admin');
  const ids = (m || []).map((x: any) => x.user_id);
  const { data: p } = ids.length ? await admin.from('profiles').select('user_id,is_developer').in('user_id', ids) : { data: [] as any[] };
  const owners = (p || []).filter((x: any) => !x.is_developer).map((x: any) => x.user_id as string);
  if (owners.length) return owners;
  return (p || []).map((x: any) => x.user_id as string); // nobody but the developer yet
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { data: c } = await admin.from('push_config').select('*').eq('id', true).maybeSingle();
    if (!c) return reply({ error: 'not_configured' }, 500);
    const cfg = { publicKey: c.public_key as string, privateKey: c.private_key as string, subject: c.subject as string };
    const body = await req.json();

    if (body.type === 'test') {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = await admin.auth.getUser(jwt);
      if (!u?.user) return reply({ error: 'not_signed_in' }, 401);
      const r = await deliver([u.user.id], { title: 'Alerts are on', body: 'This is a test alert. You will get one like this when something needs you.', url: APP + '/', tag: 'test' }, cfg);
      return reply({ ok: true, ...r });
    }

    if (req.headers.get('x-push-secret') !== c.secret) return reply({ error: 'forbidden' }, 403);

    if (body.type === 'proposal_signed') {
      const { data: p } = await admin.from('proposals').select('id,company_id,created_by,signed_name,customer_name,snapshot,status').eq('token', body.token).maybeSingle();
      if (!p || p.status !== 'signed') return reply({ error: 'not_found' }, 404);
      const who = p.signed_name || p.customer_name || 'A customer';
      const r = await deliver([...(await ownersOf(p.company_id)), p.created_by], {
        title: clip(`Signed: ${who} approved the ${p.snapshot?.option || ''} option (${money(p.snapshot?.total)})`, 90),
        body: 'Tap to see the signed proposal.', url: APP + '/#/signedlist', tag: 'signed-' + p.id,
      }, cfg, true);
      return reply({ ok: true, ...r });
    }

    if (body.type === 'ticket') {
      const { data: t } = await admin.from('tickets').select('id,company_id,author_id,topic,body,urgent').eq('id', body.id).maybeSingle();
      if (!t) return reply({ error: 'not_found' }, 404);
      const { data: ps } = await admin.from('platform_settings').select('settings').eq('id', true).maybeSingle();
      const toPlatform = ps?.settings?.support_mode !== 'company' || ['Something went wrong (bug)', 'Feature idea'].includes(t.topic);
      let ids: string[] = [];
      if (toPlatform) {
        const email = ps?.settings?.support_email;
        const { data: byEmail } = email ? await admin.from('profiles').select('user_id').ilike('email', email) : { data: [] as any[] };
        const { data: devs } = await admin.from('profiles').select('user_id').eq('is_developer', true);
        ids = (byEmail && byEmail.length ? byEmail : devs || []).map((x: any) => x.user_id);
      } else ids = await ownersOf(t.company_id);
      const { data: co } = await admin.from('companies').select('name').eq('id', t.company_id).maybeSingle();
      const { data: au } = await admin.from('profiles').select('display_name,email').eq('user_id', t.author_id).maybeSingle();
      const r = await deliver(ids, {
        title: clip(`${t.urgent ? 'URGENT: ' : ''}Support: ${au?.display_name || au?.email || 'Someone'} (${co?.name || ''})`, 90),
        body: clip(String(t.body || '').split('\n')[0], 120), url: APP + '/#/' + (toPlatform ? 'supportall' : 'inbox'), tag: 'ticket-' + t.id,
      }, cfg, !!t.urgent);
      return reply({ ok: true, ...r });
    }
    return reply({ error: 'bad_request' }, 400);
  } catch (e) {
    return reply({ error: 'failed', message: String((e as Error).message || e) }, 500);
  }
});
