'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CAT, JOBS, KITS, MAINS, RULES, RULE_LABELS, LEAD_OPTS, QUICK, REACH_OPTS, SECS, Field, Vals, money, monthly, recommend, suggest, tiers } from '@/lib/data';

type Screen = 'pending' | 'help' | 'inbox' | 'messages' | 'setup' | 'kits' | 'packing' | 'porders' | 'admin' | 'catalog' | 'ordered' | 'login' | 'jobs' | 'overview' | 'section' | 'present' | 'proposal' | 'materials' | 'done';
type JobData = { values: Vals; flow: 'full' | 'quick'; parts: Record<string, number>; other: { desc: string; qty: number }[]; choice?: string; fulfil?: 'Pickup' | 'Delivery'; install?: 'Self-install' | 'SWS install'; ordered?: boolean; deposit?: boolean; sent?: boolean };
type State = { screen: Screen; jobId?: string; sec: number; jobs: Record<string, JobData>; user?: string; role?: 'tech' | 'plumber' | 'admin'; disc?: number; uid?: string; companyId?: string; tickets?: { id: number; topic: string; to: string; text: string; urgent: boolean; from: string }[]; prefs?: Record<string, string[]>; setup?: string[]; diy?: boolean; kits?: typeof KITS; rules?: typeof RULES; packed?: Record<string, string[]>; packSent?: Record<string, boolean>; prices?: Record<string, { cost: number; msrp: number }>; online: boolean };

const KEY = 'sws-app-v1';
const blank = (j: (typeof JOBS)[number], flow: 'full' | 'quick' = 'full'): JobData => ({
  flow, parts: {}, other: [],
  values: { 's1.name': j.name, 's1.address': j.address, 's1.city': j.city, 's1.state': j.state, 's1.zip': j.zip, 's1.phone': j.phone, 's3.happiest': '' },
});

