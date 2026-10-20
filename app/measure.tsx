'use client';
import { useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };
type Key = 'ref' | 'h' | 'w' | 'd';
const LABELS: Record<Key, string> = { ref: 'Reference', h: 'Height', w: 'Width', d: 'Depth' };
const COLORS: Record<Key, string> = { ref: '#f59e0b', h: '#1f72d6', w: '#16a34a', d: '#a855f7' };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
// round to the nearest half inch, as a tech would read a tape
const half = (n: number) => Math.round(n * 2) / 2;

// Measure the install space from a photo: lay something of known length in the picture (a tape measure,
// a board), tap its two ends, then tap the two ends of each side of the space. It is an estimate.
export default function MeasureTool({ onApply }: { onApply: (m: { h?: string; w?: string; d?: string; photo: string }) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [refIn, setRefIn] = useState('24');
  const [step, setStep] = useState<Key | 'done'>('ref');
  const [pts, setPts] = useState<Record<Key, Pt[]>>({ ref: [], h: [], w: [], d: [] });
  const [applied, setApplied] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);

  const pxPerInch = pts.ref.length === 2 && Number(refIn) > 0 ? dist(pts.ref[0], pts.ref[1]) / Number(refIn) : 0;
  const inches = (k: Key) => (pts[k].length === 2 && pxPerInch ? half(dist(pts[k][0], pts[k][1]) / pxPerInch) : null);

  const onFile = (file?: File) => {
    if (!file) return;
    const i = new Image();
    i.onload = () => {
      const s = Math.min(1, 900 / i.width), c = document.createElement('canvas');
      c.width = Math.round(i.width * s); c.height = Math.round(i.height * s);
      c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height);
      const small = new Image();
      small.onload = () => { setImg(small); setPts({ ref: [], h: [], w: [], d: [] }); setStep('ref'); setApplied(false); };
      small.src = c.toDataURL('image/jpeg', 0.75);
    };
    i.src = URL.createObjectURL(file);
  };

  useEffect(() => {
    const c = cv.current;
    if (!c || !img) return;
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    (['ref', 'h', 'w', 'd'] as Key[]).forEach((k) => {
      const p = pts[k];
      if (!p.length) return;
      x.strokeStyle = x.fillStyle = COLORS[k]; x.lineWidth = Math.max(3, img.width / 220);
      if (p.length === 2) { x.beginPath(); x.moveTo(p[0].x, p[0].y); x.lineTo(p[1].x, p[1].y); x.stroke(); }
      p.forEach((q) => { x.beginPath(); x.arc(q.x, q.y, Math.max(6, img.width / 110), 0, 7); x.fill(); });
      if (p.length === 2) {
        const v = k === 'ref' ? `${refIn} in` : inches(k) != null ? `${inches(k)} in` : '';
        const fs = Math.max(18, img.width / 34);
        x.font = `800 ${fs}px sans-serif`; x.lineWidth = 5; x.strokeStyle = '#fff'; x.strokeText(`${LABELS[k]} ${v}`, (p[0].x + p[1].x) / 2 + 8, (p[0].y + p[1].y) / 2 - 8);
        x.fillStyle = COLORS[k]; x.fillText(`${LABELS[k]} ${v}`, (p[0].x + p[1].x) / 2 + 8, (p[0].y + p[1].y) / 2 - 8);
      }
    });
  }, [img, pts, refIn]); // eslint-disable-line

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (step === 'done' || !img) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * img.width, y: ((e.clientY - r.top) / r.height) * img.height };
    setApplied(false);
    setPts((cur) => {
      const next = { ...cur, [step]: cur[step].length >= 2 ? [p] : [...cur[step], p] };
      return next;
    });
  };
  // move on once both ends of the current line are placed
  useEffect(() => {
    if (step === 'done' || pts[step].length < 2) return;
    if (step === 'ref') { if (Number(refIn) > 0) setStep('h'); }
  }, [pts, step, refIn]);

  const order: Key[] = ['ref', 'h', 'w', 'd'];
  const guide: Record<Key, string> = {
    ref: 'Tap both ends of the tape or board you laid in the picture.',
    h: 'Tap the bottom, then the top of the space. This is the height.',
    w: 'Tap the left edge, then the right edge. This is the width.',
    d: 'Tap the front, then the back. This is the depth.',
  };
  const any = (['h', 'w', 'd'] as Key[]).some((k) => inches(k) != null);

  const apply = () => {
    const c = cv.current;
    onApply({
      h: inches('h') != null ? `${inches('h')} in` : undefined, w: inches('w') != null ? `${inches('w')} in` : undefined, d: inches('d') != null ? `${inches('d')} in` : undefined,
      photo: c ? c.toDataURL('image/jpeg', 0.7) : '',
    });
    setApplied(true);
  };

  return (
    <div className="field">
      <label className="lbl">Measure the space from a photo</label>
      {!img && (
        <>
          <div className="card"><b>How it works</b>
            <ol className="steps"><li>Lay a <b>tape measure or a board of known length</b> in the install area.</li><li>Take a photo from straight on, with the whole space in view.</li><li>Tap the ends of the tape, then the height, width and depth.</li></ol>
            <div className="muted">This gives an estimate. Check the numbers with a tape before ordering equipment.</div></div>
          <label className="btn filebtn"><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />Take photo to measure</label>
        </>
      )}
      {img && (
        <>
          <div className="field"><label className="lbl">Length of your reference, in inches</label><input className="in" inputMode="decimal" value={refIn} onChange={(e) => { setRefIn(e.target.value); setApplied(false); }} /></div>
          <div className="steppills">
            {order.map((k) => <button key={k} className={(step === k ? 'on ' : '') + (k === 'ref' ? (pts.ref.length === 2 ? 'ok' : '') : inches(k) != null ? 'ok' : '')} onClick={() => { setStep(k); setPts((c) => ({ ...c, [k]: [] })); setApplied(false); }}>{LABELS[k]}{k !== 'ref' && inches(k) != null ? ` ${inches(k)} in` : ''}</button>)}
          </div>
          <div className="muted">{step === 'done' ? 'Done. Apply the numbers below.' : guide[step as Key]}</div>
          <canvas ref={cv} className="measurecv" onPointerDown={tap} style={{ touchAction: 'none' }} />
          {step === 'ref' && pts.ref.length === 2 && !(Number(refIn) > 0) && <div className="err">Enter the length of the reference in inches.</div>}
          <div className="btnrow wrap">
            {step !== 'ref' && step !== 'done' && order.indexOf(step) < 3 && pts[step].length === 2 && <button className="btn ghost sm" onClick={() => setStep(order[order.indexOf(step) + 1])}>Next side</button>}
            {step === 'd' && pts.d.length === 2 && <button className="btn ghost sm" onClick={() => setStep('done')}>Finished tapping</button>}
            <label className="btn ghost sm filebtn"><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />Retake photo</label>
          </div>
          <button className="btn" disabled={!any} onClick={apply}>{applied ? 'Numbers added below ✓' : 'Use these measurements'}</button>
          <div className="muted">Estimates are rounded to the half inch. You can change the numbers below by hand.</div>
        </>
      )}
    </div>
  );
}
