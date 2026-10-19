'use client';
import { useEffect, useRef, useState } from 'react';
import { Building2, Palette, Users, Repeat, Bell, Box, Check, Headphones, MessageSquare, Package, Settings, ShoppingBag, Wrench, ChevronLeft, ChevronRight, CircleHelp, House, MapPin, Phone, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATALOG, CAT, JOBS, KITS, MAINS, RULES, RULE_LABELS, LEAD_OPTS, QUICK, REACH_OPTS, SECS, Field, Vals, money, monthly, recommend, suggest, tiers } from '@/lib/data';

type Screen = 'team' | 'brand' | 'companies' | 'newjob' | 'switch' | 'pending' | 'help' | 'inbox' | 'messages' | 'setup' | 'kits' | 'packing' | 'porders' | 'admin' | 'catalog' | 'ordered' | 'login' | 'jobs' | 'overview' | 'section' | 'present' | 'proposal' | 'materials' | 'done';
type Meta = { id: string; name: string; address: string; city: string; state: string; zip: string; phone: string; reason: string; time: string };
type Brand = { tagline?: string; phone?: string; web?: string; logo?: string };
type Co = { id: string; name: string; slug: string | null; role: string; brand: Brand };
type JobData = { meta?: Meta; values: Vals; flow: 'full' | 'quick'; parts: Record<string, number>; other: { desc: string; qty: number }[]; choice?: string; fulfil?: 'Pickup' | 'Delivery'; install?: 'Self-install' | 'SWS install'; ordered?: boolean; deposit?: boolean; sent?: boolean };
type State = { screen: Screen; jobId?: string; sec: number; jobs: Record<string, JobData>; user?: string; role?: 'tech' | 'plumber' | 'admin'; disc?: number; uid?: string; companyId?: string; dev?: boolean; companies?: Co[]; companyName?: string; brand?: Brand; tickets?: { id: number; topic: string; to: string; text: string; urgent: boolean; from: string }[]; prefs?: Record<string, string[]>; setup?: string[]; diy?: boolean; kits?: typeof KITS; rules?: typeof RULES; packed?: Record<string, string[]>; packSent?: Record<string, boolean>; prices?: Record<string, { cost: number; msrp: number; name?: string }>; online: boolean };

