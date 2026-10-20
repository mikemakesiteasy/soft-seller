'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link2, Building2, Palette, Users, Repeat, Bell, Box, Check, Headphones, MessageSquare, Package, Settings, ShoppingBag, Wrench, ChevronLeft, ChevronRight, CircleHelp, House, MapPin, Phone, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATALOG, CAT, JOBS, KITS, MAINS, RULES, RULE_LABELS, LEAD_OPTS, QUICK, REACH_OPTS, SECS, Field, Vals, money, monthly, recommend, suggest, tiers } from '@/lib/data';

type Screen = 'locations' | 'integrations' | 'platform' | 'team' | 'brand' | 'companies' | 'newjob' | 'switch' | 'pending' | 'help' | 'inbox' | 'messages' | 'setup' | 'kits' | 'packing' | 'porders' | 'admin' | 'catalog' | 'ordered' | 'login' | 'jobs' | 'overview' | 'section' | 'present' | 'proposal' | 'materials' | 'done';
type Meta = { id: string; name: string; address: string; city: string; state: string; zip: string; phone: string; reason: string; time: string };
type Brand = { tagline?: string; phone?: string; web?: string; logo?: string; color?: string; dark?: string };
type Plat = { app_name?: string; tagline?: string; logo?: string; color?: string; dark?: string };
type Co = { id: string; name: string; slug: string | null; role: string; brand: Brand; kind?: string; parent_id?: string | null };
type JobData = { meta?: Meta; values: Vals; flow: 'full' | 'quick'; parts: Record<string, number>; other: { desc: string; qty: number }[]; choice?: string; fulfil?: 'Pickup' | 'Delivery'; install?: 'Self-install' | 'SWS install'; ordered?: boolean; deposit?: boolean; sent?: boolean };
type State = { screen: Screen; jobId?: string; sec: number; jobs: Record<string, JobData>; user?: string; role?: 'tech' | 'plumber' | 'admin'; disc?: number; uid?: string; companyId?: string; dev?: boolean; companies?: Co[]; companyName?: string; companyKind?: string; pendingCode?: string; brand?: Brand; tickets?: { id: number; topic: string; to: string; text: string; urgent: boolean; from: string }[]; prefs?: Record<string, string[]>; setup?: string[]; diy?: boolean; kits?: typeof KITS; rules?: typeof RULES; packed?: Record<string, string[]>; packSent?: Record<string, boolean>; prices?: Record<string, { cost: number; msrp: number; name?: string }>; online: boolean };

const KEY = 'sws-app-v1';
// Links we create (invites, password resets) use the public address, never the hosting address.
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
const ADMIN_SUB = ['catalog', 'kits', 'packing', 'porders', 'inbox', 'messages', 'setup', 'team', 'brand', 'platform', 'companies'];
const TAB_SCREENS = ['jobs', 'admin', 'help', 'switch', ...ADMIN_SUB];
const HomeCtx = createContext<(() => void) | null>(null);
const hashOf = (screen: string, jobId?: string, sec?: number) => `#/${screen}${jobId && !['login', 'pending', 'jobs', 'admin', 'help', 'switch', ...ADMIN_SUB].includes(screen) ? '/' + jobId : ''}${screen === 'section' ? '/' + (sec ?? 0) : ''}`;
const parseHash = (h: string): { screen: Screen; jobId?: string; sec?: number } | null => {
  const m = /^#\/([a-z]+)(?:\/([^/]+))?(?:\/(\d+))?$/.exec(h || '');
  if (!m) return null;
  return { screen: m[1] as Screen, jobId: m[2], sec: m[3] ? Number(m[3]) : undefined };
};
const GROUPS = ['Assess', 'Inspect', 'Plan', 'Close'];
const GROUP_OF: Record<string, string> = { s1: 'Assess', sB: 'Assess', s2: 'Assess', s3: 'Assess', s4: 'Assess', s5: 'Assess', s6: 'Inspect', s7: 'Inspect', s8: 'Inspect', s9: 'Plan', s10: 'Plan', s14: 'Close', s16: 'Close' };
const shade = (hex: string, f: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
};
const applyTheme = (color?: string, dark?: string) => {
  const r = document.documentElement.style, a = color || '#1f72d6', d = dark || '#0b2a5c';
  r.setProperty('--accent', a); r.setProperty('--a600', shade(a, 0.9)); r.setProperty('--a700', shade(a, 0.75));
  r.setProperty('--navy9', d); r.setProperty('--navy8', shade(d, 1.22));
};
const DEFAULT_KITS = JSON.parse(JSON.stringify(KITS)) as typeof KITS;
const DEFAULT_RULES = RULES.map((r) => ({ ...r }));
const DEFAULT_CAT = JSON.parse(JSON.stringify(CAT)) as typeof CAT;
const blank = (j: Meta, flow: 'full' | 'quick' = 'full'): JobData => ({
  meta: j, flow, parts: {}, other: [],
  values: { 's1.name': j.name, 's1.address': j.address, 's1.city': j.city, 's1.state': j.state, 's1.zip': j.zip, 's1.phone': j.phone, 's3.happiest': '' },
});

