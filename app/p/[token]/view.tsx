'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sig } from '../../sig';

type Snap = {
  number?: string; date?: string; address?: string; preparedBy?: string; source?: string;
  option?: string; sub?: string; total?: number; monthly?: number; deposit?: number;
  items?: { name: string }[]; tiers?: { name: string; sub: string; total: number; monthly: number }[];
  findings?: { label: string; value: string }[]; why?: { name: string; because: string }[];
  company?: { name?: string; phone?: string; web?: string };
};
type View = {
  status: 'draft' | 'sent' | 'signed'; company_name: string; customer_name?: string | null;
  brand: { logo?: string; color?: string; dark?: string; phone?: string; web?: string; tagline?: string };
  snapshot: Snap; signed_at?: string | null; signed_name?: string | null; signature?: string | null;
};

const CONSENT = 'I agree to sign this proposal electronically. My typed name and drawn signature are my legal signature.';
const money = (n?: number) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');

export default function ProposalView({ token }: { token: string }) {
  const [v, setV] = useState<View | null | undefined>(undefined);
  const [name, setName] = useState(''), [sig, setSig] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');

  useEffect(() => {
    supabase.rpc('get_proposal', { p_token: token }).then(({ data }) => {
      setV((data as View) || null);
      if (data?.customer_name) setName(data.customer_name);
    });
  }, [token]);

  useEffect(() => {
    if (!v) return;
    const r = document.documentElement.style;
    r.setProperty('--accent', v.brand.color || '#1f72d6'); r.setProperty('--navy9', v.brand.dark || '#0b2a5c'); r.setProperty('--navy8', v.brand.dark || '#0e3472');
    document.title = `Proposal for ${v.customer_name || 'you'} · ${v.company_name}`;
  }, [v]);

  const sign = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('sign_proposal', { p_token: token, p_name: name, p_signature: sig, p_consent: CONSENT, p_agent: navigator.userAgent });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setV(data as View);
    supabase.functions.invoke('proposal-email', { body: { action: 'signed', token } });
  };

  if (v === undefined) return <main className="doc"><div className="docpage">Loading your proposal…</div></main>;
  if (v === null) return <main className="doc"><div className="docpage"><h2>We could not find that proposal</h2><p className="muted">The link may be incomplete. Please ask for a new one.</p></div></main>;

  const s = v.snapshot, b = v.brand, signed = v.status === 'signed';
  const others = (s.tiers || []).filter((t) => t.name !== s.option);
  const phone = b.phone || s.company?.phone, web = b.web || s.company?.web;

  return (
    <main className="doc">
      <article className="docpage">
        <header className="dochead">
          <div className="dochead-brand">{b.logo ? <img src={b.logo} alt={v.company_name} className="doclogo" /> : <b className="docname">{v.company_name}</b>}</div>
          <div className="dochead-meta"><div className="docword">Proposal</div>{s.number && <div>No. {s.number}</div>}<div>{day(s.date)}</div></div>
        </header>

        <section className="docparties">
          <div><div className="cap">Prepared for</div><b>{v.customer_name || 'You'}</b>{s.address && <div>{s.address}</div>}</div>
          <div><div className="cap">Prepared by</div><b>{s.preparedBy || v.company_name}</b><div>{v.company_name}</div>{phone && <div>{phone}</div>}{web && <div>{web}</div>}</div>
        </section>

        {(s.findings?.length || 0) > 0 && (
          <section className="docsec">
            <h2>What we found</h2>
            <p className="docp">{s.source ? `Water source: ${s.source}. ` : ''}These are the results from testing your water{s.address ? ' at your home' : ''}.</p>
            <table className="doctable"><tbody>{s.findings!.map((f) => <tr key={f.label}><td>{f.label}</td><td className="r"><b>{f.value}</b></td></tr>)}</tbody></table>
          </section>
        )}

        <section className="docsec">
          <h2>Our recommendation: the {s.option} option</h2>
          {s.sub && <p className="docp">{s.sub}.</p>}
          {(s.why?.length || 0) > 0 && (
            <ul className="docwhy">{s.why!.map((w) => <li key={w.name}><b>{w.name}</b><span>{w.because}</span></li>)}</ul>
          )}
          <div className="cap" style={{ marginTop: 16 }}>What is included</div>
          <ul className="docitems">{(s.items || []).map((i, k) => <li key={k}><span className="tick">✓</span>{i.name}</li>)}</ul>
        </section>

        <section className="docsec">
          <h2>Your investment</h2>
          <table className="doctable">
            <tbody>
              <tr className="big"><td>Total</td><td className="r">{money(s.total)}</td></tr>
              <tr><td>Deposit to schedule the work</td><td className="r">{money(s.deposit)}</td></tr>
              <tr><td>Estimated monthly payment, if financed</td><td className="r">{money(s.monthly)}/mo</td></tr>
            </tbody>
          </table>
          <p className="docfine">The monthly payment is an estimate. Final financing terms are confirmed with the lender.</p>
          {others.length > 0 && (
            <>
              <div className="cap" style={{ marginTop: 16 }}>Other options we talked about</div>
              <table className="doctable">
                <tbody>{others.map((t) => <tr key={t.name}><td>{t.name} <span className="muted">· {t.sub}</span></td><td className="r">{money(t.total)}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </section>

        <section className="docsec docsign">
          <h2>Approval</h2>
          {signed ? (
            <>
              <p className="docp">By signing, <b>{v.signed_name}</b> approved the <b>{s.option}</b> option for <b>{money(s.total)}</b>.</p>
              {v.signature && <img src={v.signature} alt="Signature" className="docsig" />}
              <div className="docsigline"><b>{v.signed_name}</b><span>Signed electronically on {v.signed_at ? new Date(v.signed_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''}</span></div>
              <button className="btn ghost noprint" onClick={() => window.print()}>Print or save a copy</button>
              <p className="docfine noprint">A copy was also emailed to you, if you gave us an email address.</p>
            </>
          ) : (
            <>
              <p className="docp">There is no rush. This link stays open, so you can come back and sign whenever you are ready. By signing you approve the <b>{s.option}</b> option for <b>{money(s.total)}</b>.</p>
              <div className="field"><label className="lbl">Your full name</label><input className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
              <div className="field"><label className="lbl">Sign here with your finger or mouse</label><Sig value={sig} onChange={setSig} /></div>
              <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />{CONSENT}</label>
              {err && <div className="err">{err}</div>}
              <button className="btn" disabled={busy || !ok || name.trim().length < 2 || sig.length < 300} onClick={sign}>{busy ? 'Signing…' : 'Sign the proposal'}</button>
            </>
          )}
        </section>

        <footer className="docfoot">
          <b>{v.company_name}</b>
          <span>{[phone, web].filter(Boolean).join('  ·  ')}</span>
        </footer>
      </article>
    </main>
  );
}