const KEY = 'sws-app-v1';
const GROUPS = ['Assess', 'Inspect', 'Plan', 'Close'];
const GROUP_OF: Record<string, string> = { s1: 'Assess', sB: 'Assess', s2: 'Assess', s3: 'Assess', s4: 'Assess', s5: 'Assess', s6: 'Inspect', s7: 'Inspect', s8: 'Inspect', s9: 'Plan', s10: 'Plan', s14: 'Close', s16: 'Close' };
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
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setSt({ ...JSON.parse(s), online: navigator.onLine }); } catch {}
    try {
      const q = new URLSearchParams(window.location.search);
      const inv = q.get('invite'), co = q.get('co');
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
      if (inv) { const { error } = await supabase.rpc('redeem_invite', { p_code: inv }); if (error) inviteErr = error.message; }
      const { data: prof } = await supabase.from('profiles').select('display_name,is_developer,active_company_id').maybeSingle();
      const { data: mem } = await supabase.from('memberships').select('company_id,role');
      const { data: cos } = await supabase.from('companies').select('id,name,slug,settings').order('name');
      const roleOf: Record<string, string> = Object.fromEntries((mem || []).map((m: any) => [m.company_id, m.role]));
      const companies: Co[] = (cos || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, role: roleOf[c.id] || 'admin', brand: c.settings?.brand || {} }));
      let active: string | undefined = prof?.active_company_id || undefined;
      if (!companies.find((c) => c.id === active)) { active = companies[0]?.id; if (active) await supabase.rpc('set_active_company', { p_company: active }); }
      if (!active) { setSt((x) => ({ ...x, screen: 'pending', user: prof?.display_name || email, uid, companyId: undefined, companies: [], dev: !!prof?.is_developer, inviteErr })); return; }
      const co = companies.find((c) => c.id === active)!;
      const [{ data: rows }, { data: cat }, { data: cfgRow }, { data: tk }] = await Promise.all([
        supabase.from('jobs').select('id,data'),
        supabase.from('catalog_items').select('sku,name,cost,msrp'),
        supabase.from('companies').select('settings').eq('id', active).maybeSingle(),
        supabase.from('tickets').select('id,topic,routed_to,body,urgent,author_id'),
      ]);
      remoteSettings.current = cfgRow?.settings || {};
      const cfg = remoteSettings.current;
      const prices = Object.fromEntries((cat || []).map((c: any) => [c.sku, { cost: Number(c.cost), msrp: Number(c.msrp), name: c.name }]));
      const tickets = (tk || []).map((t: any) => ({ id: t.id, topic: t.topic, to: t.routed_to, text: t.body, urgent: t.urgent, from: t.author_id === uid ? email : 'Team member' }));
      const remote: Record<string, JobData> = Object.fromEntries((rows || []).map((r: any) => [r.id, r.data]));
      const rr = prof?.is_developer ? 'admin' : co.role;
      const role = rr === 'admin' || rr === 'franchisor' ? 'admin' : rr === 'plumber' || rr === 'dealer' ? 'plumber' : 'tech';
      setSt((x) => ({
        ...x, kits: cfg.kits, rules: cfg.rules, disc: cfg.disc, prefs: cfg.prefs, setup: cfg.setup, diy: cfg.diy, brand: cfg.brand,
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
      const next = { ...remoteSettings.current, ...Object.fromEntries(Object.entries({ kits: st.kits, rules: st.rules, disc: st.disc, prefs: st.prefs, setup: st.setup, diy: st.diy, brand: st.brand }).filter(([, v]) => v !== undefined)) };
      if (JSON.stringify(next) !== JSON.stringify(remoteSettings.current)) {
        remoteSettings.current = next;
        supabase.from('companies').update({ settings: next }).eq('id', st.companyId!).then(({ error }) => { if (error) console.warn('settings sync failed', error.message); });
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [st.prices, st.kits, st.rules, st.disc, st.prefs, st.setup, st.diy, st.brand, st.uid, st.companyId, st.role]);
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

  const go = (screen: Screen, extra: Partial<State> = {}) => { setSt((s) => ({ ...s, screen, ...extra })); window.scrollTo(0, 0); };
  const metaOf = (id: string): Meta | undefined => st.jobs[id]?.meta || JOBS.find((j) => j.id === id);
  const ownJobs = Object.values(st.jobs).map((d) => d.meta).filter((m): m is Meta => !!m);
  const jobList: Meta[] = st.uid ? ownJobs : [...JOBS, ...ownJobs.filter((m) => !JOBS.some((j) => j.id === m.id))];
  const job = st.jobId ? metaOf(st.jobId) : undefined;
  const jd = job ? st.jobs[job.id] || blank(job) : undefined;
  const patch = (p: Partial<JobData>) => job && jd && setSt((s) => ({ ...s, jobs: { ...s.jobs, [job.id]: { ...jd, ...p } } }));
  const setVal = (k: string, val: any) => jd && patch({ values: { ...jd.values, [k]: val } });
  const flowSecs = jd ? (jd.flow === 'quick' ? SECS.filter((s) => QUICK.includes(s.id)) : SECS) : SECS;

  return (
    <div className={'shell ' + (['jobs', 'admin', 'help', 'switch'].includes(st.screen) ? 'withtabs' : '')}>
      {!st.online && <div className="offline">Offline. Your work is saved on this device and will sync when signal returns.</div>}
      {st.screen === 'login' && <Login brand={loginBrand} onAuth={async (email, pw, mode) => { const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password: pw }) : await supabase.auth.signUp({ email, password: pw }); return r.error?.message || (mode === 'up' && !r.data.session ? 'Check your email to confirm your account, then sign in.' : ''); }} onLogin={(u, role) => go(role === 'admin' ? 'admin' : 'jobs', { user: u, role })} />}
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
              ['Team', 'Members and invites', 'team', Users],
              ['Company & brand', 'Name, logo, contact', 'brand', Palette],
              ['Setup', `${(st.setup || []).length}/${SETUP.length} done`, 'setup', Settings],
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
        <Page title="View as" kicker="Developer" sub="See the app the way each role does. Your account stays the same.">
          {([['Technician', 'tech', 'jobs'], ['Plumbing partner', 'plumber', 'jobs'], ['Admin', 'admin', 'admin']] as ['' | string, 'tech' | 'plumber' | 'admin', Screen][]).map(([l, r, to]) => (
            <button key={l} className={'row ' + (st.role === r ? 'cur' : '')} onClick={() => go(to, { role: r })}><span className="grow">{l}</span>{st.role === r && <span className="donetag"><Check size={16} />Current</span>}<ChevronRight size={18} /></button>
          ))}
        </Page>
      )}
      {st.screen === 'newjob' && <NewJob back={() => go('jobs')} onCreate={(m) => { setSt((x) => ({ ...x, jobs: { ...x.jobs, [m.id]: blank(m, x.role === 'plumber' ? 'quick' : 'full') }, jobId: m.id, screen: 'overview' })); window.scrollTo(0, 0); }} />}
      {st.screen === 'team' && st.companyId && <TeamScreen companyId={st.companyId} back={() => go('admin')} />}
      {st.screen === 'brand' && st.companyId && (
        <BrandScreen name={coName} brand={st.brand || {}} back={() => go('admin')}
          onSave={async (name, b) => { await supabase.from('companies').update({ name }).eq('id', st.companyId!); setSt((x) => ({ ...x, companyName: name, brand: b, companies: (x.companies || []).map((c) => (c.id === x.companyId ? { ...c, name } : c)) })); }} />
      )}
      {st.screen === 'companies' && (
        <CompaniesScreen list={st.companies || []} active={st.companyId} back={() => go('admin')} onEnter={switchCompany}
          onCreate={async (name, slug) => { const { error } = await supabase.rpc('create_company', { p_name: name, p_slug: slug }); if (error) return error.message; const { data } = await supabase.auth.getSession(); await loadRef.current(data.session, true); return ''; }} />
      )}
      {st.screen === 'pending' && (
        <PendingScreen user={st.user || ''} err={(st as any).inviteErr} dev={!!st.dev} onSignOut={signOut}
          onRedeem={async (code) => { const { error } = await supabase.rpc('redeem_invite', { p_code: code }); if (error) return error.message; const { data } = await supabase.auth.getSession(); await loadRef.current(data.session, true); return ''; }} />
      )}
      {['jobs', 'admin', 'help', 'switch'].includes(st.screen) && <TabBar screen={st.screen} admin={st.role === 'admin'} dev={st.dev} go={(x) => go(x)} onMe={signOut} />}
      <footer>Powered by<img src="/pdm-logo.png" alt="Performance Digital Marketing" /></footer>
    </div>
  );
}

