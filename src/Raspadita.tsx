import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FondoLoop } from './FondoLoop.tsx';
import { montarLottieEn } from './lottie.ts';
import { cargarFuenteRaspa } from './juego/raspadita-temas.ts';
import type { TemaRaspa } from './juego/raspadita-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { Juego, PosControlesRaspa, RaspaCfg, TiradaRaspa } from './types.ts';

interface RaspaditaProps {
  escenario: Escenario;
  juego: Juego;
  cfg: RaspaCfg;
  tema: TemaRaspa;
  pos: PosControlesRaspa;
  /** Tarjeta resuelta por el servidor; null = nada para raspar. */
  tirada: TiradaRaspa | null;
  /** Apuesta de la tarjeta actual — para el contador de la ganancia. */
  apuesta: number;
  /** Monto de demo para ubicar el cartel de la ganancia desde ⚙ Ajustar. */
  premioDemo?: number | null;
  /** Se llama cuando el jugador terminó de raspar. Pasa el multiplicador. */
  onRevelar: (mult: number) => void;
}

const cols = 3;
const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

// La tarjeta de la raspadita: la grilla de símbolos y la capa gris
// que el jugador raspa con el dedo. El resultado ya lo decidió el
// servidor; acá solo se descubre.
export function Raspadita({ escenario, juego, cfg, tema, pos, tirada, apuesta, premioDemo, onRevelar }: RaspaditaProps) {
  const fondoPantalla = (juego.fondo_url as string) || null;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const onRevelarRef = useRef(onRevelar); onRevelarRef.current = onRevelar;
  const reveladoRef = useRef(false);
  const limpiezasRef = useRef<Array<() => void>>([]);

  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- tema ----
  useEffect(() => {
    cargarFuenteRaspa(tema);
    const el = escenario.el;
    const prevBg = el.style.background;
    if (tema.stageBg && !fondoPantalla) el.style.background = tema.stageBg;
    const claves = Object.keys(tema.vars);
    for (const k of claves) el.style.setProperty(k, tema.vars[k]);
    if (tema.font) el.style.setProperty('--rs-body', tema.font.family);
    return () => {
      el.style.background = prevBg;
      for (const k of claves) el.style.removeProperty(k);
      el.style.removeProperty('--rs-body');
    };
  }, [tema, escenario, fondoPantalla]);

  // ---- render de la grilla cuando llega una tarjeta nueva ----
  useEffect(() => {
    limpiezasRef.current.forEach((fn) => fn());
    limpiezasRef.current = [];
    reveladoRef.current = false;

    const grid = gridRef.current;
    if (!grid) return;

    const N = cfg.celdas;
    const filas = Math.max(1, Math.round(N / cols));
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${filas}, 1fr)`;
    grid.innerHTML = '';

    const idx = tirada ? tirada.grilla : new Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      const cell = document.createElement('div');
      cell.className = 'rs-cel';
      cell.dataset.i = String(i);
      const si = idx[i];
      const sym = si >= 0 ? cfg.simbolos[si] : null;
      if (sym) {
        if (sym.icono_url) {
          const im = document.createElement('img');
          im.src = sym.icono_url;
          im.alt = sym.nombre;
          im.className = 'rs-ico';
          cell.appendChild(im);
        } else {
          const sp = document.createElement('span');
          sp.className = 'rs-emoji';
          sp.textContent = sym.emoji || '⭐';
          cell.appendChild(sp);
        }
      } else {
        const sp = document.createElement('span');
        sp.className = 'rs-emoji rs-vacia';
        sp.textContent = '?';
        cell.appendChild(sp);
      }
      grid.appendChild(cell);
    }

    // canvas listo para raspar solo si hay tarjeta
    if (tirada) montarCobertura();
    else cubrirEntero();

    return () => { limpiezasRef.current.forEach((fn) => fn()); limpiezasRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tirada, cfg.celdas, cfg.simbolos, cfg.cobertura.color, cfg.cobertura.imagen_url, tema.cobertura]);

  function cubrirEntero() {
    const cv = canvasRef.current;
    const ctx = prepararCanvas();
    if (!cv || !ctx) return;
    pintarCobertura(ctx);
    cv.style.pointerEvents = 'none';
  }

  function prepararCanvas() {
    const cv = canvasRef.current;
    const host = hostRef.current;
    if (!cv || !host) return null;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return null;
    cv.style.transition = '';
    cv.style.opacity = '1';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 40;
    return ctx;
  }

  function pintarCobertura(ctx: CanvasRenderingContext2D) {
    const W = hostRef.current?.clientWidth || 300;
    const H = hostRef.current?.clientHeight || 300;
    const color = cfg.cobertura.color || tema.cobertura || '#6b7280';
    const img = coberturaImgRef.current;
    ctx.globalCompositeOperation = 'source-over';
    if (img) {
      ctx.drawImage(img, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, aclarar(color, 14));
      g.addColorStop(.5, oscurecer(color, 10));
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.font = `600 ${Math.max(12, Math.round(W / 16))}px ${tema.font?.family || 'Inter, system-ui, sans-serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦  raspá acá  ✦', W / 2, H / 2);
    }
  }

  const coberturaImgRef = useRef<HTMLImageElement | null>(null);
  const tiradaRef = useRef<TiradaRaspa | null>(tirada);
  tiradaRef.current = tirada;
  const apuestaRef = useRef(apuesta);
  apuestaRef.current = apuesta;
  const posRef = useRef(pos);
  posRef.current = pos;
  const animMontoRef = useRef(0);

  useEffect(() => {
    if (!cfg.cobertura.imagen_url) { coberturaImgRef.current = null; return; }
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      coberturaImgRef.current = im;
      // Si la tapa ya está puesta (todavía sin raspar), la repintamos
      // ahora con la imagen — así no se ve el degradado por defecto
      // hasta la primera jugada.
      if (!tiradaRef.current && !reveladoRef.current) cubrirEntero();
    };
    im.onerror = () => { coberturaImgRef.current = null; };
    im.src = cfg.cobertura.imagen_url;
  }, [cfg.cobertura.imagen_url]);

  function montarCobertura() {
    const cv = canvasRef.current;
    const ctx = prepararCanvas();
    if (!cv || !ctx) { setTimeout(montarCobertura, 40); return; }
    pintarCobertura(ctx);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    cv.style.pointerEvents = 'auto';
    cv.style.opacity = '1';

    const W = hostRef.current?.clientWidth || 300;
    const H = hostRef.current?.clientHeight || 300;
    // Radio del "dedo" en px de CSS, relativo al tamaño de la tarjeta.
    const R = Math.max(16, Math.round(Math.min(W, H) * 0.11));
    ctx.lineWidth = R * 2;

    // Cobertura por grilla gruesa: barato y fluido (nada de getImageData
    // en cada movimiento, que en el celular trababa todo).
    const GX = 24, GY = 24;
    const marcado = new Uint8Array(GX * GY);
    let marcadas = 0;
    const marcar = (x: number, y: number) => {
      const rgx = (R / W) * GX, rgy = (R / H) * GY;
      const cx = (x / W) * GX, cy = (y / H) * GY;
      for (let gy = Math.max(0, Math.floor(cy - rgy)); gy <= Math.min(GY - 1, Math.ceil(cy + rgy)); gy++) {
        for (let gx = Math.max(0, Math.floor(cx - rgx)); gx <= Math.min(GX - 1, Math.ceil(cx + rgx)); gx++) {
          const i = gy * GX + gx;
          if (!marcado[i]) { marcado[i] = 1; marcadas++; }
        }
      }
    };

    let raspando = false;
    let ultimo: { x: number; y: number } | null = null;
    let pid: number | null = null;

    const punto = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const revelar = () => {
      if (reveladoRef.current) return;
      reveladoRef.current = true;
      cv.style.transition = 'opacity .3s ease';
      cv.style.opacity = '0';
      setTimeout(() => { cv.style.pointerEvents = 'none'; }, 320);
      festejar();
      onRevelarRef.current(tirada ? tirada.mult : 0);
    };
    const raspar = (x: number, y: number) => {
      if (reveladoRef.current) return;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      if (ultimo) { ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(x, y); ctx.stroke(); }
      ultimo = { x, y };
      marcar(x, y);
      if (marcadas / (GX * GY) > 0.55) revelar();
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      raspando = true; ultimo = null; pid = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch { /* noop */ }
      const p = punto(e); raspar(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      if (!raspando) return;
      e.preventDefault();
      // getCoalescedEvents: en el celular junta varios movimientos en un
      // solo evento — así la línea sale continua y no a saltos.
      const conCoalesced = e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
      const evs = conCoalesced.getCoalescedEvents ? conCoalesced.getCoalescedEvents() : [e];
      for (const ev of evs) { const p = punto(ev); raspar(p.x, p.y); }
    };
    const onUp = () => {
      raspando = false; ultimo = null;
      if (pid != null) { try { cv.releasePointerCapture(pid); } catch { /* noop */ } pid = null; }
      if (!reveladoRef.current && marcadas / (GX * GY) > 0.3) revelar();
    };

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    limpiezasRef.current.push(() => {
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
    });

    // por si nunca la termina de raspar: revelar solo a los 12s
    const tope = setTimeout(() => revelar(), 12000);
    limpiezasRef.current.push(() => clearTimeout(tope));
  }

  function festejar() {
    if (!tirada || !gridRef.current) return;
    const cells = gridRef.current.querySelectorAll<HTMLDivElement>('.rs-cel');
    for (const idx of tirada.ganadoras) {
      const cell = cells[idx];
      if (!cell) continue;
      cell.classList.add('rs-win');
      if (cfg.animGanar_url && !reduce) {
        const cont = document.createElement('div');
        cont.className = 'rs-anim';
        cell.appendChild(cont);
        montarLottieEn(cont, cfg.animGanar_url, { loop: false }).then((off) => {
          limpiezasRef.current.push(off);
          setTimeout(() => { off(); cont.remove(); }, 3200);
        });
      }
    }
    if (tirada.mult > 0) {
      mostrarPremio(Math.round(apuestaRef.current * tirada.mult), tirada.mult);
    }
  }

  // Cartel de la ganancia: contador que sube, en la posición que fijó
  // el operador (⚙ Ajustar → Ganancia). Vive en el escenario, no en la
  // tarjeta, así se puede poner en cualquier lado de la pantalla.
  function mostrarPremio(ganancia: number, mult: number) {
    const p = posRef.current.premio;
    const box = document.createElement('div');
    box.className = 'rs-premio';
    box.style.left = `${p.x}%`;
    box.style.top = `${p.y}%`;

    const inner = document.createElement('div');
    inner.className = 'rs-premio-in rs-premio-pop';
    inner.style.setProperty('--rs-ganar', tema.ganar);

    const monto = document.createElement('strong');
    monto.className = 'rs-monto';
    monto.textContent = '+0';
    const sub = document.createElement('span');
    sub.className = 'rs-mult';
    sub.textContent = '×' + (Math.round(mult * 100) / 100);
    inner.append(monto, sub);
    box.append(inner);
    escenario.el.appendChild(box);
    limpiezasRef.current.push(() => box.remove());

    cancelAnimationFrame(animMontoRef.current);
    const dur = reduce ? 0 : Number((juego.contador_ms as number) ?? 900);
    if (dur <= 0) { monto.textContent = '+' + fmt(ganancia); return; }
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / dur);
      const suave = 1 - Math.pow(1 - t, 3);
      monto.textContent = '+' + fmt(ganancia * suave);
      if (t < 1) animMontoRef.current = requestAnimationFrame(paso);
      else monto.textContent = '+' + fmt(ganancia);
    };
    animMontoRef.current = requestAnimationFrame(paso);
    limpiezasRef.current.push(() => cancelAnimationFrame(animMontoRef.current));
  }

  const T = pos.tarjeta;
  const filas = Math.max(1, Math.round(cfg.celdas / cols));

  return createPortal(
    <>
    {fondoPantalla && <FondoLoop url={fondoPantalla} />}
    <div
      ref={hostRef}
      className="rs-host"
      style={{
        position: 'absolute', left: `${T.x}%`, top: `${T.y}%`, transform: 'translate(-50%,-50%)',
        width: T.ancho, aspectRatio: `${cols} / ${filas}`,
        borderRadius: 14, overflow: 'hidden', zIndex: 9, containerType: 'inline-size',
        background: cfg.fondoUrl ? `center/cover no-repeat url("${cfg.fondoUrl}")` : 'var(--surface-alt, #1b1f27)',
        boxShadow: '0 18px 44px -18px rgba(0,0,0,.6)',
        ['--rs-ganar' as string]: tema.ganar,
      }}
    >
      <style>{`
        .rs-host .rs-grid {
          position:absolute; inset:8px; display:grid; gap:6px;
        }
        .rs-host .rs-cel {
          position:relative; border-radius:9px; display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
          ${cfg.celda.imagen_url ? `background:center/100% 100% no-repeat url("${cfg.celda.imagen_url}"); border:0;` : ''}
        }
        .rs-host .rs-ico { width:66%; height:66%; object-fit:contain; }
        .rs-host .rs-emoji { font-size:clamp(20px, 8cqw, 40px); line-height:1; }
        .rs-host .rs-vacia { opacity:.25; font-weight:700; }
        .rs-host .rs-cel.rs-win {
          background:color-mix(in srgb, var(--rs-ganar) 16%, transparent);
          box-shadow: inset 0 0 0 2px var(--rs-ganar), 0 0 16px -2px var(--rs-ganar);
          animation: rs-cel-pop .4s ease;
        }
        @keyframes rs-cel-pop { 0%{transform:scale(.9)} 60%{transform:scale(1.08)} 100%{transform:scale(1)} }
        .rs-host .rs-anim { position:absolute; inset:0; pointer-events:none; }
        .rs-host canvas.rs-cover { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; -webkit-user-select:none; user-select:none; }

        /* Cartel de la ganancia — vive en el escenario, posicionable. */
        .rs-premio { position:absolute; transform:translate(-50%,-50%); z-index:16; pointer-events:none; }
        .rs-premio .rs-premio-in {
          display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center;
          background:rgba(0,0,0,.5); padding:10px 22px; border-radius:16px;
          border:1px solid color-mix(in srgb, var(--rs-ganar) 55%, transparent);
        }
        .rs-premio .rs-premio-in.rs-premio-pop { animation: rs-premio-pop .38s cubic-bezier(.2,1.3,.4,1); }
        @keyframes rs-premio-pop { 0%{transform:scale(.7); opacity:0} 100%{transform:scale(1); opacity:1} }
        .rs-premio .rs-monto {
          font-family:var(--rs-font-display, var(--rs-body, inherit)); font-weight:800;
          font-size:34px; line-height:1; color:var(--rs-ganar);
          font-variant-numeric:tabular-nums; text-shadow:0 2px 12px rgba(0,0,0,.55);
        }
        .rs-premio .rs-mult {
          font-family:var(--rs-body, monospace); font-size:12px; font-weight:600;
          color:color-mix(in srgb, var(--rs-ganar) 80%, #fff); opacity:.85;
        }
        @media (prefers-reduced-motion: reduce) {
          .rs-host .rs-cel.rs-win, .rs-premio .rs-premio-in.rs-premio-pop { animation:none }
        }
      `}</style>
      <div ref={gridRef} className="rs-grid" style={{ containerType: 'inline-size' }} />
      <canvas ref={canvasRef} className="rs-cover" />
    </div>
    {premioDemo != null && premioDemo > 0 && (
      <div className="rs-premio" style={{ left: `${pos.premio.x}%`, top: `${pos.premio.y}%` }}>
        <div className="rs-premio-in" style={{ ['--rs-ganar' as string]: tema.ganar }}>
          <strong className="rs-monto">+{fmt(premioDemo)}</strong>
          <span className="rs-mult">×2</span>
        </div>
      </div>
    )}
    </>,
    escenario.el,
  );
}

// --- utilidades de color (sin dependencias) ---
function hexToRgb(h: string): [number, number, number] {
  const m = h.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const v = parseInt(n.slice(0, 6) || '6b7280', 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mezclar(h: string, delta: number): string {
  if (!h.startsWith('#')) return h;
  const [r, g, b] = hexToRgb(h);
  const f = (x: number) => Math.max(0, Math.min(255, Math.round(x + delta)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
const aclarar = (h: string, d: number) => mezclar(h, d);
const oscurecer = (h: string, d: number) => mezclar(h, -d);
