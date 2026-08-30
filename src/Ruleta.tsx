import { useEffect, useRef } from 'react';
import type { RuletaSlot } from './types.ts';
import type { TemaRuletaWheel } from './juego/ruleta-temas.ts';

const TAU = Math.PI * 2;
const SIZE = 600;        // resolución del bitmap
const R = SIZE / 2;

// Giro libre (rad/ms) mientras se espera el resultado, y curva de frenado.
const OMEGA = 0.0113;     // ≈ 1.8 vueltas/seg
const OMEGA_RED = 0.006;
const MIN_LIBRE = 1400;   // ms mínimos de giro rápido antes de frenar
const K_FRENO = 2.8;      // ease-out del frenado (más alto = cola más lenta)
const VUELTAS_FRENO = 2.1; // vueltas mínimas durante el frenado

type Fase = 'idle' | 'libre' | 'frenando' | 'abortando';

// La rueda en canvas. El puntero apunta arriba.
//
// - `girando` pasa a true al tocar "Girar": la rueda arranca YA a girar
//   libre y rápido, sin esperar la respuesta del servidor.
// - cuando llega `objetivo` (el índice ganador que decide el servidor o
//   el motor local), engancha un frenado suave que la deja bajo el
//   puntero y avisa por `onLlegada`.
//
// La rueda estática (tajadas + texto + imágenes) se rasteriza una sola
// vez en un canvas fuera de pantalla; cada cuadro es un `drawImage`
// rotado, así el giro va fluido también en el celular.
export function Ruleta({ slots, objetivo, onLlegada, tema, girando = false }: {
  slots: RuletaSlot[];
  objetivo: number | null;
  onLlegada?: () => void;
  /** Estética de la rueda (colores del puntero, aro, cubo, glow). */
  tema?: TemaRuletaWheel;
  /** true desde que se toca "Girar" hasta que termina la ronda. */
  girando?: boolean;
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
  const objetivoRef = useRef(objetivo);
  objetivoRef.current = objetivo;
  const onLlegadaRef = useRef(onLlegada);
  onLlegadaRef.current = onLlegada;
  const imgRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const faseRef = useRef<Fase>('idle');
  const corriendoRef = useRef(false);
  const lastRef = useRef(0);
  const tLibreRef = useRef(0);
  const jitterRef = useRef(0);
  const frenoRef = useRef({ r0: 0, target: 0, t0: 0, dur: 1, k: K_FRENO });
  const abortRef = useRef(0);

  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const omega = reduce ? OMEGA_RED : OMEGA;

  // Compone el bitmap sobre el canvas visible con la rotación actual y
  // (al terminar) el resaltado de la tajada ganadora.
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

  // Calcula el frenado: engancha con la velocidad del giro libre (sin
  // tirón) y decelera hasta dejar `obj` bajo el puntero.
  const arrancarFreno = (obj: number, now: number) => {
    const n = slotsRef.current.length || 1;
    const slice = TAU / n;
    const r0 = rotRef.current;
    const modR = ((r0 % TAU) + TAU) % TAU;
    const k = reduce ? 1.6 : K_FRENO;
    const minV = reduce ? 0.12 : VUELTAS_FRENO;
    let target = r0 - modR - obj * slice - jitterRef.current;
    while (target < r0 + TAU * minV) target += TAU;
    const dur = Math.max(200, ((target - r0) * k) / omega);
    frenoRef.current = { r0, target, t0: now, dur, k };
    faseRef.current = 'frenando';
  };

  const bucle = (now: number) => {
    const dt = Math.min(48, now - (lastRef.current || now));
    lastRef.current = now;
    const f = faseRef.current;

    if (f === 'libre') {
      rotRef.current += omega * dt;
      const obj = objetivoRef.current;
      if (obj != null && now - tLibreRef.current >= MIN_LIBRE) arrancarFreno(obj, now);
    } else if (f === 'frenando') {
      const { r0, target, t0, dur, k } = frenoRef.current;
      const p = Math.min(1, (now - t0) / dur);
      rotRef.current = r0 + (target - r0) * (1 - Math.pow(1 - p, k));
      if (p >= 1) {
        faseRef.current = 'idle';
        corriendoRef.current = false;
        ganadoraRef.current = objetivoRef.current;
        pintar();
        onLlegadaRef.current?.();
        return;
      }
    } else if (f === 'abortando') {
      const p = Math.min(1, (now - abortRef.current) / 600);
      rotRef.current += omega * (1 - p) * dt;
      if (p >= 1) {
        faseRef.current = 'idle';
        corriendoRef.current = false;
        pintar();
        return;
      }
    } else {
      corriendoRef.current = false;
      return;
    }

    pintar();
    rafRef.current = requestAnimationFrame(bucle);
  };

  const asegurarBucle = () => {
    if (corriendoRef.current) return;
    corriendoRef.current = true;
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(bucle);
  };

  // Cancelar todo al desmontar.
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    faseRef.current = 'idle';
    corriendoRef.current = false;
  }, []);

  // Arranque instantáneo del giro libre al tocar "Girar"; aborto si la
  // ronda se cae antes de tener resultado.
  useEffect(() => {
    if (girando && !reduce && faseRef.current === 'idle') {
      const n = slotsRef.current.length || 1;
      jitterRef.current = (Math.random() - 0.5) * (TAU / n) * 0.4;
      ganadoraRef.current = null;
      tLibreRef.current = performance.now();
      faseRef.current = 'libre';
      asegurarBucle();
    } else if (!girando && faseRef.current === 'libre' && objetivoRef.current == null) {
      abortRef.current = performance.now();
      faseRef.current = 'abortando';
      asegurarBucle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [girando]);

  // Fallback: si el llamador no pasa `girando`, girar desde parado al
  // llegar el objetivo (o el camino de movimiento reducido).
  useEffect(() => {
    if (objetivo == null || !slotsRef.current.length || faseRef.current !== 'idle') return;
    const n = slotsRef.current.length;
    const slice = TAU / n;
    const r0 = rotRef.current;
    const jitter = (Math.random() - 0.5) * slice * 0.4;
    const vueltas = reduce ? 1 : 6;
    let target = r0 - (((r0 % TAU) + TAU) % TAU) - objetivo * slice - jitter + TAU * vueltas;
    while (target <= r0 + TAU * (vueltas - 1)) target += TAU;
    const dur = reduce ? 340 : 4800;
    const ini = performance.now();
    ganadoraRef.current = null;
    let id = 0;
    const paso = (now: number) => {
      const p = Math.min(1, (now - ini) / dur);
      rotRef.current = r0 + (target - r0) * (1 - Math.pow(1 - p, 2.6));
      pintar();
      if (p < 1) {
        id = requestAnimationFrame(paso);
      } else {
        ganadoraRef.current = objetivo;
        pintar();
        onLlegadaRef.current?.();
      }
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo]);

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
    if (faseRef.current === 'idle') ganadoraRef.current = null;
    rehacerRueda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, tema]);

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