const SETUP = ['Company and brand', 'Assistant name', 'Users', 'Programs', 'Pricing', 'Rules', 'Lead source', 'Financing and deposit', 'Integrations'];
const EVENTS = ['New job assigned', 'Proposal signed', 'Partner order placed', 'Order ready for pickup', 'Support ticket reply'];
const TOPICS: [string, string][] = [['Install, plumbing or water question', 'Matt (master plumber)'], ['Order, billing or account', 'SWS office'], ['App bug or feature idea', 'Platform (Mike)']];

function HelpScreen({ role, user, back, onSend }: { role?: string; user: string; back: () => void; onSend: (t: { topic: string; to: string; text: string; urgent: boolean }) => void }) {
  const [topic, setTopic] = useState(0), [text, setText] = useState(''), [urgent, setUrgent] = useState(false), [sent, setSent] = useState(false);
  return (
    <Page title="Help and support" sub={`${user}${role ? ' · ' + role : ''}`} back={back}>
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

function TeamScreen({ companyId, back }: { companyId: string; back: () => void }) {
  const [members, setMembers] = useState<{ user_id: string; role: string; name: string }[]>([]);
  const [invites, setInvites] = useState<{ code: string; role: string }[]>([]);
  const [role, setRole] = useState('tech'), [msg, setMsg] = useState(''), [copied, setCopied] = useState('');
  const load = async () => {
    const { data: m } = await supabase.from('memberships').select('user_id,role').eq('company_id', companyId);
    const ids = (m || []).map((x: any) => x.user_id);
    const { data: pr } = ids.length ? await supabase.from('profiles').select('user_id,display_name,email').in('user_id', ids) : { data: [] as any[] };
    const nm: Record<string, string> = Object.fromEntries((pr || []).map((x: any) => [x.user_id, x.email || x.display_name || 'Member']));
    setMembers((m || []).map((x: any) => ({ user_id: x.user_id, role: x.role, name: nm[x.user_id] || 'Member' })));
    const { data: iv } = await supabase.from('invites').select('code,role').eq('company_id', companyId).is('used_at', null).gt('expires_at', new Date().toISOString());
    setInvites(iv || []);
  };
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line
  const make = async () => { setMsg(''); const { error } = await supabase.rpc('create_invite', { p_company: companyId, p_role: role }); if (error) setMsg(error.message); else load(); };
  const link = (c: string) => `${window.location.origin}/?invite=${c}`;
  return (
    <Page title="Team" kicker="Members and invites" back={back} backLabel="Home">
      <h3>Invite someone</h3>
      <div className="pills">{Object.entries(ROLE_LABEL).filter(([k]) => k !== 'franchisor').map(([k, l]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{l}</button>)}</div>
      <button className="btn" onClick={make}>Create invite link</button>
      {msg && <div className="err">{msg}</div>}
      {invites.map((i) => (
        <div key={i.code} className="card"><b>{ROLE_LABEL[i.role] || i.role} invite</b><div className="muted" style={{ wordBreak: 'break-all' }}>{link(i.code)}</div>
          <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(link(i.code)); setCopied(i.code); }}>{copied === i.code ? 'Copied ✓' : 'Copy link'}</button></div>
      ))}
      <div className="muted">Each link works once and expires in 14 days. The person signs up, and joins this company.</div>
      <h3>Members</h3>
      <div className="group" style={{ margin: '0 -20px' }}>{members.map((m) => <div key={m.user_id} className="row static"><span className="grow">{m.name}</span><span className="tag">{ROLE_LABEL[m.role] || m.role}</span></div>)}</div>
    </Page>
  );
}

function BrandScreen({ name, brand, back, onSave }: { name: string; brand: Brand; back: () => void; onSave: (name: string, b: Brand) => Promise<void> }) {
  const [n, setN] = useState(name), [b, setB] = useState<Brand>(brand), [saved, setSaved] = useState(false);
  const f = (k: keyof Brand, label: string, ph = '') => <div className="field"><label className="lbl">{label}</label><input className="in" placeholder={ph} value={b[k] || ''} onChange={(e) => { setB({ ...b, [k]: e.target.value }); setSaved(false); }} /></div>;
  return (
    <Page title="Company & brand" kicker="Shown on login, proposals and messages" back={back} backLabel="Home">
      <div className="field"><label className="lbl">Company name</label><input className="in" value={n} onChange={(e) => { setN(e.target.value); setSaved(false); }} /></div>
      {f('tagline', 'Tagline', 'We diagnose. We solve. We protect what matters.')}
      {f('phone', 'Phone')}
      {f('web', 'Website')}
      {f('logo', 'Logo web address (PNG or SVG)', 'https://…')}
      <div className="actions"><button className="btn" disabled={!n.trim()} onClick={async () => { await onSave(n.trim(), b); setSaved(true); }}>{saved ? 'Saved ✓' : 'Save'}</button></div>
    </Page>
  );
}

function CompaniesScreen({ list, active, back, onEnter, onCreate }: { list: Co[]; active?: string; back: () => void; onEnter: (id: string) => void; onCreate: (name: string, slug: string) => Promise<string> }) {
  const [name, setName] = useState(''), [slug, setSlug] = useState(''), [msg, setMsg] = useState('');
  return (
    <Page title="All companies" kicker="Developer" sub="Everyone on the platform. Each company has its own data, team, catalog and branding." back={back} backLabel="Home">
      <div className="card"><b>Create a company</b>
        <input className="in" placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="in" placeholder="Login link name (optional, e.g. zplumberz)" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, ''))} />
        <button className="btn" disabled={!name.trim()} onClick={async () => { setMsg(await onCreate(name, slug)); }}>Create and open</button>
        {msg && <div className="err">{msg}</div>}
        <div className="muted">New companies start with a copy of the SWS product catalog. You become its admin; then invite its owner from Team.</div>
      </div>
      <div className="group" style={{ margin: '0 -20px' }}>
        {list.map((c) => <button key={c.id} className="row" onClick={() => c.id !== active && onEnter(c.id)}><span className="grow"><b>{c.name}</b><div className="muted">{c.slug ? `/?co=${c.slug}` : 'No login link'}</div></span>{c.id === active ? <span className="donetag"><Check size={16} />Open</span> : <ChevronRight size={18} />}</button>)}
      </div>
    </Page>
  );
}

