'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sig } from '../../sig';

type View = {
  status: 'draft' | 'sent' | 'signed'; company_name: string; customer_name?: string | null;
  brand: { logo?: string; color?: string; dark?: string; phone?: string; web?: string };
  snapshot: { option?: string; sub?: string; total?: number; monthly?: number; deposit?: number; items?: { name: string }[]; tiers?: { name: string; sub: string; total: number; monthly: number }[] };
  signed_at?: string | null; signed_name?: string | null; signature?: string | null;
};

const CONSENT = 'I agree to sign this proposal electronically. My typed name and drawn signature are my legal signature.';
const money = (n?: number) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

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
    document.title = `${v.company_name}: your water plan`;
  }, [v]);

  const sign = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('sign_proposal', { p_token: token, p_name: name, p_signature: sig, p_consent: CONSENT, p_agent: navigator.userAgent });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setV(data as View);
    supabase.functions.invoke('proposal-email', { body: { action: 'signed', token } });
  };

  if (v === undefined) return <main className="pub"><div className="pubbody">Loading your proposal…</div></main>;
  if (v === null) return <main className="pub"><div className="pubbody"><h2>We could not find that proposal</h2><p className="muted">The link may be incomplete. Please ask for a new one.</p></div></main>;

  const s = v.snapshot, b = v.brand, signed = v.status === 'signed';
  const logo = b.logo ? <img src={b.logo} alt={v.company_name} className="publogo" /> : <b className="pubname">{v.company_name}</b>;
  const others = (s.tiers || []).filter((t) => t.name !== s.option);

  return (
    <main className="pub">
      <header className="pubhead">{logo}<div className="kicker" style={{ marginTop: 18 }}>Prepared for {v.customer_name || 'you'}</div><h1>Your water plan</h1></header>
      <div className="pubbody">
        {signed && (
          <div className="okmsg"><b>Signed.</b> Thank you, {v.signed_name}. This proposal was signed electronically on {v.signed_at ? new Date(v.signed_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''}.</div>
        )}
        <div className="card best">
          <h3>{s.option} option</h3>
          <div className="muted">{s.sub}</div>
          <ul>{(s.items || []).map((i, k) => <li key={k}>{i.name}</li>)}</ul>
          <div className="between"><span className="muted">Investment</span><b>{money(s.total)}</b></div>
          <div className="between"><span className="muted">Or financed (estimate)</span><b>{money(s.monthly)}/mo</b></div>
          <div className="between"><span className="muted">Deposit</span><b>{money(s.deposit)}</b></div>
        </div>
        {others.length > 0 && (
          <div className="card"><b>Other options we talked about</b>
            {others.map((t) => <div key={t.name} className="between"><span>{t.name} <span className="muted">· {t.sub}</span></span><b>{money(t.total)}</b></div>)}
          </div>
        )}
        {signed ? (
          <div className="card"><b>Signature</b>{v.signature && <img src={v.signature} alt="Signature" className="pubsig" />}<div className="muted">{v.signed_name}</div>
            <button className="btn ghost" onClick={() => window.print()}>Print or save a copy</button>
            <div className="muted">A copy was also sent to your email, if you gave us one.</div></div>
        ) : (
          <div className="card">
            <h3>Ready to go ahead?</h3>
            <div className="muted">There is no rush. This link stays open, so you can come back and sign whenever you are ready.</div>
            <div className="field"><label className="lbl">Your full name</label><input className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div className="field"><label className="lbl">Sign here with your finger or mouse</label><Sig value={sig} onChange={setSig} /></div>
            <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />{CONSENT}</label>
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy || !ok || name.trim().length < 2 || sig.length < 300} onClick={sign}>{busy ? 'Signing…' : 'Sign the proposal'}</button>
          </div>
        )}
        <div className="muted" style={{ textAlign: 'center' }}>{v.company_name}{b.phone ? ` · ${b.phone}` : ''}{b.web ? ` · ${b.web}` : ''}</div>
      </div>
    </main>
  );
}
