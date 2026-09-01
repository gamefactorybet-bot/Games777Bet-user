import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  /** Se llama cuando el jugador terminó de raspar. Pasa el multiplicador. */
  onRevelar: (mult: number) => void;
}

const cols = 3;

// La tarjeta de la raspadita: la grilla de símbolos y la capa gris
// que el jugador raspa con el dedo. El resultado ya lo decidió el
// servidor; acá solo se descubre.
export function Raspadita({ escenario, juego, cfg, tema, pos, tirada, onRevelar }: RaspaditaProps) {
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
    const ctx = cv.getContext('2d', { willReadFrequently: true });
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
  useEffect(() => {
    if (!cfg.cobertura.imagen_url) { coberturaImgRef.current = null; return; }
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => { coberturaImgRef.current = im; };
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

    let raspando = false;
    let ultimo: { x: number; y: number } | null = null;
    let tick = 0;
    let brochazos = 0;
    let canvasSucio = false; // una cobertura con imagen sin CORS "ensucia" el canvas

    const punto = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const frac = () => {
      if (canvasSucio) return brochazos > 55 ? 1 : 0; // fallback por si no se puede leer el canvas
      try {
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let claros = 0, m = 0;
        for (let i = 3; i < d.length; i += 41) { m++; if (d[i] < 40) claros++; }
        return claros / m;
      } catch {
        canvasSucio = true;
        return brochazos > 55 ? 1 : 0;
      }
    };
    const revelar = () => {
      if (reveladoRef.current) return;
      reveladoRef.current = true;
      cv.style.transition = 'opacity .35s ease';
      cv.style.opacity = '0';
      setTimeout(() => { cv.style.pointerEvents = 'none'; }, 360);
      festejar();
      onRevelarRef.current(tirada ? tirada.mult : 0);
    };
    const raspar = (x: number, y: number) => {
      if (reveladoRef.current) return;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
      if (ultimo) { ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(x, y); ctx.stroke(); }
      ultimo = { x, y };
      brochazos++;
      if (tick++ % 3 === 0 && frac() > 0.5) revelar();
    };

    const onDown = (e: PointerEvent) => { raspando = true; ultimo = null; const p = punto(e); raspar(p.x, p.y); };
    const onMove = (e: PointerEvent) => { if (!raspando && e.buttons !== 1) return; const p = punto(e); raspar(p.x, p.y); };
    const onUp = () => { raspando = false; ultimo = null; if (!reveladoRef.current && frac() > 0.32) revelar(); };

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    limpiezasRef.current.push(() => {
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
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
    if (tirada.mult > 0 && hostRef.current) {
      const label = document.createElement('div');
      label.className = 'rs-result';
      label.textContent = '×' + (Math.round(tirada.mult * 100) / 100);
      hostRef.current.appendChild(label);
      limpiezasRef.current.push(() => label.remove());
    }
  }

  const T = pos.tarjeta;
  const filas = Math.max(1, Math.round(cfg.celdas / cols));

  return createPortal(
    <>
    {fondoPantalla && (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `center/cover no-repeat url("${fondoPantalla}")`,
      }} />
    )}
    <div
      ref={hostRef}
      className="rs-host"
      style={{
        position: 'absolute', left: `${T.x}%`, top: `${T.y}%`, transform: 'translate(-50%,-50%)',
        width: T.ancho, aspectRatio: `${cols} / ${filas}`,
        borderRadius: 14, overflow: 'hidden', zIndex: 9,
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
          animation: rs-pop .4s ease;
        }
        @keyframes rs-pop { 0%{transform:scale(.9)} 60%{transform:scale(1.08)} 100%{transform:scale(1)} }
        .rs-host .rs-anim { position:absolute; inset:0; pointer-events:none; }
        .rs-host canvas.rs-cover { position:absolute; inset:0; width:100%; height:100%; cursor:grab; }
        .rs-host .rs-result {
          position:absolute; left:50%; bottom:8px; transform:translateX(-50%);
          font-family:var(--rs-font-display, var(--rs-body, inherit)); font-weight:800; font-size:20px;
          color:var(--rs-ganar); background:rgba(0,0,0,.45); padding:4px 14px; border-radius:999px;
          border:1px solid var(--rs-ganar); pointer-events:none; z-index:3;
          animation: rs-pop .4s ease;
        }
        @media (prefers-reduced-motion: reduce) { .rs-host .rs-cel.rs-win, .rs-host .rs-result { animation:none } }
      `}</style>
      <div ref={gridRef} className="rs-grid" style={{ containerType: 'inline-size' }} />
      <canvas ref={canvasRef} className="rs-cover" />
    </div>
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
