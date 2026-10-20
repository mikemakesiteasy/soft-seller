import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Buddy: the in-app assistant. The instructions live here, on the server, never in the phone.
// The company's Anthropic key is saved under Connected apps (provider 'anthropic') and is never sent to a phone.
const MODEL = 'claude-sonnet-5-5';
const DAILY_LIMIT = 60; // questions per person per day
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function keyFor(companyId: string) {
  const get = async (id: string) => (await admin.from('integration_secrets').select('secret').eq('company_id', id).eq('provider', 'anthropic').maybeSingle()).data?.secret as string | undefined;
  const own = await get(companyId);
  if (own) return own;
  const { data: any1 } = await admin.from('integrations').select('company_id').eq('provider', 'anthropic').limit(1);
  return any1?.[0] ? await get(any1[0].company_id) : undefined;
}

const ROLE_LABEL: Record<string, string> = { admin: 'a business owner or admin', tech: 'a technician', plumber: 'a plumbing partner', dealer: 'an authorized dealer', diy: 'a DIY homeowner', franchisor: 'a franchise headquarters admin' };

function systemPrompt(name: string, company: string, roleKey: string, isDev: boolean, ctx: any) {
  const job = ctx?.job;
  return [
    `You are ${name}, the friendly in-app assistant for the field app used by ${company}. Answer in plain text (no markdown, no bullet symbols), short and practical for someone on a phone in a customer's home. 2 to 5 sentences unless asked for steps. If you do not know or it needs a person, say so and suggest tapping "Send this chat to a person". For installation or plumbing judgment calls (code, clearances, piping layouts), give general guidance only and recommend asking the company's master plumber. Never invent prices, warranties or policies. If asked about price, point to the proposal in the app.`,
    `SAFETY: for anything involving gas, electrical work, backflow prevention, or anything you or the user are unsure about, tell them to stop and call a licensed plumber or the company. Always follow the manufacturer manual and local code.`,
    `USER: ${isDev ? 'the platform developer testing the app' : ROLE_LABEL[roleKey] || 'a user'}. Company: ${company}.`,
    job ? `CURRENT JOB: ${job.name || 'unnamed'}${job.id ? ' (' + job.id + ')' : ''}. Water test results: ${job.tests || 'none entered'}. App recommendation: ${job.recommendation || 'none yet'}${job.flags ? '. Flags: ' + job.flags : ''}.` : 'No job is open right now.',
    `APP FEATURES: Today's jobs list. Each job has a worksheet: 01 Customer information (the lead source question, where they FIRST heard of the company, is required; if they say an online search, ask if they had heard of the company before searching), before photo, 02 Water source, 03 Why they are calling, 04 Existing equipment, 05 Water test results (the app gives a live recommendation), 06 Plumbing inspection, 07 Installation space (with a measuring tool that uses a photo and a tape or board of known length), 08 Usage, 09 Customer goals, 10 Technician observations, 14 Approval and signature, 16 after photo. Quick diagnosis is the short version (01 to 07). Present options shows Better, Best and Premium. Continue opens the proposal: the customer can sign on the phone, or the proposal can be emailed so they can read it and sign later from a link. Signed proposals are emailed to the customer and the owner. Job materials builds the parts list from install kits and the owner's rules; add catalog parts or other parts (the office prices those); then send to packing. Plumbing partners get a parts list with their cost and can order wholesale. Everything saves on the phone and syncs when signal returns. Admins: Products and pricing, Kits and rules, Team (invite people), Connected apps, Financing, Signed proposals, Phone alerts, Setup. Help has topics for questions, bugs and ideas; a bug report needs a screenshot and a note. The app is in beta.`,
    `INSTALL HELP: You also coach plumbers and DIY homeowners through diagnosing water and installing softeners, filters and RO, in plain everyday words. For DIY users avoid jargon or explain it in a few words. When giving steps, number them 1, 2, 3 on separate lines, one action per step, short. Typical softener install: 1) Check you have the parts list from the app and enough space. 2) Shut off the main water and the water heater (gas to pilot, electric breaker off). 3) Open a low faucet to drain pressure. 4) Pick the spot: after the pressure tank on wells, after the main shutoff, before the water heater. 5) Install the bypass valve on the softener head. 6) Cut in the inlet and outlet lines (match the flow arrows: inlet from the main, outlet toward the house); use the pipe size and material from the plumbing inspection. 7) Connect the drain line to a floor drain, standpipe or laundry sink with an air gap (never a direct connection). 8) Connect the brine line to the salt tank and add salt. 9) Plug in and set the controller (time, hardness from the test, household size). 10) With the bypass on, turn the water back on slowly and check for leaks. 11) Put the valve in service slowly, purge air at a faucet, then start a manual regeneration. 12) Turn the water heater back on. 13) Retest hardness at a faucet after regeneration (it should read 0 to 1 gpg). 14) Take the after photo in the app. RO under sink: shut off the cold supply, install the feed valve, drill and mount the faucet, put the drain saddle above the P-trap, mount the unit and tank, connect the color-coded tubing, flush per the manufacturer. Some areas require a licensed plumber for this work.`,
    `WATER RULES (from the owner): Hardness over 3 gpg suggests a Z-1 or Z-2 softener (Z-3 if there is also taste or odor). Chlorine over 0.5 ppm suggests Symphony 2, or Z-3. Iron over 0.3 ppm suggests an iron filter; Z-3 if 1 ppm or less; a specialist above 1 ppm (custom sizing above 2 ppm). TDS over 500 suggests RO for drinking water, or Symphony 2 with a softener. pH under 7.0 or over 8.5 suggests an acid neutralizer or pH adjuster. Nitrates over 10 ppm suggests RO and a specialist. Well water suggests a sediment prefilter. A customer who wants RO suggests the ZFPRO under-sink system. Flow over 15 gpm or any health concern means a specialist. The Z-1 versus Z-2 sizing is not final; say it uses a placeholder household-size rule.`,
  ].join('\n\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return reply({ error: 'not_signed_in' }, 401);
    const uid = u.user.id;

    const { data: prof } = await admin.from('profiles').select('active_company_id,is_developer').eq('user_id', uid).maybeSingle();
    const companyId = prof?.active_company_id as string | undefined;
    if (!companyId) return reply({ error: 'no_company' }, 403);
    const { data: mem } = await admin.from('memberships').select('role').eq('user_id', uid).eq('company_id', companyId).maybeSingle();
    if (!mem && !prof?.is_developer) return reply({ error: 'not_allowed' }, 403);

    const key = await keyFor(companyId);
    if (!key) return reply({ error: 'not_set_up' });

    const { data: co } = await admin.from('companies').select('name,settings').eq('id', companyId).maybeSingle();
    const name = String(co?.settings?.assistantName || 'Buddy').slice(0, 30);

    const { messages, context } = await req.json();
    const clean = (Array.isArray(messages) ? messages : []).slice(-16)
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m: any) => ({ role: m.role as string, content: String(m.content).slice(0, 1500) }));
    while (clean.length && clean[0].role !== 'user') clean.shift();
    if (!clean.length || clean[clean.length - 1].role !== 'user') return reply({ error: 'bad_request' }, 400);

    // a fair daily limit per person
    const { data: use } = await admin.from('buddy_usage').select('n').eq('user_id', uid).eq('day', new Date().toISOString().slice(0, 10)).maybeSingle();
    if ((use?.n || 0) >= DAILY_LIMIT) return reply({ error: 'limit', limit: DAILY_LIMIT });
    await admin.from('buddy_usage').upsert({ user_id: uid, day: new Date().toISOString().slice(0, 10), n: (use?.n || 0) + 1 }, { onConflict: 'user_id,day' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: systemPrompt(name, co?.name || 'the company', mem?.role || 'admin', !!prof?.is_developer, context), messages: clean }),
    });
    if (r.status === 401 || r.status === 403) return reply({ error: 'key_rejected' });
    if (r.status === 429 || r.status === 529) return reply({ error: 'busy' });
    if (!r.ok) return reply({ error: 'failed', message: 'The assistant service answered ' + r.status }, 502);
    const out = await r.json();
    const text = (out.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
    return reply({ reply: text || 'Sorry, I could not come up with an answer. Please try asking another way.', name });
  } catch (e) {
    return reply({ error: 'failed', message: String((e as Error).message || e) }, 500);
  }
});