export default function App() {
  const [st, setSt] = useState<State>({ screen: 'login', sec: 0, jobs: {}, online: true });
  const [ready, setReady] = useState(false);
  const remoteSettings = useRef<Record<string, any>>({});
  const loadRef = useRef<(session: any, home?: boolean) => Promise<void>>(async () => {});
  const [loginBrand, setLoginBrand] = useState<(Brand & { name: string }) | null>(null);
  const [plat, setPlat] = useState<Plat>({});
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setSt({ ...JSON.parse(s), online: navigator.onLine }); } catch {}
    try {
      const q = new URLSearchParams(window.location.search);
      const inv = q.get('invite'), co = q.get('co');
      supabase.rpc('platform_brand').then(({ data }) => { if (data) setPlat(data); });
      if (inv) { localStorage.setItem('sws-invite', inv); window.history.replaceState({}, '', window.location.pathname); }
      if (co) supabase.rpc('public_brand', { p_slug: co }).then(({ data }) => { if (data) setLoginBrand({ name: data.name, ...(data.brand || {}) }); });
    } catch {}
    setReady(true);
    const on = () => setSt((s) => ({ ...s, online: navigator.onLine }));
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }, [st, ready]);
  useEffect(() => {
    if (!ready) return;
    const handle = async (session: any, home = false) => {
      if (!session) return;
      const email = session.user.email as string, uid = session.user.id as string;
      let inviteErr = '';
      let inv: string | null = null;
      try { inv = localStorage.getItem('sws-invite'); localStorage.removeItem('sws-invite'); } catch {}
      let pendingCode = '';
      if (inv) {
        const { data: info } = await supabase.rpc('invite_info', { p_code: inv });
        if (info?.new_company) pendingCode = inv;
        else { const { error } = await supabase.rpc('redeem_invite', { p_code: inv }); if (error) inviteErr = error.message; }
      }
      const { data: prof } = await supabase.from('profiles').select('display_name,is_developer,active_company_id').maybeSingle();
      const { data: mem } = await supabase.from('memberships').select('company_id,role');
      const { data: cos } = await supabase.from('companies').select('id,name,slug,kind,parent_id,settings').order('name');
      const roleOf: Record<string, string> = Object.fromEntries((mem || []).map((m: any) => [m.company_id, m.role]));
      const companies: Co[] = (cos || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, role: roleOf[c.id] || 'admin', brand: c.settings?.brand || {}, kind: c.kind, parent_id: c.parent_id }));
      let active: string | undefined = prof?.active_company_id || undefined;
      if (!companies.find((c) => c.id === active)) { active = companies[0]?.id; if (active) await supabase.rpc('set_active_company', { p_company: active }); }
      if (!active) { setSt((x) => ({ ...x, screen: 'pending', user: prof?.display_name || email, uid, companyId: undefined, companies: [], dev: !!prof?.is_developer, inviteErr, pendingCode })); return; }
      const co = companies.find((c) => c.id === active)!;
      const [{ data: rows }, { data: cat }, { data: cfgRow }, { data: tk }, { data: effBrand }] = await Promise.all([
        supabase.from('jobs').select('id,data'),
        supabase.from('catalog_items').select('sku,name,cost,msrp'),
        supabase.from('companies').select('settings').eq('id', active).maybeSingle(),
        supabase.from('tickets').select('id,topic,routed_to,body,urgent,author_id'),
        supabase.rpc('effective_brand', { p_company: active }),
      ]);
      remoteSettings.current = cfgRow?.settings || {};
      const cfg = remoteSettings.current;
      const prices = Object.fromEntries((cat || []).map((c: any) => [c.sku, { cost: Number(c.cost), msrp: Number(c.msrp), name: c.name }]));
      const tickets = (tk || []).map((t: any) => ({ id: t.id, topic: t.topic, to: t.routed_to, text: t.body, urgent: t.urgent, from: t.author_id === uid ? email : 'Team member' }));
      const remote: Record<string, JobData> = Object.fromEntries((rows || []).map((r: any) => [r.id, r.data]));
      const rr = prof?.is_developer ? 'admin' : co.role;
      const role = rr === 'admin' || rr === 'franchisor' ? 'admin' : rr === 'plumber' || rr === 'dealer' ? 'plumber' : 'tech';
      setSt((x) => ({
        ...x, kits: cfg.kits, rules: cfg.rules, disc: cfg.disc, prefs: cfg.prefs, setup: cfg.setup, diy: cfg.diy, brand: effBrand || cfg.brand, companyKind: co.kind, pendingCode: '',
        prices, tickets, companies, companyName: co.name, dev: !!prof?.is_developer, uid, companyId: active, role, user: prof?.display_name || email, inviteErr,
        jobs: x.companyId === active ? { ...x.jobs, ...remote } : remote, jobId: x.companyId === active ? x.jobId : undefined,
        screen: home || x.screen === 'login' || x.screen === 'pending' ? (role === 'admin' ? 'admin' : 'jobs') : x.screen,
      }));
    };
    loadRef.current = handle;
    supabase.auth.getSession().then(({ data }) => handle(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN') handle(session); });
    return () => sub.subscription.unsubscribe();
  }, [ready]);
  useEffect(() => {
    if (!st.uid || !st.companyId) return;
    const t = setTimeout(() => {
      const rows = Object.entries(st.jobs).map(([id, d]) => ({ id, company_id: st.companyId!, owner_id: st.uid!, data: d, ordered: !!d.ordered, updated_at: new Date().toISOString() }));
      if (rows.length) supabase.from('jobs').upsert(rows, { onConflict: 'company_id,id' }).then(({ error }) => { if (error) console.warn('sync failed, will retry on next change', error.message); });
    }, 1000);
    return () => clearTimeout(t);
  }, [st.jobs, st.uid, st.companyId]);
  useEffect(() => {
    if (!st.uid || !st.companyId || st.role !== 'admin') return;
    const t = setTimeout(() => {
      const rows = Object.entries(st.prices || {}).map(([sku, pr]) => ({ company_id: st.companyId!, sku, name: CAT[sku]?.name || sku, cost: pr.cost, msrp: pr.msrp }));
      if (rows.length) supabase.from('catalog_items').upsert(rows, { onConflict: 'company_id,sku' }).then(({ error }) => { if (error) console.warn('catalog sync failed', error.message); });
      const next = { ...remoteSettings.current, ...Object.fromEntries(Object.entries({ kits: st.kits, rules: st.rules, disc: st.disc, prefs: st.prefs, setup: st.setup, diy: st.diy }).filter(([, v]) => v !== undefined)) };
      if (JSON.stringify(next) !== JSON.stringify(remoteSettings.current)) {
        remoteSettings.current = next;
        supabase.from('companies').update({ settings: next }).eq('id', st.companyId!).then(({ error }) => { if (error) console.warn('settings sync failed', error.message); });
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [st.prices, st.kits, st.rules, st.disc, st.prefs, st.setup, st.diy, st.uid, st.companyId, st.role]);
  const stRef = useRef(st);
  stRef.current = st;
  useEffect(() => {
    if (!ready) return;
    const h = hashOf(st.screen, st.jobId, st.sec);
    if (window.location.hash !== h) { try { window.history.pushState(null, '', h); } catch {} }
  }, [ready, st.screen, st.jobId, st.sec]);
  useEffect(() => {
    const onPop = () => {
      const t = parseHash(window.location.hash), cur = stRef.current;
      if (!t) return;
      const signedIn = !!(cur.uid || cur.role);
      if ((t.screen === 'login' || t.screen === 'pending') && signedIn) { window.history.pushState(null, '', hashOf(cur.screen, cur.jobId, cur.sec)); return; }
      if (!signedIn && t.screen !== 'login') return;
      setSt((x) => ({ ...x, screen: t.screen, jobId: t.jobId ?? x.jobId, sec: t.sec ?? x.sec }));
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const b = st.uid ? st.brand : loginBrand || plat;
    applyTheme((b as any)?.color || (st.uid ? undefined : plat.color), (b as any)?.dark || (st.uid ? undefined : plat.dark));
  }, [st.uid, st.brand, loginBrand, plat]);
  useEffect(() => { document.title = (st.uid ? st.companyName : loginBrand?.name) || plat.app_name || 'Soft Sell'; }, [st.uid, st.companyName, loginBrand, plat]);
  if (!ready) return null;
  const signOut = async () => { await supabase.auth.signOut(); setSt((x) => ({ ...x, screen: 'login', user: undefined, role: undefined, uid: undefined, companyId: undefined, jobs: {}, dev: false, companies: undefined, companyName: undefined, brand: undefined, prices: undefined, kits: undefined, rules: undefined, disc: undefined, prefs: undefined, setup: undefined, diy: undefined, tickets: undefined, jobId: undefined })); };
  const switchCompany = async (id: string) => { const { error } = await supabase.rpc('set_active_company', { p_company: id }); if (error) { alert(error.message); return; } const { data } = await supabase.auth.getSession(); await loadRef.current(data.session, true); };
  const coName = st.companyName || 'Soft Water Specialists';
  Object.keys(CAT).forEach((k) => { if (!DEFAULT_CAT[k]) delete CAT[k]; else Object.assign(CAT[k], DEFAULT_CAT[k]); });
  Object.entries(st.prices || {}).forEach(([k, p]) => { if (CAT[k]) Object.assign(CAT[k], { cost: p.cost, msrp: p.msrp }); else CAT[k] = { sku: k, name: p.name || k, cost: p.cost, msrp: p.msrp }; });
  Object.keys(KITS).forEach((k) => delete KITS[k]); Object.assign(KITS, JSON.parse(JSON.stringify(st.kits || DEFAULT_KITS)));
  RULES.splice(0, RULES.length, ...(st.rules || DEFAULT_RULES));
  const disc = st.disc ?? 40;
  const isPartner = st.role === 'plumber';

  const home = () => go(st.role === 'admin' ? 'admin' : 'jobs');
  const showTabs = TAB_SCREENS.includes(st.screen);
  const go = (screen: Screen, extra: Partial<State> = {}) => { setSt((s) => ({ ...s, screen, ...extra })); window.scrollTo(0, 0); };
  const metaOf = (id: string): Meta | undefined => st.jobs[id]?.meta || JOBS.find((j) => j.id === id);
  const ownJobs = Object.entries(st.jobs).map(([id, d]) => d.meta || JOBS.find((j) => j.id === id)).filter((m): m is Meta => !!m);
  const jobList: Meta[] = st.uid ? ownJobs : [...JOBS, ...ownJobs.filter((m) => !JOBS.some((j) => j.id === m.id))];
  const job = st.jobId ? metaOf(st.jobId) : undefined;
  const jd = job ? st.jobs[job.id] || blank(job) : undefined;
  const patch = (p: Partial<JobData>) => job && jd && setSt((s) => ({ ...s, jobs: { ...s.jobs, [job.id]: { ...jd, ...p } } }));
  const setVal = (k: string, val: any) => jd && patch({ values: { ...jd.values, [k]: val } });
  const flowSecs = jd ? (jd.flow === 'quick' ? SECS.filter((s) => QUICK.includes(s.id)) : SECS) : SECS;

  return (
    <HomeCtx.Provider value={home}>
    <div className={'shell ' + (showTabs ? 'withtabs' : '')}>
      {!st.online && <div className="offline">Offline. Your work is saved on this device and will sync when signal returns.</div>}
      {st.screen === 'login' && <Login brand={loginBrand} plat={plat} onAuth={async (email, pw, mode) => { const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password: pw }) : await supabase.auth.signUp({ email, password: pw }); return r.error?.message || (mode === 'up' && !r.data.session ? 'Check your email to confirm your account, then sign in.' : ''); }} onLogin={(u, role) => go(role === 'admin' ? 'admin' : 'jobs', { user: u, role })} />}
      {st.screen === 'jobs' && (() => {
        const now = new Date(), first = (st.user || 'there').split(' ')[0];
        const week = Array.from({ length: 7 }, (_, k) => { const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + k); return d; });
        const hour = now.getHours(), hi = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        return (
          <main>
            <header className="dark">
              <div className="hbar"><span /><span className="hright"><span className="bell"><Bell size={22} /></span><span className="avatar">{(st.user || 'T').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span></span></div>
              <div className="hero">
                <div className="greet">{hi}, {first}</div>
                <h1 className="big">Today</h1>
                <div className="sub">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {jobList.length} evaluations</div>
              </div>
              <div className="week">
                {week.map((d) => <div key={d.getDate()} className={d.toDateString() === now.toDateString() ? 'on' : ''}><span>{d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span><b>{d.getDate()}</b></div>)}
              </div>
            </header>
            <div className="body jobsbody">
              <button className="btn ghost" onClick={() => go('newjob')}>New job</button>
              {!jobList.length && (
                <div className="card"><b>No jobs yet.</b><div className="muted">Add your first job to start an evaluation.</div>
                  {st.dev && <button className="btn ghost" onClick={() => setSt((x) => ({ ...x, jobs: { ...x.jobs, ...Object.fromEntries(JOBS.map((j) => [j.id, blank(j)])) } }))}>Add sample jobs</button>}</div>
              )}
              {jobList.map((j) => {
                const d = st.jobs[j.id];
                const done = d ? pct(d, SECS) : 0;
                const [t, ap] = (j.time || '').split(' ');
                return (
                  <button key={j.id} className="jobcard" onClick={() => go('overview', { jobId: j.id, jobs: { ...st.jobs, [j.id]: d || blank(j, isPartner ? 'quick' : 'full') } })}>
                    <div className="time"><b>{t}</b><span>{ap}</span></div>
                    <div className="grow"><b className="nm">{j.name}</b><div className="addr">{j.address}, {j.city}</div><div className="why">{j.reason}</div>
                      <div className="tags">{d && <span className="tag">{done === 100 ? 'Complete' : 'In progress'}</span>}<span className="jid">{j.id}</span></div></div>
                    <ChevronRight size={20} />
                  </button>
                );
              })}
            </div>
          </main>
        );
      })()}
      {st.screen === 'overview' && job && jd && (() => {
        const doneN = flowSecs.filter((x) => secDone(jd.values, x.id)).length, pc = Math.round((doneN / flowSecs.length) * 100);
        const nextI = Math.max(0, flowSecs.findIndex((x) => !secDone(jd.values, x.id)));
        return (
          <Page title={job.name} kicker="Water system evaluation" sub={`${job.address}, ${job.city}`} back={() => go('jobs')} backLabel="Jobs" right={<span>{job.id}</span>} light>
            <div className="btnrow">
              <a className="btn ghost sm" href={`tel:${job.phone}`}><Phone size={16} />Call</a>
              <a className="btn ghost sm" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(job.address + ', ' + job.city)}`}><MapPin size={16} />Directions</a>
            </div>
            <div className="seg">
              {(['full', 'quick'] as const).map((f) => (
                <button key={f} className={jd.flow === f ? 'on' : ''} onClick={() => patch({ flow: f })}>{f === 'full' ? 'Full evaluation' : 'Quick diagnosis'}</button>
              ))}
            </div>
            <div className="between prog"><span>{doneN} of {flowSecs.length} sections complete</span><span>{pc}%</span></div>
            <div className="bar"><i style={{ width: pc + '%' }} /></div>
            {GROUPS.map((g) => {
              const items = flowSecs.map((x, i) => ({ x, i })).filter(({ x }) => GROUP_OF[x.id] === g);
              if (!items.length) return null;
              return (
                <div key={g} className="group"><h3>{g}</h3>
                  {items.map(({ x, i }) => {
                    const c = secDone(jd.values, x.id);
                    return (
                      <button key={x.id} className="row" onClick={() => go('section', { sec: i })}>
                        <span className={'num ' + (c ? 'ok' : '')}>{x.n}</span><span className="grow">{x.title}</span>
                        {c && <span className="donetag"><Check size={16} />Done</span>}<ChevronRight size={18} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div className="actions">
              <button className="btn" onClick={() => go('section', { sec: nextI })}>Continue: {flowSecs[nextI].n} {flowSecs[nextI].title}</button>
              <div className="btnrow"><button className="btn ghost" onClick={() => go('present')}>Present options</button><button className="btn ghost" onClick={() => go('materials')}>Job materials</button></div>
            </div>
          </Page>
        );
      })()}
      {st.screen === 'section' && job && jd && (() => {
        const idx = Math.min(st.sec, flowSecs.length - 1), s2 = flowSecs[idx];
        const last = idx >= flowSecs.length - 1;
        const blocked = s2.id === 'sB' && !jd.values['sB.bp'] && !jd.values['sB.bpLater'];
        const nx = flowSecs[idx + 1];
        return (
          <Page title={<><span className="hnum">{s2.n}</span> {s2.title}</>} kicker={`${GROUP_OF[s2.id]} · ${idx + 1} of ${flowSecs.length}`} segs={{ n: flowSecs.length, i: idx }} back={() => go('overview')} backLabel="Sections" right={<span>{job.name}</span>}>
            {s2.fields.filter((f) => !f.show || f.show(jd.values)).map((f) => (
              <FieldView key={f.id} sid={s2.id} f={f} v={jd.values} set={setVal} />
            ))}
            {blocked && <div className="err">A before photo is required to continue. Take one, or check “taken on phone camera”.</div>}
            <div className="actions row2">
              {idx > 0 && <button className="btn ghost sq" aria-label="Previous" onClick={() => go('section', { sec: idx - 1 })}><ChevronLeft size={20} /></button>}
              <button className="btn" disabled={blocked} onClick={() => (last ? go('overview') : go('section', { sec: idx + 1 }))}>{last ? 'Finish' : `Next: ${nx.n} ${nx.title}`}</button>
            </div>
          </Page>
        );
      })()}
      {st.screen === 'present' && job && jd && (() => {
        const ts = tiers(jd.values), pick = jd.choice || 'Best';
        const none = !Object.keys(recommend(jd.values).out).length;
        return (
          <Page title="Your water plan" kicker={`Prepared for ${job.name} by ${coName}`} back={() => go('overview')} backLabel="Technician view">
            {none && <div className="err">Enter water test results first so a recommendation can be built.</div>}
            {ts.map((t) => (
              <button key={t.name} className={'card tier ' + (pick === t.name ? 'best' : '')} onClick={() => patch({ choice: t.name })}>
                <div className="tierhead"><i className={'radio ' + (pick === t.name ? 'on' : '')} /><h3>{t.name}</h3>{t.name === 'Best' && <span className="tag">Recommended</span>}</div>
                <div className="muted">{t.sub}</div>
                <ul>{t.skus.map((x) => <li key={x}>{CAT[x].name}</li>)}<li>Installation materials</li></ul>
                <div className="between"><span className="muted">Investment</span><b>{money(t.total)}</b></div>
                <div className="between"><span className="muted">Or financed</span><b>{money(monthly(t.total))}/mo</b></div>
              </button>
            ))}
            <div className="muted">Monthly payments are placeholders (7.99% APR, 60 months).</div>
            <div className="actions">
              <button className="btn ghost">Check financing · no credit impact</button>
              <button className="btn" onClick={() => go('proposal')}>Continue with {pick}</button>
            </div>
          </Page>
        );
      })()}
      {st.screen === 'proposal' && job && jd && (() => {
        const t = tiers(jd.values).find((x) => x.name === jd.choice) || tiers(jd.values)[1];
        const dep = Math.round(t.total * 0.1);
        return (
          <Page title={`${t.name} option`} kicker={`Proposal · ${job.name}`} sub={t.sub} back={() => go('present')} backLabel="Options">
            <div className="plist">
              {t.skus.map((x) => <div key={x}>{CAT[x].name}</div>)}<div>Installation materials</div>
              <div className="between"><span>Investment</span><b>{money(t.total)}</b></div>
              <div className="between"><span>Or financed</span><b>{money(monthly(t.total))}/mo</b></div>
              <div className="between"><span>Deposit (10%, placeholder)</span><b>{money(dep)}</b></div>
            </div>
            <FieldView sid="s14" f={SECS.find((s) => s.id === 's14')!.fields[0]} v={jd.values} set={setVal} />
            <FieldView sid="s14" f={SECS.find((s) => s.id === 's14')!.fields[1]} v={jd.values} set={setVal} />
            <label className="check"><input type="checkbox" checked={!!jd.deposit} onChange={(e) => patch({ deposit: e.target.checked })} />Card deposit collected (payment provider not connected yet)</label>
            <div className="actions">
              <button className="btn ghost" onClick={() => patch({ sent: true })}>{jd.sent ? 'Proposal sent ✓' : 'Text / email proposal'}</button>
              <button className="btn" disabled={!jd.values['s14.sig']} onClick={() => go('materials')}>Approve & continue</button>
            </div>
          </Page>
        );
      })()}
      {st.screen === 'materials' && job && jd && (() => {
        const sug = suggest(jd.values);
        const items = [
          ...sug.map((i) => ({ ...i, qty: jd.parts[i.sku] ?? i.qty })),
          ...Object.keys(jd.parts).filter((k) => CAT[k] && !sug.find((s) => s.sku === k) && jd.parts[k] > 0).map((k) => ({ key: k, sku: k, name: CAT[k].name, qty: jd.parts[k], main: false, why: 'Added by tech' })),
        ];
        const extra = Object.keys(CAT).filter((k) => !items.find((i) => i.sku === k));
        const setQty = (sku: string, q: number) => patch({ parts: { ...jd.parts, [sku]: Math.max(0, q) } });
        return (
          <Page title="Job materials" kicker={job.name} sub="Built from the recommended system, its install kit and your worksheet answers. Adjust anything." back={() => go('overview')} backLabel="Sections">
            {!items.length && <div className="muted">No parts yet. Enter water test results and plumbing details.</div>}
            {items.map((i) => (
              <div key={i.sku} className="row static">
                <div className="grow"><b>{i.name}</b><div className="muted">{i.sku} · {i.why}</div></div>
                <div className="qty"><button onClick={() => setQty(i.sku, i.qty - 1)}>−</button><span>{i.qty}</span><button onClick={() => setQty(i.sku, i.qty + 1)}>+</button></div>
              </div>
            ))}
            {jd.other.map((o, n) => (
              <div key={n} className="row static"><div className="grow"><b>{o.desc}</b><div className="muted">Other · office will price</div></div><span>×{o.qty}</span></div>
            ))}
            <AddOther onAdd={(desc) => patch({ other: [...jd.other, { desc, qty: 1 }] })} />
            <label className="lbl">Add catalog part</label>
            <select className="in" value="" onChange={(e) => e.target.value && setQty(e.target.value, (jd.parts[e.target.value] ?? 0) + 1)}>
              <option value="">Choose a part…</option>
              {extra.map((k) => <option key={k} value={k}>{CAT[k].name}</option>)}
            </select>
            {isPartner && (() => {
              const msrp = items.reduce((t, i) => t + CAT[i.sku].msrp * i.qty, 0);
              const cost = msrp * (1 - disc / 100);
              return (
                <>
                  <div className="card"><div className="between"><span>MSRP</span><span>{money(msrp)}</span></div>
                    <div className="between"><b>Your cost ({disc}% off)</b><b>{money(cost)}</b></div></div>
                  <label className="lbl">Fulfillment</label>
                  <div className="pills">{(['Pickup', 'Delivery'] as const).map((o) => <button key={o} className={jd.fulfil === o ? 'on' : ''} onClick={() => patch({ fulfil: o })}>{o}</button>)}</div>
                  <label className="lbl">Installation</label>
                  <div className="pills">{(['Self-install', 'SWS install'] as const).map((o) => <button key={o} className={jd.install === o ? 'on' : ''} onClick={() => patch({ install: o })}>{o}</button>)}</div>
                  <div className="muted">SWS sees technical details only, not the homeowner's personal info.</div>
                  <div className="actions"><button className="btn" disabled={!items.length || !jd.fulfil || !jd.install} onClick={() => { patch({ ordered: true }); go('ordered'); }}>Place wholesale order</button></div>
                </>
              );
            })()}
            {!isPartner && <div className="actions"><button className="btn" onClick={() => go('done')}>Send to packing</button></div>}
          </Page>
        );
      })()}
      {st.screen === 'done' && job && jd && (() => {
        const v = jd.values;
        const r = recommend(v);
        const need = !v['s16.ap'] && !v['s16.apLater'];
        const qa = [`${job.name} · ${job.address}, ${job.city}`, `Lead source: ${v['s1.first'] || 'not recorded'}`,
          `Recommended: ${Object.keys(r.out).map((s) => CAT[s]?.name).join('; ') || 'n/a'}`, jd.choice ? `Approved: ${jd.choice} option` : ''].filter(Boolean).join('\n');
        return (
          <Page title="Evaluation complete" kicker={`${job.name} · ${job.id}`} sub="After photo and QA summary" back={() => go('overview')} backLabel="Sections">
            <FieldView sid="s16" f={SECS.find((s) => s.id === 's16')!.fields[0]} v={v} set={setVal} />
            {need && <div className="err">After photo is required to complete the job.</div>}
            <label className="lbl">QA summary</label>
            <pre className="qa">{qa}</pre>
            <div className="actions"><button className="btn" disabled={need} onClick={() => go('jobs')}>Complete job</button></div>
          </Page>
        );
      })()}
      {st.screen === 'ordered' && job && jd && (
        <Page title="Order placed" sub={`${job.id} · ${jd.fulfil} · ${jd.install}`}>
          <div className="card"><b>Thanks. SWS has your order.</b><div className="muted">Status: Queued. You can message the SWS office from Help once messaging is connected.</div></div>
          <div className="actions"><button className="btn" onClick={() => go('jobs')}>Back to jobs</button></div>
        </Page>
      )}
      {st.screen === 'admin' && (
        <main>
          <div className="lighthero adminhero">
            <div className="kicker">{coName} · {st.dev ? 'Developer' : 'Admin'}</div>
            <h1>Home</h1>
            {(st.companies || []).length > 1 && <div className="muted" style={{ marginTop: 14 }}>Your companies</div>}
            {(st.companies || []).length > 1 && (
              <div className="btnrow cos">
                {(st.companies || []).slice(0, 6).map((c) => (
                  <button key={c.id} className={'co ' + (c.id === st.companyId ? 'on' : '')} onClick={() => c.id !== st.companyId && switchCompany(c.id)}><b>{c.name}</b><span>{c.slug ? c.slug : 'Company'}</span></button>
                ))}
              </div>
            )}
          </div>
          <div className="body tiles">
            {([
              ['Partner orders', `${Object.values(st.jobs).filter((j) => j.ordered).length} open`, 'porders', ShoppingBag],
              ['Support inbox', `${(st.tickets || []).length} open`, 'inbox', Headphones],
              ['Packing lists', `${Object.values(st.jobs).filter((j) => jobItems(j).length).length} jobs`, 'packing', Package],
              ['Products & pricing', `${Object.keys(CAT).length} products`, 'catalog', Box],
              ['Kits & rules', `${RULES.length} rules`, 'kits', Wrench],
              ['Messages', 'Push · Text · Email', 'messages', MessageSquare],
              ['Team', 'Employees, dealers, companies', 'team', Users],
              ...((st.companyKind === 'franchisor') ? [['Locations', 'Your franchise locations', 'locations', Building2]] : []),
              ['Connected apps', 'Housecall Pro, Angi, leads', 'integrations', Link2],
              ['Setup', `${(st.setup || []).length}/${SETUP.length} done`, 'setup', Settings],
              ...(st.dev ? [['Platform brand', 'App name, logo, colors', 'platform', Palette], ['Company brand', 'Name, logo, colors, contact', 'brand', Palette]] : []),
              ...(st.dev ? [['All companies', `${(st.companies || []).length} on the platform`, 'companies', Building2]] : []),
            ] as [string, string, Screen, any][]).map(([t, sub, to, Ic]) => (
              <button key={t} className="tile" onClick={() => go(to)}><span className="ico"><Ic size={22} /></span><b>{t}</b><span className="muted">{sub}</span></button>
            ))}
            <div className="tile static"><b>Plumbing partner discount</b>
              <label className="lbl">% off MSRP</label>
              <input className="in" inputMode="numeric" value={disc} onChange={(e) => setSt((x) => ({ ...x, disc: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))} />
            </div>
          </div>
        </main>
      )}
      {st.screen === 'catalog' && (
        <Page title="Products and pricing" sub="Changes apply to proposals and partner orders" back={() => go('admin')}>
          <AddProduct onAdd={(sku, name, cost, msrp) => setSt((x) => ({ ...x, prices: { ...x.prices, [sku]: { cost, msrp, name } } }))} />
          {Object.values(CAT).map((c) => (
            <div key={c.sku} className="card"><b>{c.name}</b><div className="muted">{c.sku}</div>
              <div className="pricegrid">
                {(['cost', 'msrp'] as const).map((f) => (
                  <label key={f} className="lbl">{f === 'cost' ? 'Cost' : 'MSRP'}
                    <input className="in" inputMode="decimal" value={c[f]} onChange={(e) => setSt((x) => ({ ...x, prices: { ...x.prices, [c.sku]: { name: c.name, cost: c.cost, msrp: c.msrp, [f]: parseFloat(e.target.value) || 0 } } }))} /></label>
                ))}
              </div></div>
          ))}
        </Page>
      )}
      {st.screen === 'kits' && (() => {
        const kits = { ...KITS }, setKits = (k: typeof KITS) => setSt((x) => ({ ...x, kits: k }));
        const rules = RULES.slice(), setRules = (r: typeof RULES) => setSt((x) => ({ ...x, rules: r }));
        return (
          <Page title="Kits and rules" sub="Parts added automatically to each job" back={() => go('admin')}>
            {MAINS.map((m) => (
              <div key={m} className="card"><b>{CAT[m].name}</b>
                {(kits[m] || []).map(([p, n], i) => (
                  <div key={p} className="between"><span>{CAT[p].name}</span>
                    <span className="qty"><button onClick={() => setKits({ ...kits, [m]: (kits[m] as any[]).map((e, j) => (j === i ? [p, Math.max(0, n - 1)] : e)).filter((e: any) => e[1] > 0) as any })}>−</button><span>{n}</span><button onClick={() => setKits({ ...kits, [m]: kits[m].map((e, j) => (j === i ? [p, n + 1] : e)) as any })}>+</button></span></div>
                ))}
                <select className="in" value="" onChange={(e) => e.target.value && !(kits[m] || []).some((k) => k[0] === e.target.value) && setKits({ ...kits, [m]: [...(kits[m] || []), [e.target.value, 1]] })}>
                  <option value="">Add part to kit…</option>{Object.keys(CAT).filter((k) => !MAINS.includes(k)).map((k) => <option key={k} value={k}>{CAT[k].name}</option>)}
                </select></div>
            ))}
            <h3>Rules</h3>
            {rules.map((r, i) => (
              <div key={i} className="row static"><div className="grow">If {RULE_LABELS[r.q]} = {r.a}<div className="muted">add {r.n} × {CAT[r.p].name}</div></div>
                <button className="link" onClick={() => setRules(rules.filter((_, j) => j !== i))}>Delete</button></div>
            ))}
            <AddRule onAdd={(r) => setRules([...rules, r])} />
          </Page>
        );
      })()}
      {st.screen === 'packing' && (
        <Page title="Packing lists" sub="Jobs with materials" back={() => go('admin')}>
          {Object.entries(st.jobs).map(([id, d]) => ({ id, d, items: jobItems(d) })).filter((x) => x.items.length).map(({ id, d, items }) => {
            const j = metaOf(id) || ({ name: id } as Meta), done = st.packed?.[id] || [];
            const tog = (k: string) => setSt((x) => ({ ...x, packed: { ...x.packed, [id]: done.includes(k) ? done.filter((q) => q !== k) : [...done, k] } }));
            return (
              <div key={id} className="card"><div className="between"><b>{j.name}</b><span className={'chip ' + (done.length === items.length ? 'ok' : '')}>{done.length}/{items.length}</span></div>
                {items.map((i) => <label key={i.key} className="check"><input type="checkbox" checked={done.includes(i.key)} onChange={() => tog(i.key)} />{i.qty} × {i.name}</label>)}
                <button className="btn ghost" onClick={() => setSt((x) => ({ ...x, packSent: { ...x.packSent, [id]: true } }))}>{st.packSent?.[id] ? 'Sent to packer ✓' : 'Send to packer (email/text)'}</button></div>
            );
          })}
          {!Object.values(st.jobs).some((d) => jobItems(d).length) && <div className="muted">No jobs with materials yet.</div>}
        </Page>
      )}
      {st.screen === 'porders' && (
        <Page title="Partner orders" sub="Technical details only. No homeowner info." back={() => go('admin')}>
          {Object.entries(st.jobs).filter(([, d]) => d.ordered).map(([id, d]) => {
            const v = d.values, items = jobItems(d), t = ['hard', 'iron', 'cl', 'tds', 'ph'].filter((k) => v['s5.' + k]).map((k) => `${k} ${v['s5.' + k]}`).join(', ');
            return (
              <div key={id} className="card"><b>Order {id}</b><div className="muted">{d.fulfil} · {d.install}</div>
                <div>Water test: {t || 'n/a'}</div><div>Plumbing: main {v['s6.main'] || '?'}, {(v['s6.pipe'] || []).join('/') || 'pipe ?'}</div>
                <ul>{items.map((i) => <li key={i.key}>{i.qty} × {i.name}</li>)}</ul></div>
            );
          })}
          {!Object.values(st.jobs).some((d) => d.ordered) && <div className="muted">No partner orders yet.</div>}
        </Page>
      )}
      {st.screen === 'help' && <HelpScreen role={st.role} user={st.user || ''} back={() => go('jobs')} onSend={(t) => { if (st.uid && st.companyId) supabase.from('tickets').insert({ company_id: st.companyId, author_id: st.uid, topic: t.topic, routed_to: t.to, body: t.text, urgent: t.urgent }).then(({ error }) => { if (error) console.warn('ticket sync failed', error.message); }); setSt((x) => ({ ...x, tickets: [...(x.tickets || []), { ...t, id: (x.tickets || []).length + 1, from: x.user || '' }] })); }} />}
      {st.screen === 'inbox' && (
        <Page title="Support inbox" sub="Routed by topic" back={() => go('admin')}>
          {(st.tickets || []).map((t) => <div key={t.id} className="card"><div className="between"><b>#{t.id} {t.topic}</b>{t.urgent && <span className="chip" style={{ background: '#fde8e8', color: '#b42318' }}>Urgent</span>}</div><div className="muted">{t.from} → {t.to}</div><div>{t.text}</div></div>)}
          {!(st.tickets || []).length && <div className="muted">No tickets.</div>}
        </Page>
      )}
      {st.screen === 'messages' && (
        <Page title="Messages" sub="Choose how each event is delivered. Messages are queued first, then sent with retry." back={() => go('admin')}>
          {EVENTS.map((e) => {
            const on = (st.prefs || {})[e] ?? ['Push', 'Email'];
            return (
              <div key={e} className="card"><b>{e}</b>
                <div className="pills">{['Push', 'Text', 'Email'].map((c) => <button key={c} className={on.includes(c) ? 'on' : ''} onClick={() => setSt((x) => ({ ...x, prefs: { ...x.prefs, [e]: on.includes(c) ? on.filter((q) => q !== c) : [...on, c] } }))}>{c}</button>)}</div></div>
            );
          })}
          <div className="muted">Texting needs A2P 10DLC registration and the Engage account. Quiet hours 9 pm to 8 am (placeholder).</div>
        </Page>
      )}
      {st.screen === 'setup' && (
        <Page title="Setup" sub="First-login checklist" back={() => go('admin')}>
          {SETUP.map((x) => { const d = (st.setup || []).includes(x); return (
            <button key={x} className="row" onClick={() => setSt((s) => ({ ...s, setup: d ? (s.setup || []).filter((q) => q !== x) : [...(s.setup || []), x] }))}><span className="grow"><b>{x}</b></span><span className={'chip ' + (d ? 'ok' : '')}>{d ? 'Done' : 'To do'}</span></button>); })}
          <label className="check"><input type="checkbox" checked={!!st.diy} onChange={(e) => setSt((x) => ({ ...x, diy: e.target.checked }))} />Allow DIY homeowners (off by default)</label>
        </Page>
      )}
      {st.screen === 'switch' && (
        <Page root title="Switch" kicker={st.dev ? 'Developer' : 'Your companies'} sub={st.dev ? 'Change company, or see the app the way each role does.' : 'Change which company you are working in.'}>
          {(st.companies || []).length > 1 && <h3>Company</h3>}
          {(st.companies || []).length > 1 && (
            <div className="group" style={{ margin: '0 -20px' }}>
              {(st.companies || []).map((c) => (
                <button key={c.id} className="row" onClick={() => c.id !== st.companyId && switchCompany(c.id)}><span className="grow">{c.name}</span>{c.id === st.companyId && <span className="donetag"><Check size={16} />Current</span>}<ChevronRight size={18} /></button>
              ))}
            </div>
          )}
          {st.dev && <h3>View as</h3>}
          {st.dev && (
            <div className="group" style={{ margin: '0 -20px' }}>
              {([['Technician', 'tech', 'jobs'], ['Plumbing partner', 'plumber', 'jobs'], ['Admin', 'admin', 'admin']] as [string, 'tech' | 'plumber' | 'admin', Screen][]).map(([l, r, to]) => (
                <button key={l} className="row" onClick={() => go(to, { role: r })}><span className="grow">{l}</span>{st.role === r && <span className="donetag"><Check size={16} />Current</span>}<ChevronRight size={18} /></button>
              ))}
            </div>
          )}
        </Page>
      )}
      {st.screen === 'newjob' && <NewJob back={() => go('jobs')} onCreate={(m) => { setSt((x) => ({ ...x, jobs: { ...x.jobs, [m.id]: blank(m, x.role === 'plumber' ? 'quick' : 'full') }, jobId: m.id, screen: 'overview' })); window.scrollTo(0, 0); }} />}
      {st.screen === 'platform' && st.dev && (
        <PlatformScreen plat={plat} me={st.uid} back={() => go('admin')} onSave={async (p) => { const { error } = await supabase.from('platform_settings').update({ settings: p }).eq('id', true); if (error) return error.message; setPlat(p); return ''; }} />
      )}
      {st.screen === 'team' && st.companyId && <TeamScreen companyId={st.companyId} isDev={!!st.dev} back={() => go('admin')} />}
      {st.screen === 'locations' && st.companyId && <LocationsScreen back={() => go('admin')} />}
      {st.screen === 'integrations' && st.companyId && <IntegrationsScreen back={() => go('admin')} />}
      {st.screen === 'brand' && st.companyId && st.dev && (
        <BrandScreen companyId={st.companyId} name={coName} back={() => go('admin')}
          onSaved={async (name) => { const { data } = await supabase.rpc('effective_brand', { p_company: st.companyId! }); setSt((x) => ({ ...x, companyName: name, brand: data || {}, companies: (x.companies || []).map((c) => (c.id === x.companyId ? { ...c, name } : c)) })); }} />
      )}
      {st.screen === 'companies' && (
        <CompaniesScreen list={st.companies || []} active={st.companyId} back={() => go('admin')} onEnter={switchCompany}
          onCreate={async (name, slug, kind, parent) => { const { error } = await supabase.rpc('create_company', { p_name: name, p_slug: slug, p_kind: kind, p_parent: parent || null }); if (error) return error.message; const { data } = await supabase.auth.getSession(); await loadRef.current(data.session, true); return ''; }} />
      )}
      {st.screen === 'pending' && (
        <PendingScreen user={st.user || ''} err={(st as any).inviteErr} dev={!!st.dev} onSignOut={signOut} startCode={st.pendingCode}
          onRedeem={async (code, name) => { const { error } = await supabase.rpc('redeem_invite', { p_code: code, p_company_name: name || null }); if (error) return error.message; const { data } = await supabase.auth.getSession(); await loadRef.current(data.session, true); return ''; }} />
      )}
      {showTabs && <TabBar screen={st.screen} admin={st.role === 'admin'} canSwitch={!!st.dev || (st.companies || []).length > 1} go={(x) => go(x)} onMe={signOut} />}
      <footer>Powered by<img src="/pdm-logo.png" alt="Performance Digital Marketing" /></footer>
    </div>
    </HomeCtx.Provider>
  );
}

const SETUP = ['Company and brand', 'Assistant name', 'Users', 'Programs', 'Pricing', 'Rules', 'Lead source', 'Financing and deposit', 'Integrations'];
const EVENTS = ['New job assigned', 'Proposal signed', 'Partner order placed', 'Order ready for pickup', 'Support ticket reply'];
const TOPICS: [string, string][] = [['Install, plumbing or water question', 'Matt (master plumber)'], ['Order, billing or account', 'SWS office'], ['App bug or feature idea', 'Platform (Mike)']];

function HelpScreen({ role, user, back, onSend }: { role?: string; user: string; back: () => void; onSend: (t: { topic: string; to: string; text: string; urgent: boolean }) => void }) {
  const [topic, setTopic] = useState(0), [text, setText] = useState(''), [urgent, setUrgent] = useState(false), [sent, setSent] = useState(false);
  return (
    <Page root title="Help and support" sub={`${user}${role ? ' · ' + role : ''}`} back={back}>
      <div className="pills">{TOPICS.map(([t], i) => <button key={t} className={topic === i ? 'on' : ''} onClick={() => setTopic(i)}>{t}</button>)}</div>
      <div className="muted">Goes to: {TOPICS[topic][1]}</div>
      <textarea className="in" rows={4} placeholder="What do you need help with?" value={text} onChange={(e) => setText(e.target.value)} />
      <label className="check"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />Urgent</label>
      <button className="btn" disabled={!text.trim() || sent} onClick={() => { onSend({ topic: TOPICS[topic][0], to: TOPICS[topic][1], text, urgent }); setSent(true); }}>{sent ? 'Sent ✓' : 'Send'}</button>
      <div className="muted">Safety: for gas, electrical or backflow issues, call a licensed plumber or SWS.</div>
    </Page>
  );
}

function jobItems(d: JobData) {
  const sug = suggest(d.values);
  const out = sug.map((i) => ({ ...i, qty: d.parts[i.sku] ?? i.qty }));
  Object.keys(d.parts).filter((k) => CAT[k] && !sug.find((x) => x.sku === k) && d.parts[k] > 0).forEach((k) => out.push({ key: k, sku: k, name: CAT[k].name, qty: d.parts[k], main: false, why: '' }));
  d.other.forEach((o, n) => out.push({ key: 'o' + n, sku: 'other', name: o.desc + ' (other)', qty: o.qty, main: false, why: '' }));
  return out.filter((i) => i.qty > 0);
}

function AddRule({ onAdd }: { onAdd: (r: (typeof RULES)[number]) => void }) {
  const [q, setQ] = useState('s6.main'), [a, setA] = useState(''), [p, setP] = useState('FIT-1');
  return (
    <div className="card"><b>New rule</b>
      <select className="in" value={q} onChange={(e) => setQ(e.target.value)}>{Object.entries(RULE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className="in" placeholder='Answer (e.g. 1", PEX, No)' value={a} onChange={(e) => setA(e.target.value)} />
      <select className="in" value={p} onChange={(e) => setP(e.target.value)}>{Object.keys(CAT).map((k) => <option key={k} value={k}>{CAT[k].name}</option>)}</select>
      <button className="btn ghost" onClick={() => { if (a.trim()) { onAdd({ q, a: a.trim(), p, n: 1 }); setA(''); } }}>Add rule</button></div>
  );
}

function pct(d: JobData, secs: typeof SECS) {
  const ids = (d.flow === 'quick' ? secs.filter((s) => QUICK.includes(s.id)) : secs).map((s) => s.id);
  return Math.round((ids.filter((id) => secDone(d.values, id)).length / ids.length) * 100);
}
function secDone(v: Vals, id: string) {
  return Object.keys(v).some((k) => k.startsWith(id + '.') && v[k] && !(Array.isArray(v[k]) && !v[k].length) && !(id === 's1' && ['s1.name','s1.address','s1.city','s1.state','s1.zip','s1.phone'].includes(k)));
}

function AddProduct({ onAdd }: { onAdd: (sku: string, name: string, cost: number, msrp: number) => void }) {
  const [sku, setSku] = useState(''), [name, setName] = useState(''), [cost, setCost] = useState(''), [msrp, setMsrp] = useState('');
  const ok = sku.trim() && name.trim() && !isNaN(parseFloat(msrp));
  return (
    <div className="card"><b>Add a product</b>
      <input className="in" placeholder="SKU (e.g. Z-4)" value={sku} onChange={(e) => setSku(e.target.value)} />
      <input className="in" placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="pricegrid"><input className="in" inputMode="decimal" placeholder="Cost" value={cost} onChange={(e) => setCost(e.target.value)} /><input className="in" inputMode="decimal" placeholder="MSRP" value={msrp} onChange={(e) => setMsrp(e.target.value)} /></div>
      <button className="btn ghost" disabled={!ok} onClick={() => { onAdd(sku.trim().toUpperCase(), name.trim(), parseFloat(cost) || 0, parseFloat(msrp)); setSku(''); setName(''); setCost(''); setMsrp(''); }}>Add product</button>
    </div>
  );
}

function NewJob({ back, onCreate }: { back: () => void; onCreate: (m: Meta) => void }) {
  const [f, setF] = useState({ name: '', address: '', city: '', state: '', zip: '', phone: '', reason: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Page title="New job" kicker="Water system evaluation" back={back} backLabel="Jobs">
      <div className="field"><label className="lbl">Customer name</label><input className="in" value={f.name} onChange={set('name')} /></div>
      <div className="field"><label className="lbl">Address</label><input className="in" value={f.address} onChange={set('address')} /></div>
      <div className="field"><label className="lbl">City</label><input className="in" value={f.city} onChange={set('city')} /></div>
      <div className="pricegrid"><div className="field"><label className="lbl">State</label><input className="in" value={f.state} onChange={set('state')} /></div><div className="field"><label className="lbl">Zip</label><input className="in" inputMode="numeric" value={f.zip} onChange={set('zip')} /></div></div>
      <div className="field"><label className="lbl">Phone</label><input className="in" inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
      <div className="field"><label className="lbl">Why are they calling?</label><input className="in" value={f.reason} onChange={set('reason')} /></div>
      <div className="actions"><button className="btn" disabled={!f.name.trim()} onClick={() => onCreate({ ...f, id: 'J-' + Date.now().toString(36).toUpperCase(), time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })}>Create job</button></div>
    </Page>
  );
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', tech: 'Technician', plumber: 'Plumbing partner', dealer: 'Authorized dealer', diy: 'DIY homeowner', franchisor: 'Franchise HQ' };

function TeamScreen({ companyId, isDev, back }: { companyId: string; isDev: boolean; back: () => void }) {
  const [members, setMembers] = useState<{ user_id: string; role: string; name: string }[]>([]);
  const [invites, setInvites] = useState<{ code: string; role: string; new_company: boolean }[]>([]);
  const roles: [string, string][] = [['admin', 'Admin / owner'], ['tech', 'Technician (employee)'], ['plumber', 'Plumbing partner'], ['dealer', 'Authorized dealer']].filter(([k]) => !(isDev && (k === 'tech' || k === 'plumber'))) as [string, string][];
  const [role, setRole] = useState(roles[0][0]), [msg, setMsg] = useState(''), [copied, setCopied] = useState('');
  const load = async () => {
    const { data: m } = await supabase.from('memberships').select('user_id,role').eq('company_id', companyId);
    const ids = (m || []).map((x: any) => x.user_id);
    const { data: pr } = ids.length ? await supabase.from('profiles').select('user_id,display_name,email').in('user_id', ids) : { data: [] as any[] };
    const nm: Record<string, string> = Object.fromEntries((pr || []).map((x: any) => [x.user_id, x.email || x.display_name || 'Member']));
    setMembers((m || []).map((x: any) => ({ user_id: x.user_id, role: x.role, name: nm[x.user_id] || 'Member' })));
    const { data: iv } = await supabase.from('invites').select('code,role,new_company').or(`company_id.eq.${companyId},source_company.eq.${companyId}`).is('used_at', null).gt('expires_at', new Date().toISOString());
    setInvites(iv || []);
  };
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line
  const make = async () => { setMsg(''); const { error } = await supabase.rpc('create_invite', { p_company: companyId, p_role: role }); if (error) setMsg(error.message); else load(); };
  const makeCompany = async () => { setMsg(''); const { error } = await supabase.rpc('create_company_invite', { p_company: companyId }); if (error) setMsg(error.message); else load(); };
  const link = (c: string) => `${appUrl()}/?invite=${c}`;
  return (
    <Page title="Team" kicker="Employees, dealers and companies" back={back} backLabel="Home">
      <h3>Invite a person to this company</h3>
      <div className="pills">{roles.map(([k, l]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{l}</button>)}</div>
      <button className="btn" onClick={make}>Create invite link</button>
      {isDev && <div className="muted">Technicians and plumbers are added by each company's own admin.</div>}
      <h3>Invite another company</h3>
      <div className="muted">They get their own company in the app, with their own team and customers. You are not able to see their jobs.</div>
      <button className="btn ghost" onClick={makeCompany}>Create company invite link</button>
      {msg && <div className="err">{msg}</div>}
      {invites.map((i) => (
        <div key={i.code} className="card"><b>{i.new_company ? 'Company invite' : (ROLE_LABEL[i.role] || i.role) + ' invite'}</b><div className="muted" style={{ wordBreak: 'break-all' }}>{link(i.code)}</div>
          <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(link(i.code)); setCopied(i.code); }}>{copied === i.code ? 'Copied ✓' : 'Copy link'}</button></div>
      ))}
      <div className="muted">Each link works once and expires in 14 days.</div>
      <h3>Members</h3>
      <div className="group" style={{ margin: '0 -20px' }}>{members.map((m) => <div key={m.user_id} className="row static"><span className="grow">{m.name}</span><span className="tag">{ROLE_LABEL[m.role] || m.role}</span></div>)}</div>
    </Page>
  );
}

function PlatformScreen({ plat, me, back, onSave }: { plat: Plat; me?: string; back: () => void; onSave: (p: Plat) => Promise<string> }) {
  const [p, setP] = useState<Plat>(plat), [msg, setMsg] = useState('');
  const [devs, setDevs] = useState<{ user_id: string; name: string }[]>([]), [link, setLink] = useState(''), [err, setErr] = useState(''), [copied, setCopied] = useState(false);
  const loadDevs = async () => { const { data } = await supabase.from('profiles').select('user_id,email,display_name').eq('is_developer', true); setDevs((data || []).map((d: any) => ({ user_id: d.user_id, name: d.email || d.display_name || 'Developer' }))); };
  useEffect(() => { loadDevs(); }, []);
  const invite = async () => { setErr(''); const { data, error } = await supabase.rpc('create_developer_invite'); if (error) setErr(error.message); else { setLink(`${appUrl()}/?invite=${data}`); setCopied(false); } };
  const remove = async (id: string) => { setErr(''); const { error } = await supabase.rpc('set_developer', { p_user: id, p_flag: false }); if (error) setErr(error.message); else loadDevs(); };
  const f = (k: keyof Plat, label: string, ph = '') => <div className="field"><label className="lbl">{label}</label><input className="in" placeholder={ph} value={p[k] || ''} onChange={(e) => { setP({ ...p, [k]: e.target.value }); setMsg(''); }} /></div>;
  return (
    <Page title="Platform brand" kicker="Developer" sub="The app's own name and look, shown on the login page and for companies that haven't set their own brand." back={back} backLabel="Home">
      {f('app_name', 'App name', 'Soft Sell')}
      {f('tagline', 'Login tagline', 'Sign in to your account')}
      {f('logo', 'Logo web address (PNG or SVG)', 'https://…')}
      <div className="pricegrid">
        <div className="field"><label className="lbl">Accent color</label><input className="in colorin" type="color" value={p.color || '#1f72d6'} onChange={(e) => { setP({ ...p, color: e.target.value }); setMsg(''); }} /></div>
        <div className="field"><label className="lbl">Header color</label><input className="in colorin" type="color" value={p.dark || '#0b2a5c'} onChange={(e) => { setP({ ...p, dark: e.target.value }); setMsg(''); }} /></div>
      </div>
      <div className="muted">Each company can override all of this under Company &amp; brand. The home-screen icon and install name are fixed in the app's files.</div>
      <h3>Platform team</h3>
      <div className="muted">Developers can see and manage every company, create companies, invite owners and change the platform brand.</div>
      <div className="group" style={{ margin: '0 -20px' }}>
        {devs.map((d) => <div key={d.user_id} className="row static"><span className="grow">{d.name}{d.user_id === me ? ' (you)' : ''}</span>{d.user_id !== me && <button className="link" onClick={() => remove(d.user_id)}>Remove</button>}</div>)}
      </div>
      {link && <div className="okmsg" style={{ wordBreak: 'break-all' }}>{link}</div>}
      {err && <div className="err">{err}</div>}
      <button className="btn ghost" onClick={() => (link ? (navigator.clipboard?.writeText(link), setCopied(true)) : invite())}>{link ? (copied ? 'Copied ✓' : 'Copy developer invite link') : 'Invite another developer'}</button>
      <div className="actions"><button className="btn" onClick={async () => setMsg((await onSave(p)) || 'Saved ✓')}>{msg || 'Save brand'}</button></div>
    </Page>
  );
}

function BrandScreen({ companyId, name, back, onSaved }: { companyId: string; name: string; back: () => void; onSaved: (name: string) => Promise<void> }) {
  const [n, setN] = useState(name), [b, setB] = useState<Brand>({}), [saved, setSaved] = useState(false), [loaded, setLoaded] = useState(false);
  useEffect(() => { supabase.from('companies').select('settings').eq('id', companyId).maybeSingle().then(({ data }) => { setB(data?.settings?.brand || {}); setLoaded(true); }); }, [companyId]);
  const save = async () => {
    const { data } = await supabase.from('companies').select('settings').eq('id', companyId).maybeSingle();
    const clean: Brand = Object.fromEntries(Object.entries(b).filter(([, v]) => v)) as Brand;
    await supabase.from('companies').update({ name: n.trim(), settings: { ...(data?.settings || {}), brand: clean } }).eq('id', companyId);
    await onSaved(n.trim()); setSaved(true);
  };
  const f = (k: keyof Brand, label: string, ph = '') => <div className="field"><label className="lbl">{label}</label><input className="in" placeholder={ph} value={b[k] || ''} onChange={(e) => { setB({ ...b, [k]: e.target.value }); setSaved(false); }} /></div>;
  return (
    <Page title="Company brand" kicker="Developer only" sub="Anything left blank uses the franchise headquarters' brand, if there is one." back={back} backLabel="Home">
      <div className="field"><label className="lbl">Company name</label><input className="in" value={n} onChange={(e) => { setN(e.target.value); setSaved(false); }} /></div>
      {f('tagline', 'Tagline', 'We diagnose. We solve. We protect what matters.')}
      {f('phone', 'Phone')}
      {f('web', 'Website')}
      {f('logo', 'Logo web address (PNG or SVG)', 'https://…')}
      <div className="pricegrid">
        <div className="field"><label className="lbl">Accent color</label><input className="in colorin" type="color" value={b.color || '#1f72d6'} onChange={(e) => { setB({ ...b, color: e.target.value }); setSaved(false); }} /></div>
        <div className="field"><label className="lbl">Header color</label><input className="in colorin" type="color" value={b.dark || '#0b2a5c'} onChange={(e) => { setB({ ...b, dark: e.target.value }); setSaved(false); }} /></div>
      </div>
      <div className="actions"><button className="btn" disabled={!n.trim() || !loaded} onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button></div>
    </Page>
  );
}

type Overview = { kind?: string; parent_name?: string | null; id: string; name: string; slug: string | null; admins: string[]; members: number; jobs: number; tickets: number; last_activity: string | null };

function CompaniesScreen({ list, active, back, onEnter, onCreate }: { list: Co[]; active?: string; back: () => void; onEnter: (id: string) => void; onCreate: (name: string, slug: string, kind: string, parent?: string) => Promise<string> }) {
  const [name, setName] = useState(''), [slug, setSlug] = useState(''), [msg, setMsg] = useState(''), [kind, setKind] = useState('independent'), [parent, setParent] = useState('');
  const hqs = list.filter((c) => c.kind === 'franchisor');
  const [ov, setOv] = useState<Overview[]>([]), [links, setLinks] = useState<Record<string, string>>({}), [copied, setCopied] = useState('');
  useEffect(() => { supabase.rpc('company_overview').then(({ data }) => { if (data) setOv(data); }); }, [list.length]);
  const invite = async (id: string) => {
    const { data, error } = await supabase.rpc('create_invite', { p_company: id, p_role: 'admin' });
    if (error) { setMsg(error.message); return; }
    setLinks((l) => ({ ...l, [id]: `${appUrl()}/?invite=${data}` }));
  };
  const when = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No activity yet');
  return (
    <Page title="All companies" kicker="Developer" sub="Everyone on the platform. Each company has its own data, team, catalog and branding." back={back} backLabel="Home">
      {ov.map((c) => (
        <div key={c.id} className={'card ' + (c.id === active ? 'best' : '')}>
          <div className="between"><h3>{c.name}</h3>{c.id === active && <span className="tag">Open</span>}</div>
          <div className="muted">{c.kind === 'franchisor' ? 'Franchise headquarters' : c.kind === 'location' ? `Franchise location of ${c.parent_name || 'a headquarters'}` : 'Independent company'}</div>
          <div className="muted">{c.slug ? `Login link: /?co=${c.slug}` : 'No login link'}</div>
          <div>{c.admins.length ? <>Owner: <b>{c.admins.join(', ')}</b></> : <b>No owner yet</b>}</div>
          <div className="muted">{c.members} {c.members === 1 ? 'person' : 'people'} · {c.jobs} jobs · {c.tickets} tickets · {when(c.last_activity)}</div>
          {links[c.id] && <div className="okmsg" style={{ wordBreak: 'break-all' }}>{links[c.id]}</div>}
          <div className="btnrow">
            {c.id !== active && <button className="btn ghost sm" onClick={() => onEnter(c.id)}>Open</button>}
            <button className="btn ghost sm" onClick={() => (links[c.id] ? (navigator.clipboard?.writeText(links[c.id]), setCopied(c.id)) : invite(c.id))}>{links[c.id] ? (copied === c.id ? 'Copied ✓' : 'Copy link') : 'Invite owner'}</button>
          </div>
        </div>
      ))}
      {msg && <div className="err">{msg}</div>}
      <div className="card"><b>Create a company</b>
        <input className="in" placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="in" placeholder="Login link name (optional, e.g. zplumberz)" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, ''))} />
        <div className="pills">{[['independent', 'Independent company'], ['franchisor', 'Franchise headquarters'], ['location', 'Franchise location']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
        {kind === 'location' && (hqs.length ? <select className="in" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">Which headquarters?</option>{hqs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select> : <div className="muted">Create the franchise headquarters first.</div>)}
        <button className="btn" disabled={!name.trim() || (kind === 'location' && !parent)} onClick={async () => { setMsg(await onCreate(name, slug, kind, parent)); }}>Create and open</button>
        <div className="muted">New companies start with a copy of the product catalog. Then use Invite owner to send its owner a link; they sign up and become its admin.</div>
      </div>
    </Page>
  );
}

type LocRow = { id: string; name: string; slug: string | null; admins: string[]; members: number; jobs: number; tickets: number; last_activity: string | null };

function LocationsScreen({ back }: { back: () => void }) {
  const [rows, setRows] = useState<LocRow[]>([]), [name, setName] = useState(''), [slug, setSlug] = useState(''), [msg, setMsg] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({}), [copied, setCopied] = useState('');
  const load = () => supabase.rpc('franchise_overview').then(({ data, error }) => { if (error) setMsg(error.message); else setRows(data || []); });
  useEffect(() => { load(); }, []);
  const add = async () => { setMsg(''); const { error } = await supabase.rpc('create_location', { p_name: name, p_slug: slug }); if (error) setMsg(error.message); else { setName(''); setSlug(''); load(); } };
  const invite = async (id: string) => { const { data, error } = await supabase.rpc('create_invite', { p_company: id, p_role: 'admin' }); if (error) setMsg(error.message); else setLinks((l) => ({ ...l, [id]: `${appUrl()}/?invite=${data}` })); };
  const when = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No activity yet');
  return (
    <Page title="Locations" kicker="Franchise headquarters" sub="Each location has its own team and customers. You see who runs it and how active it is, not its customers or jobs." back={back} backLabel="Home">
      {rows.map((c) => (
        <div key={c.id} className="card"><h3>{c.name}</h3>
          <div>{c.admins.length ? <>Owner: <b>{c.admins.join(', ')}</b></> : <b>No owner yet</b>}</div>
          <div className="muted">{c.members} {c.members === 1 ? 'person' : 'people'} · {c.jobs} jobs · {when(c.last_activity)}</div>
          {links[c.id] && <div className="okmsg" style={{ wordBreak: 'break-all' }}>{links[c.id]}</div>}
          <button className="btn ghost sm" onClick={() => (links[c.id] ? (navigator.clipboard?.writeText(links[c.id]), setCopied(c.id)) : invite(c.id))}>{links[c.id] ? (copied === c.id ? 'Copied ✓' : 'Copy link') : 'Invite owner'}</button>
        </div>
      ))}
      {!rows.length && <div className="muted">No locations yet.</div>}
      {msg && <div className="err">{msg}</div>}
      <div className="card"><b>Add a location</b>
        <input className="in" placeholder="Location name (e.g. Z Plumberz of Tri-Cities)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="in" placeholder="Login link name (optional)" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, ''))} />
        <button className="btn" disabled={!name.trim()} onClick={add}>Add location</button>
        <div className="muted">It starts with a copy of your product catalog and your brand. Then invite its owner.</div>
      </div>
    </Page>
  );
}

const PROVIDERS: { k: string; name: string; what: string; how: string }[] = [
  { k: 'housecall_pro', name: 'Housecall Pro', what: 'Jobs and scheduling', how: 'In Housecall Pro, create an API key (it needs a plan that includes API access) and paste it here.' },
  { k: 'angi', name: 'Angi (Angie\'s List)', what: 'Leads and appointments', how: 'Angi shares leads through its partner program. Paste your partner API key if Angi has given you one.' },
  { k: 'thumbtack', name: 'Thumbtack', what: 'Leads', how: 'Paste your Thumbtack partner API token if you have one.' },
  { k: 'homeadvisor', name: 'HomeAdvisor', what: 'Leads', how: 'Paste your HomeAdvisor partner token if you have one.' },
  { k: 'google_lsa', name: 'Google Local Services', what: 'Leads', how: 'Paste your Google Local Services access token.' },
  { k: 'jobber', name: 'Jobber', what: 'Jobs and scheduling', how: 'Paste your Jobber API token.' },
  { k: 'servicetitan', name: 'ServiceTitan', what: 'Jobs and scheduling', how: 'Paste your ServiceTitan client credentials.' },
  { k: 'google_calendar', name: 'Google Calendar', what: 'Appointments', how: 'Paste a calendar access token.' },
];

function IntegrationsScreen({ back }: { back: () => void }) {
  const [rows, setRows] = useState<{ provider: string; status: string; account_label: string | null }[]>([]);
  const [open, setOpen] = useState(''), [label, setLabel] = useState(''), [secret, setSecret] = useState(''), [msg, setMsg] = useState('');
  const load = () => supabase.from('integrations').select('provider,status,account_label').then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  const save = async (k: string) => { setMsg(''); const { error } = await supabase.rpc('save_integration', { p_provider: k, p_label: label, p_secret: secret }); if (error) { setMsg(error.message); return; } setOpen(''); setSecret(''); setLabel(''); load(); };
  const remove = async (k: string) => { await supabase.rpc('remove_integration', { p_provider: k }); load(); };
  return (
    <Page title="Connected apps" kicker="Scheduling and leads" sub="Link the apps you already use so jobs and leads can come into this app." back={back} backLabel="Home">
      <div className="okmsg">Keys you enter are stored securely and can't be read back by anyone in the app. Live syncing is being switched on app by app; saving a key now means it will start working when that connection goes live.</div>
      {PROVIDERS.map((pv) => {
        const row = rows.find((r) => r.provider === pv.k);
        return (
          <div key={pv.k} className="card"><div className="between"><h3>{pv.name}</h3>{row && <span className="tag">Key saved</span>}</div>
            <div className="muted">{pv.what}{row?.account_label ? ` · ${row.account_label}` : ''}</div>
            {open === pv.k ? (
              <>
                <div className="muted">{pv.how}</div>
                <input className="in" placeholder="Account name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
                <input className="in" type="password" placeholder="Key or token" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" />
                {msg && <div className="err">{msg}</div>}
                <div className="btnrow"><button className="btn sm" onClick={() => save(pv.k)}>Save</button><button className="btn ghost sm" onClick={() => { setOpen(''); setMsg(''); }}>Cancel</button></div>
              </>
            ) : (
              <div className="btnrow"><button className="btn ghost sm" onClick={() => { setOpen(pv.k); setLabel(row?.account_label || ''); setSecret(''); }}>{row ? 'Replace key' : 'Connect'}</button>{row && <button className="btn ghost sm" onClick={() => remove(pv.k)}>Remove</button>}</div>
            )}
          </div>
        );
      })}
    </Page>
  );
}

function PendingScreen({ user, err, dev, startCode, onRedeem, onSignOut }: { user: string; err?: string; dev: boolean; startCode?: string; onRedeem: (code: string, name?: string) => Promise<string>; onSignOut: () => void }) {
  const [code, setCode] = useState(startCode || ''), [name, setName] = useState(''), [msg, setMsg] = useState(err || ''), [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ new_company?: boolean; company?: string } | null>(null);
  const clean = code.trim().split('invite=').pop()!.trim();
  useEffect(() => { if (clean.length < 6) { setInfo(null); return; } supabase.rpc('invite_info', { p_code: clean }).then(({ data }) => setInfo(data || null)); }, [clean]);
  return (
    <Page root title={info?.new_company ? 'Set up your company' : 'Join your company'} kicker="One more step" sub={user} right={<button className="backbtn" onClick={onSignOut}>Sign out</button>}>
      <div className="card"><b>You're signed in, but not part of a company yet.</b><div className="muted">Open the invite link you were sent, or paste its code here.</div></div>
      <div className="field"><label className="lbl">Invite code or link</label><input className="in" value={code} onChange={(e) => setCode(e.target.value)} placeholder="a1b2c3d4e5f6" /></div>
      {info?.new_company && <div className="field"><label className="lbl">Your company name{info.company ? ` (invited by ${info.company})` : ''}</label><input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Water Co." /></div>}
      {msg && <div className="err">{msg}</div>}
      <button className="btn" disabled={busy || !clean || (!!info?.new_company && name.trim().length < 2)} onClick={async () => { setBusy(true); setMsg(await onRedeem(clean, name)); setBusy(false); }}>{info?.new_company ? 'Create my company' : 'Join company'}</button>
      {dev && <div className="muted">You are the platform developer: create or open a company from All companies once you are in.</div>}
    </Page>
  );
}

function Page({ title, sub, back, backLabel, right, kicker, segs, light, root, children }: { root?: boolean; title: React.ReactNode; sub?: string; back?: () => void; backLabel?: string; right?: React.ReactNode; kicker?: string; segs?: { n: number; i: number }; light?: boolean; children: React.ReactNode }) {
  const goHome = useContext(HomeCtx);
  const head = (
    <>
      {kicker && <div className="kicker">{kicker}</div>}
      <h1>{title}</h1>
      {sub && <div className="sub">{sub}</div>}
    </>
  );
  return (
    <main>
      <header className="dark">
        <div className="hbar">
          {back ? <button className="backbtn" onClick={back}><ChevronLeft size={20} strokeWidth={2.5} />{backLabel || 'Back'}</button> : <span />}
          <span className="hright">{right}{goHome && !root && <button className="homebtn" onClick={goHome}><House size={18} />Home</button>}</span>
        </div>
        {segs && <div className="segs">{Array.from({ length: segs.n }, (_, k) => <i key={k} className={k < segs.i ? 'done' : k === segs.i ? 'cur' : ''} />)}</div>}
        {!light && <div className="hero">{head}</div>}
      </header>
      {light && <div className="lighthero">{head}</div>}
      <div className="body">{children}</div>
    </main>
  );
}

function TabBar({ screen, admin, canSwitch, go, onMe }: { screen: string; admin: boolean; canSwitch: boolean; go: (s: Screen) => void; onMe: () => void }) {
  const homeKey = admin ? 'admin' : 'jobs', active = ADMIN_SUB.includes(screen) ? 'admin' : screen;
  const tabs = [
    { k: homeKey, l: admin ? 'Home' : 'Jobs', I: House, on: () => go(homeKey as Screen) },
    { k: 'help', l: 'Help', I: CircleHelp, on: () => go('help') },
    ...(canSwitch ? [{ k: 'switch', l: 'Switch', I: Repeat, on: () => go('switch') }] : []),
    { k: 'me', l: 'Sign out', I: User, on: onMe },
  ];
  return (
    <nav className="tabbar">
      {tabs.map(({ k, l, I, on }) => <button key={k} className={active === k ? 'on' : ''} onClick={on}><I size={22} strokeWidth={2} />{l}</button>)}
    </nav>
  );
}

function Login({ onLogin, onAuth, brand, plat }: { plat: Plat; brand: (Brand & { name: string }) | null; onLogin: (u: string, role: 'tech' | 'plumber' | 'admin') => void; onAuth: (email: string, pw: string, mode: 'in' | 'up') => Promise<string> }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [guest, setGuest] = useState(false);
  const run = async (mode: 'in' | 'up') => { setBusy(true); setMsg(''); setMsg(await onAuth(email.trim(), pw, mode)); setBusy(false); };
  const forgot = async () => {
    if (!email.trim()) { setMsg('Enter your email above first.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setMsg(error ? error.message : 'Check your email for a reset link.');
  };
  return (
    <main className="loginwrap">
      <header className="loginhero">
        {brand ? (brand.logo ? <img src={brand.logo} alt={brand.name} className="herologo" /> : <b className="herotext">{brand.name}</b>) : plat.logo ? <img src={plat.logo} alt={plat.app_name} className="herologo" /> : <b className="herotext">{plat.app_name || 'Soft Sell'}</b>}
        <div>
          <h1>{brand?.tagline || plat.tagline || 'Sign in to your account'}</h1>
          <div className="sub">Sign in to continue</div>
        </div>
      </header>
      <div className="body loginbody">
        <div className="field"><label className="lbl">Email</label><input className="in" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="none" /></div>
        <div className="field"><label className="lbl">Password</label><input className="in" type="password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && pw.length >= 6 && run('in')} /></div>
        <button className="btn" disabled={busy || !email || pw.length < 6} onClick={() => run('in')}>Sign in</button>
        <div className="orline"><i />or sign in with<i /></div>
        <button className="btn ghost sso" onClick={() => setMsg('Google sign-in is being set up. Use your email and password for now.')}><span className="gdot" />Google</button>
        {msg && <div className={msg.startsWith('Check') ? 'okmsg' : 'err'}>{msg}</div>}
        <button className="link left" onClick={forgot}>Forgot password?</button>
        <button className="link left" disabled={busy || !email || pw.length < 6} onClick={() => run('up')}>Create an account</button>
        <div className="guestbox">
          <button className="btn ghost" onClick={() => setGuest(!guest)}>Look around as a guest</button>
          {guest && <div className="pills"><button onClick={() => onLogin('Technician', 'tech')}>Technician</button><button onClick={() => onLogin('Ortiz Plumbing & Heating', 'plumber')}>Plumber</button><button onClick={() => onLogin('Admin', 'admin')}>Admin</button></div>}
          <span className="muted">No sign-in needed. Sample data only, not saved to the cloud.</span>
        </div>
      </div>
    </main>
  );
}

function AddOther({ onAdd }: { onAdd: (d: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div className="addother">
      <input className="in" placeholder="Other part not in catalog" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn ghost" onClick={() => { if (t.trim()) { onAdd(t.trim()); setT(''); } }}>Add</button>
    </div>
  );
}

function FieldView({ sid, f, v, set }: { sid: string; f: Field; v: Vals; set: (k: string, x: any) => void }) {
  const k = `${sid}.${f.id}`, val = v[k];
  const wrap = (c: React.ReactNode) => <div className={'field ' + (f.half ? 'half' : '')}><label className="lbl">{f.label}</label>{c}</div>;
  switch (f.t) {
    case 'text': {
      const m = f.label.match(/^(.*) \(([A-Za-z]+)\)$/);
      const input = <input className="in" inputMode={f.im as any} value={val || ''} onChange={(e) => set(k, e.target.value)} />;
      if (!m) return wrap(input);
      return <div className={'field ' + (f.half ? 'half' : '')}><label className="lbl">{m[1]}</label><div className="unit">{input}<span>{m[2]}</span></div></div>;
    }
    case 'date': return wrap(<input className="in" type="date" value={val || ''} onChange={(e) => set(k, e.target.value)} />);
    case 'area': return wrap(<textarea className="in" rows={3} value={val || ''} onChange={(e) => set(k, e.target.value)} />);
    case 'single':
    case 'yn':
      return wrap(<div className="pills">{f.opts!.map((o) => <button key={o} className={val === o ? 'on' : ''} onClick={() => set(k, val === o ? '' : o)}>{o}</button>)}</div>);
    case 'multi': {
      const arr: string[] = val || [];
      return wrap(<div className="pills">{f.opts!.map((o) => <button key={o} className={arr.includes(o) ? 'on' : ''} onClick={() => set(k, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])}>{o}</button>)}</div>);
    }
    case 'lead': {
      return (
        <div className="field">
          <label className="lbl">{f.label} <span className="req">Required</span></label>
          <div className="pills">{LEAD_OPTS.map((o) => <button key={o} className={v['s1.first'] === o ? 'on' : ''} onClick={() => set('s1.first', o)}>{o}</button>)}</div>
          {v['s1.first'] === 'Online search' && (
            <>
              <label className="lbl">Had you heard of us before you searched?</label>
              <div className="pills">{['Yes', 'No'].map((o) => <button key={o} className={v['s1.heard'] === o ? 'on' : ''} onClick={() => set('s1.heard', o)}>{o}</button>)}</div>
            </>
          )}
          <label className="lbl">How did they reach out?</label>
          <div className="pills">{REACH_OPTS.map((o) => <button key={o} className={v['s1.reach'] === o ? 'on' : ''} onClick={() => set('s1.reach', o)}>{o}</button>)}</div>
        </div>
      );
    }
    case 'recs': {
      const r = recommend(v);
      const keys = Object.keys(r.out);
      return (
        <div className="field">
          <label className="lbl">{f.label}</label>
          {!keys.length && <div className="muted">Enter test results above to see a live recommendation.</div>}
          {keys.map((s) => <div key={s} className="card"><b>{CAT[s]?.name}</b><div className="muted">{r.out[s].join(' · ')}</div></div>)}
          {r.flags.map((x) => <div key={x} className="err">{x}</div>)}
        </div>
      );
    }
    case 'photo': return <PhotoField k={k} v={v} set={set} label={f.label} />;
    case 'sig': return wrap(<Sig value={val} onChange={(d) => set(k, d)} />);
  }
  return null;
}

function PhotoField({ k, v, set, label }: { k: string; v: Vals; set: (k: string, x: any) => void; label: string }) {
  const onFile = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'), s = Math.min(1, 800 / img.width);
      c.width = img.width * s; c.height = img.height * s;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      set(k, c.toDataURL('image/jpeg', 0.7));
    };
    img.src = URL.createObjectURL(file);
  };
  return (
    <div className="field">
      <label className="lbl">{label} <span className="req">Required</span></label>
      {v[k] && <img className="thumb" src={v[k]} alt="" />}
      <label className="btn ghost filebtn">{v[k] ? 'Retake photo' : 'Take photo'}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>
      <label className="check"><input type="checkbox" checked={!!v[k + 'Later']} onChange={(e) => set(k + 'Later', e.target.checked)} />Taken on phone camera, attach later</label>
    </div>
  );
}

function Sig({ value, onChange }: { value?: string; onChange: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current!, x = c.getContext('2d')!;
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    if (value) { const i = new Image(); i.onload = () => x.drawImage(i, 0, 0); i.src = value; }
  }, []); // eslint-disable-line
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [(e.clientX - r.left) * (ref.current!.width / r.width), (e.clientY - r.top) * (ref.current!.height / r.height)]; };
  return (
    <div>
      <canvas ref={ref} width={600} height={200} className="sig" style={{ touchAction: 'none' }}
        onPointerDown={(e) => { drawing.current = true; const x = ref.current!.getContext('2d')!; const [px, py] = pos(e); x.beginPath(); x.moveTo(px, py); }}
        onPointerMove={(e) => { if (!drawing.current) return; const x = ref.current!.getContext('2d')!; const [px, py] = pos(e); x.lineWidth = 3; x.strokeStyle = '#0d2550'; x.lineTo(px, py); x.stroke(); }}
        onPointerUp={() => { drawing.current = false; onChange(ref.current!.toDataURL()); }} />
      <button className="link" onClick={() => { const c = ref.current!; c.getContext('2d')!.fillStyle = '#fff'; c.getContext('2d')!.fillRect(0, 0, c.width, c.height); onChange(''); }}>Clear</button>
    </div>
  );
}