function PendingScreen({ user, err, dev, onRedeem, onSignOut }: { user: string; err?: string; dev: boolean; onRedeem: (code: string) => Promise<string>; onSignOut: () => void }) {
  const [code, setCode] = useState(''), [msg, setMsg] = useState(err || ''), [busy, setBusy] = useState(false);
  return (
    <Page title="Join your company" kicker="One more step" sub={user} right={<button className="backbtn" onClick={onSignOut}>Sign out</button>}>
      <div className="card"><b>You're signed in, but not part of a company yet.</b><div className="muted">Open the invite link your company admin sent you, or paste its code here.</div></div>
      <div className="field"><label className="lbl">Invite code or link</label><input className="in" value={code} onChange={(e) => setCode(e.target.value)} placeholder="a1b2c3d4e5f6" /></div>
      {msg && <div className="err">{msg}</div>}
      <button className="btn" disabled={busy || !code.trim()} onClick={async () => { setBusy(true); const c = code.trim().split('invite=').pop()!; setMsg(await onRedeem(c)); setBusy(false); }}>Join company</button>
      {dev && <div className="muted">You are the platform developer: ask for a company to be created and it will appear here.</div>}
    </Page>
  );
}

function Page({ title, sub, back, backLabel, right, kicker, segs, light, children }: { title: React.ReactNode; sub?: string; back?: () => void; backLabel?: string; right?: React.ReactNode; kicker?: string; segs?: { n: number; i: number }; light?: boolean; children: React.ReactNode }) {
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
          <span className="hright">{right}</span>
        </div>
        {segs && <div className="segs">{Array.from({ length: segs.n }, (_, k) => <i key={k} className={k < segs.i ? 'done' : k === segs.i ? 'cur' : ''} />)}</div>}
        {!light && <div className="hero">{head}</div>}
      </header>
      {light && <div className="lighthero">{head}</div>}
      <div className="body">{children}</div>
    </main>
  );
}

