'use client';
import { useEffect, useRef } from 'react';

export function Sig({ value, onChange }: { value?: string; onChange: (d: string) => void }) {
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