export default function App() {
  const [st, setSt] = useState<State>({ screen: 'login', sec: 0, jobs: {}, online: true });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setSt({ ...JSON.parse(s), online: navigator.onLine }); } catch {}
    setReady(true);
    const on = () => setSt((s) => ({ ...s, online: navigator.onLine }));
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }, [st, ready]);
  useEffect(() => {
    if (!ready) return;
    const handle = async (session: any) => {
      if (!session) return;
      const { data: p } = await supabase.from('profiles').select('company_id,role,display_name').maybeSingle();
      const email = session.user.email as string;
      if (!p) { setSt((x) => ({ ...x, screen: 'pending', user: email, uid: session.user.id, companyId: undefined })); return; }
      const role = p.role === 'admin' ? 'admin' : p.role === 'plumber' || p.role === 'dealer' ? 'plumber' : 'tech';
      const { data: rows } = await supabase.from('jobs').select('id,data');
      const remote: Record<string, JobData> = Object.fromEntries((rows || []).map((r: any) => [r.id, r.data]));
      setSt((x) => ({ ...x, uid: session.user.id, companyId: p.company_id, role, user: p.display_name || email, jobs: { ...x.jobs, ...remote },
        screen: x.screen === 'login' || x.screen === 'pending' ? (role === 'admin' ? 'admin' : 'jobs') : x.screen }));
    };
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
  if (!ready) return null;
  const signOut = async () => { await supabase.auth.signOut(); setSt((x) => ({ ...x, screen: 'login', user: undefined, role: undefined, uid: undefined, companyId: undefined, jobs: {} })); };
  Object.entries(st.prices || {}).forEach(([k, p]) => CAT[k] && Object.assign(CAT[k], p));
  if (st.kits) Object.assign(KITS, st.kits);
  if (st.rules) RULES.splice(0, RULES.length, ...st.rules);
  const disc = st.disc ?? 40;
  const isPartner = st.role === 'plumber';

  const go = (screen: Screen, extra: Partial<State> = {}) => { setSt((s) => ({ ...s, screen, ...extra })); window.scrollTo(0, 0); };
  const job = JOBS.find((j) => j.id === st.jobId);
  const jd = job ? st.jobs[job.id] || blank(job) : undefined;
  const patch = (p: Partial<JobData>) => job && jd && setSt((s) => ({ ...s, jobs: { ...s.jobs, [job.id]: { ...jd, ...p } } }));
  const setVal = (k: string, val: any) => jd && patch({ values: { ...jd.values, [k]: val } });
  const flowSecs = jd ? (jd.flow === 'quick' ? SECS.filter((s) => QUICK.includes(s.id)) : SECS) : SECS;

  return (
    <div className="shell">
      {!st.online && <div className="offline">Offline. Your work is saved on this device and will sync when signal returns.</div>}
      {st.screen === 'login' && <Login onAuth={async (email, pw, mode) => { const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password: pw }) : await supabase.auth.signUp({ email, password: pw }); return r.error?.message || (mode === 'up' && !r.data.session ? 'Check your email to confirm your account, then sign in.' : ''); }} onLogin={(u, role) => go(role === 'admin' ? 'admin' : 'jobs', { user: u, role })} />}
      {st.screen === 'jobs' && (
        <Page title="Today's jobs" sub={`${st.user || 'Technician'}${isPartner ? ' · partner' : ''} · synced from Housecall Pro`} right={<span><button className="link" onClick={() => go('help')}>Help</button> <button className="link" onClick={() => signOut()}>Sign out</button></span>}>
          {JOBS.map((j) => {
            const d = st.jobs[j.id];
            const done = d ? pct(d, SECS) : 0;
            return (
              <button key={j.id} className="row" onClick={() => go('overview', { jobId: j.id, jobs: { ...st.jobs, [j.id]: d || blank(j, isPartner ? 'quick' : 'full') } })}>
                <div className="time">{j.time}</div>
                <div className="grow"><b>{j.name}</b><div className="muted">{j.address}, {j.city}</div><div className="muted">{j.reason}</div></div>
                {d && <span className="chip">{done}%</span>}
              </button>
            );
          })}
        </Page>
      )}
      {st.screen === 'overview' && job && jd && (
        <Page title={job.name} sub={`${job.address}, ${job.city}`} back={() => go('jobs')}>
          <div className="seg">
            {(['full', 'quick'] as const).map((f) => (
              <button key={f} className={jd.flow === f ? 'on' : ''} onClick={() => patch({ flow: f })}>{f === 'full' ? 'Full evaluation' : 'Quick diagnosis'}</button>
            ))}
          </div>
          {flowSecs.map((s, i) => {
            const c = secDone(jd.values, s.id);
            return (
              <button key={s.id} className="row" onClick={() => go('section', { sec: i })}>
                <span className="num">{s.n}</span><span className="grow"><b>{s.title}</b></span>
                <span className={'chip ' + (c ? 'ok' : '')}>{c ? 'Done' : 'To do'}</span>
              </button>
            );
          })}
          <div className="actions">
            <button className="btn" onClick={() => go('present')}>Present options</button>
            <button className="btn ghost" onClick={() => go('materials')}>Job materials</button>
          </div>
        </Page>
      )}
      {st.screen === 'section' && job && jd && (() => {
        const s = flowSecs[Math.min(st.sec, flowSecs.length - 1)];
        const last = st.sec >= flowSecs.length - 1;
        const blocked = s.id === 'sB' && !jd.values['sB.bp'] && !jd.values['sB.bpLater'];
        return (
          <Page title={`${s.n} ${s.title}`} sub={`Step ${st.sec + 1} of ${flowSecs.length}`} back={() => go('overview')}>
            {s.fields.filter((f) => !f.show || f.show(jd.values)).map((f) => (
              <FieldView key={f.id} sid={s.id} f={f} v={jd.values} set={setVal} />
            ))}
            {blocked && <div className="err">A before photo is required to continue. Take one, or check “taken on phone camera”.</div>}
            <div className="actions">
              {st.sec > 0 && <button className="btn ghost" onClick={() => go('section', { sec: st.sec - 1 })}>Back</button>}
              <button className="btn" disabled={blocked} onClick={() => (last ? go('overview') : go('section', { sec: st.sec + 1 }))}>{last ? 'Finish' : 'Next'}</button>
            </div>
          </Page>
        );
      })()}
      {st.screen === 'present' && job && jd && (() => {
        const ts = tiers(jd.values);
        const none = !Object.keys(recommend(jd.values).out).length;
        return (
          <Page title="Your options" sub="Monthly payments are placeholders (7.99% APR, 60 mo)" back={() => go('overview')}>
            {none && <div className="err">Enter water test results first so a recommendation can be built.</div>}
            {ts.map((t) => (
              <div key={t.name} className={'card ' + (t.name === 'Best' ? 'best' : '')}>
                <div className="between"><h3>{t.name}</h3>{t.name === 'Best' && <span className="chip ok">Recommended</span>}</div>
                <div className="muted">{t.sub}</div>
                <ul>{t.skus.map((s) => <li key={s}>{CAT[s].name}</li>)}<li>Install kit</li></ul>
                <div className="price">{money(t.total)}</div>
                <div className="muted">or {money(monthly(t.total))}/mo</div>
                <button className="btn" onClick={() => { patch({ choice: t.name }); go('proposal'); }}>Choose {t.name}</button>
              </div>
            ))}
          </Page>
        );
      })()}
      {st.screen === 'proposal' && job && jd && (() => {
        const t = tiers(jd.values).find((x) => x.name === jd.choice) || tiers(jd.values)[1];
        const dep = Math.round(t.total * 0.1);
        return (
          <Page title="Proposal" sub={`${job.name} · ${t.name} option`} back={() => go('present')}>
            <div className="card">
              <h3>{t.name}: {money(t.total)}</h3>
              <ul>{t.skus.map((s) => <li key={s}>{CAT[s].name}</li>)}<li>Install kit</li></ul>
              <div className="muted">Deposit (10%, placeholder): {money(dep)}</div>
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
          <Page title="Job materials" sub="Auto-built from install kits and admin rules" back={() => go('overview')}>
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
          <Page title="Job complete" sub="After photo and QA summary" back={() => go('overview')}>
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
        <Page title="Admin" sub={`${st.user} · Soft Water Specialists`} right={<button className="link" onClick={() => signOut()}>Sign out</button>}>
          <button className="row" onClick={() => go('catalog')}><span className="grow"><b>Products and pricing</b><div className="muted">Edit cost and MSRP</div></span>›</button>
          <div className="card"><label className="lbl">Plumbing partner discount off MSRP (%)</label>
            <input className="in" inputMode="numeric" value={disc} onChange={(e) => setSt((x) => ({ ...x, disc: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))} /></div>
          <button className="row" onClick={() => go('kits')}><span className="grow"><b>Kits and rules</b><div className="muted">Install kits per product, parts rules</div></span>›</button>
          <button className="row" onClick={() => go('packing')}><span className="grow"><b>Packing lists</b><div className="muted">Check items off, send to packer</div></span>›</button>
          <button className="row" onClick={() => go('porders')}><span className="grow"><b>Partner orders</b><div className="muted">{Object.values(st.jobs).filter((j) => j.ordered).length} wholesale orders</div></span>›</button>
          <button className="row" onClick={() => go('inbox')}><span className="grow"><b>Support inbox</b><div className="muted">{(st.tickets || []).length} tickets</div></span>›</button>
          <button className="row" onClick={() => go('messages')}><span className="grow"><b>Messages</b><div className="muted">Push / text / email per event</div></span>›</button>
          <button className="row" onClick={() => go('setup')}><span className="grow"><b>Setup</b><div className="muted">{(st.setup || []).length}/{SETUP.length} done</div></span>›</button>
        </Page>
      )}
      {st.screen === 'catalog' && (
        <Page title="Products and pricing" sub="Changes apply to proposals and partner orders" back={() => go('admin')}>
          {Object.values(CAT).map((c) => (
            <div key={c.sku} className="card"><b>{c.name}</b><div className="muted">{c.sku}</div>
              <div className="pricegrid">
                {(['cost', 'msrp'] as const).map((f) => (
                  <label key={f} className="lbl">{f === 'cost' ? 'Cost' : 'MSRP'}
                    <input className="in" inputMode="decimal" value={c[f]} onChange={(e) => setSt((x) => ({ ...x, prices: { ...x.prices, [c.sku]: { cost: c.cost, msrp: c.msrp, [f]: parseFloat(e.target.value) || 0 } } }))} /></label>
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
            const j = JOBS.find((x) => x.id === id)!, done = st.packed?.[id] || [];
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
      {st.screen === 'help' && <HelpScreen role={st.role} user={st.user || ''} back={() => go('jobs')} onSend={(t) => { setSt((x) => ({ ...x, tickets: [...(x.tickets || []), { ...t, id: (x.tickets || []).length + 1, from: x.user || '' }] })); }} />}
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
      {st.screen === 'pending' && (
        <Page title="Almost there" sub={st.user} right={<button className="link" onClick={signOut}>Sign out</button>}>
          <div className="card"><b>Your account is waiting for access.</b><div className="muted">An admin needs to add you to a company. Ask Matt, then sign in again.</div></div>
        </Page>
      )}
      <footer>Powered by pdmrocks.com</footer>
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

function Page({ title, sub, back, right, children }: { title: string; sub?: string; back?: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main>
      <header>
        {back && <button className="link" onClick={back}>‹ Back</button>}
        <div className="between"><h1>{title}</h1>{right}</div>
        {sub && <div className="muted">{sub}</div>}
      </header>
      <div className="body">{children}</div>
    </main>
  );
}

function Login({ onLogin, onAuth }: { onLogin: (u: string, role: 'tech' | 'plumber' | 'admin') => void; onAuth: (email: string, pw: string, mode: 'in' | 'up') => Promise<string> }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const run = async (mode: 'in' | 'up') => { setBusy(true); setMsg(''); setMsg(await onAuth(email.trim(), pw, mode)); setBusy(false); };
  return (
    <main className="login">
      <h1 className="brand">Soft Water Specialists</h1>
      <p className="muted">We diagnose. We solve. We protect what matters.</p>
      <input className="in" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="none" />
      <input className="in" placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {msg && <div className="err">{msg}</div>}
      <button className="btn" disabled={busy || !email || pw.length < 6} onClick={() => run('in')}>Sign in</button>
      <button className="btn ghost" disabled={busy || !email || pw.length < 6} onClick={() => run('up')}>Create account</button>
      <div className="or">demo (not saved to the cloud)</div>
      <div className="actions">
        <button className="link" onClick={() => onLogin('Dana Ruiz', 'tech')}>Technician</button>
        <button className="link" onClick={() => onLogin('Ortiz Plumbing & Heating', 'plumber')}>Partner</button>
        <button className="link" onClick={() => onLogin('Matt Mahany', 'admin')}>Admin</button>
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
    case 'text': return wrap(<input className="in" inputMode={f.im as any} value={val || ''} onChange={(e) => set(k, e.target.value)} />);
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
