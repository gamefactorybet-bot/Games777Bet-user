import { useEffect, useRef } from 'react';
import type { RuletaSlot } from './types.ts';

const TAU = Math.PI * 2;

// La rueda en canvas. Tajadas iguales; el puntero apunta arriba. Cuando
// `objetivo` pasa de null a un índice, gira hasta dejar esa tajada bajo
// el puntero y avisa por `onLlegada`. El resultado lo decide siempre
// quien pasa el `objetivo` (servidor o motor local), nunca la animación.
export function Ruleta({ slots, objetivo, onLlegada }: {
  slots: RuletaSlot[];
  objetivo: number | null;
  onLlegada?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const rafRef = useRef(0);
  const ganadoraRef = useRef<number | null>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const dibujar = () => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const W = cv.width;
    const R = W / 2;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(rotRef.current);

    const arr = slotsRef.current;
    const n = arr.length || 1;
    const slice = TAU / n;
    const ang0 = -Math.PI / 2 - slice / 2;

    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const a0 = ang0 + i * slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 6, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = s.color || '#2a2f38';
      ctx.fill();
      if (i === ganadoraRef.current) {
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(12,14,18,.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0 + slice / 2 + Math.PI / 2);
      ctx.translate(0, -(R * 0.72));
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${n > 44 ? 13 : n > 26 ? 17 : 22}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 3;
      ctx.fillText(s.et, 0, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, R - 5, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  };

  // Redibujar cuando cambian las tajadas (editor en vivo).
  useEffect(() => {
    ganadoraRef.current = null;
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // Girar hasta el objetivo.
  useEffect(() => {
    if (objetivo == null || !slots.length) return;
    const n = slots.length;
    const slice = TAU / n;
    const mid = objetivo * slice;
    const jitter = (Math.random() - 0.5) * slice * 0.6;
    const vueltas = reduce ? 1 : 6;
    let target = rotRef.current - (((rotRef.current % TAU) + TAU) % TAU) - mid - jitter + TAU * vueltas;
    while (target <= rotRef.current + TAU * (vueltas - 1)) target += TAU;

    const desde = rotRef.current;
    const dur = reduce ? 320 : 4200;
    const ini = performance.now();
    ganadoraRef.current = null;

    const paso = (now: number) => {
      const p = Math.min(1, (now - ini) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      rotRef.current = desde + (target - desde) * e;
      dibujar();
      if (p < 1) {
        rafRef.current = requestAnimationFrame(paso);
      } else {
        ganadoraRef.current = objetivo;
        dibujar();
        onLlegada?.();
      }
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
        borderTop: '16px solid #e7eaef', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.5))', zIndex: 2,
      }} />
      <canvas ref={canvasRef} width={600} height={600} style={{ width: '100%', display: 'block' }} />
    </div>
  );
}
