import { useEffect, useRef } from 'react';
import type { RuletaSlot } from './types.ts';
import type { TemaRuletaWheel } from './juego/ruleta-temas.ts';

const TAU = Math.PI * 2;
const SIZE = 600;        // resolución del bitmap
const R = SIZE / 2;

// La rueda en canvas. Tajadas iguales; el puntero apunta arriba. Cuando
// `objetivo` pasa de null a un índice, gira hasta dejar esa tajada bajo
// el puntero y avisa por `onLlegada`. El resultado lo decide siempre
// quien pasa el `objetivo` (servidor o motor local), nunca la animación.
//
// La rueda estática (tajadas + texto + imágenes) se dibuja una sola vez
// en un canvas fuera de pantalla; cada cuadro de la animación es un
// único `drawImage` rotado, así el giro va fluido también en el celular.
export function Ruleta({ slots, objetivo, onLlegada, tema }: {
  slots: RuletaSlot[];
  objetivo: number | null;
  onLlegada?: () => void;
  /** Estética de la rueda (colores del puntero, aro, cubo, glow). */
  tema?: TemaRuletaWheel;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef(0);
  const rafRef = useRef(0);
  const ganadoraRef = useRef<number | null>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const temaRef = useRef(tema);
  temaRef.current = tema;
  const imgRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Compone el bitmap ya dibujado sobre el canvas visible, con la
  // rotación actual y (al final) el resaltado de la tajada ganadora.
  const pintar = () => {
    const cv = canvasRef.current;
    const off = offRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !off) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(rotRef.current);
    ctx.drawImage(off, -R, -R);
    const g = ganadoraRef.current;
    if (g != null) {
      const n = slotsRef.current.length || 1;
      const slice = TAU / n;
      const a0 = -Math.PI / 2 - slice / 2 + g * slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 6, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = temaRef.current?.winner || 'rgba(255,255,255,.28)';
      ctx.fill();
    }
    ctx.restore();
  };

  // Redibuja la rueda estática en el canvas fuera de pantalla. Es lo
  // caro: solo corre al cambiar tajadas/tema o al cargar una imagen.
  const rehacerRueda = () => {
    let off = offRef.current;
    if (!off) {
      off = document.createElement('canvas');
      off.width = SIZE;
      off.height = SIZE;
      offRef.current = off;
    }
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const arr = slotsRef.current;
    const n = arr.length || 1;
    const slice = TAU / n;
    const ang0 = -Math.PI / 2 - slice / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(R, R);

    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const a0 = ang0 + i * slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 6, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = s.color || '#2a2f38';
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,14,18,.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0 + slice / 2 + Math.PI / 2);

      const im = s.img ? imgRef.current.get(s.img) : null;
      if (im && im.complete && im.naturalWidth) {
        const sz = n > 44 ? 13 : n > 26 ? 18 : 26;
        ctx.drawImage(im, -sz / 2, -(R * 0.68) - sz / 2, sz, sz);
      }

      ctx.translate(0, -(R * (im ? 0.88 : 0.72)));
      ctx.fillStyle = '#fff';
      ctx.font = im
        ? `700 ${n > 44 ? 12 : n > 26 ? 16 : 21}px Inter, system-ui, sans-serif`
        : `700 ${n > 44 ? 13 : n > 26 ? 17 : 22}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 3;
      ctx.fillText(s.et, 0, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, R - 5, 0, TAU);
    ctx.strokeStyle = temaRef.current?.ring || 'rgba(255,255,255,.10)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    pintar();
  };

  // Precargar las imágenes de las tajadas; rehacer la rueda al caer.
  useEffect(() => {
    const cache = imgRef.current;
    let vivo = true;
    for (const s of slots) {
      if (!s.img || cache.has(s.img)) continue;
      const im = new Image();
      im.onload = () => { if (vivo) rehacerRueda(); };
      im.onerror = () => {};
      im.src = s.img;
      cache.set(s.img, im);
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // Rehacer la rueda cuando cambian las tajadas (editor en vivo) o el tema.
  useEffect(() => {
    ganadoraRef.current = null;
    rehacerRueda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, tema]);

  // Girar hasta el objetivo.
  useEffect(() => {
    if (objetivo == null || !slots.length) return;
    const n = slots.length;
    const slice = TAU / n;
    const mid = objetivo * slice;
    const jitter = (Math.random() - 0.5) * slice * 0.45;
    const vueltas = reduce ? 1 : 6;
    let target = rotRef.current - (((rotRef.current % TAU) + TAU) % TAU) - mid - jitter + TAU * vueltas;
    while (target <= rotRef.current + TAU * (vueltas - 1)) target += TAU;

    const desde = rotRef.current;
    const dur = reduce ? 340 : 4800;
    const ini = performance.now();
    ganadoraRef.current = null;

    const paso = (now: number) => {
      const p = Math.min(1, (now - ini) / dur);
      // Ease-out suave: arranca rápido y la última porción se arrastra
      // despacio (sin llegar a congelarse) para dar suspenso.
      const e = 1 - Math.pow(1 - p, 2.6);
      rotRef.current = desde + (target - desde) * e;
      pintar();
      if (p < 1) {
        rafRef.current = requestAnimationFrame(paso);
      } else {
        ganadoraRef.current = objetivo;
        pintar();
        onLlegada?.();
      }
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo]);

  const conHub = !!tema && tema.hub !== 'transparent';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
        borderTop: `16px solid ${tema?.pointer || '#e7eaef'}`, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.5))', zIndex: 3,
      }} />
      <div style={{
        borderRadius: '50%', boxSizing: 'border-box',
        border: tema ? `5px solid ${tema.border}` : undefined,
        boxShadow: tema?.glow && tema.glow !== 'none' ? tema.glow : undefined,
      }}>
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: '100%', display: 'block', borderRadius: '50%' }} />
      </div>
      {conHub && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          width: '25%', height: '25%', borderRadius: '50%', background: tema!.hub,
          border: `2px solid ${tema!.hubBorder}`, pointerEvents: 'none', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,.35), 0 6px 18px rgba(0,0,0,.4)',
        }}>
          <span style={{
            fontFamily: 'var(--rb-font-display, inherit)', fontSize: 'clamp(6px, 2.3vw, 11px)',
            letterSpacing: 2, fontWeight: 800, color: tema!.hubInk,
          }}>SORPRESA</span>
        </div>
      )}
    </div>
  );
}