function TabBar({ screen, admin, dev, go, onMe }: { screen: string; admin: boolean; dev?: boolean; go: (s: Screen) => void; onMe: () => void }) {
  const tabs = [
    { k: admin ? 'admin' : 'jobs', l: admin ? 'Home' : 'Jobs', I: House, on: () => go(admin ? 'admin' : 'jobs') },
    { k: 'help', l: 'Help', I: CircleHelp, on: () => go('help') },
    ...(dev ? [{ k: 'switch', l: 'Switch', I: Repeat, on: () => go('switch') }] : []),
    { k: 'me', l: 'Sign out', I: User, on: onMe },
  ];
  return (
    <nav className="tabbar">
      {tabs.map(({ k, l, I, on }) => <button key={k} className={screen === k ? 'on' : ''} onClick={on}><I size={22} strokeWidth={2} />{l}</button>)}
    </nav>
  );
}

function Login({ onLogin, onAuth, brand }: { brand: (Brand & { name: string }) | null; onLogin: (u: string, role: 'tech' | 'plumber' | 'admin') => void; onAuth: (email: string, pw: string, mode: 'in' | 'up') => Promise<string> }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [guest, setGuest] = useState(false);
  const run = async (mode: 'in' | 'up') => { setBusy(true); setMsg(''); setMsg(await onAuth(email.trim(), pw, mode)); setBusy(false); };
  const forgot = async () => {
    if (!email.trim()) { setMsg('Enter your email above first.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMsg(error ? error.message : 'Check your email for a reset link.');
  };
  return (
    <main className="loginwrap">
      <header className="loginhero">
        {!brand ? <img src="/sws-logo-white.png" alt="Soft Water Specialists" className="herologo" width={260} height={68} /> : brand.logo ? <img src={brand.logo} alt={brand.name} className="herologo" /> : <b className="herotext">{brand.name}</b>}
        <div>
          <h1>{brand?.tagline || 'We diagnose. We solve. We protect what matters.'}</h1>
          <div className="sub">Sign in to your water evaluations</div>
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
