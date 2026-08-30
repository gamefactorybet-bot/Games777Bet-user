import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { montarLottieEn } from './lottie.ts';
import { cargarFuentePlinko } from './juego/plinko-temas.ts';
import type { TemaPlinko } from './juego/plinko-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { PlinkoCfg, TiradaResuelta } from './types.ts';

const TAU = Math.PI * 2;

interface Bola {
  path: number[];
  k: number;
  tabla: number[];
  filas: number;
  p: number;
  landing: number | null;
  landAt: number;
}

interface PlinkoProps {
  escenario: Escenario;
  cfg: PlinkoCfg;
  tema: TemaPlinko;
  /** Filas/riesgo elegidos por el jugador (para dibujar el tablero en reposo). */
  filas: number;
  riesgo: string;
  /** Tirada resuelta por el servidor; null = nada cayendo. */
  tirada: TiradaResuelta | null;
  /** Se llama cuando la bolita toca la cubeta. */
  onLand: (mult: number) => void;
}

const mx = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

// El tablero de Plinko: canvas con los clavos, las cubetas y la
// bolita cayendo por el camino que decidió el servidor.
export function Plinko({ escenario, cfg, tema, filas, riesgo, tirada, onLand }: PlinkoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const bolaRef = useRef<Bola | null>(null);
  const flashRef = useRef<Record<number, number>>({});
  const lastRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lottieDivRef = useRef<HTMLDivElement | null>(null);
  const lottieCvRef = useRef<HTMLCanvasElement | null>(null);
  const lottieOffRef = useRef<(() => void) | null>(null);

  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const temaRef = useRef(tema); temaRef.current = tema;
  const filasRef = useRef(filas); filasRef.current = filas;
  const riesgoRef = useRef(riesgo); riesgoRef.current = riesgo;
  const onLandRef = useRef(onLand); onLandRef.current = onLand;

  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- tema ----
  useEffect(() => {
    cargarFuentePlinko(tema);
    const el = escenario.el;
    const prevBg = el.style.background;
    if (tema.stageBg) el.style.background = tema.stageBg;
    const claves = Object.keys(tema.vars);
    for (const k of claves) el.style.setProperty(k, tema.vars[k]);
    if (tema.font) el.style.setProperty('--pk-body', tema.font.family);
    return () => {
      el.style.background = prevBg;
      for (const k of claves) el.style.removeProperty(k);
      el.style.removeProperty('--pk-body');
    };
  }, [tema, escenario]);

  // ---- bola: imagen ----
  const bModo = cfg.bola.tipo === 'auto'
    ? (cfg.bola.lottie_url ? 'lottie' : cfg.bola.imagen_url ? 'imagen' : 'emoji')
    : cfg.bola.tipo;

  useEffect(() => {
    if (bModo !== 'imagen' || !cfg.bola.imagen_url) { imgRef.current = null; return; }
    const im = new Image();
    im.onload = () => { imgRef.current = im; };
    im.onerror = () => { imgRef.current = null; };
    im.src = cfg.bola.imagen_url;
  }, [cfg.bola.imagen_url, bModo]);

  // ---- bola: lottie (una instancia offscreen, se blitea) ----
  useEffect(() => {
    lottieOffRef.current?.();
    lottieOffRef.current = null;
    lottieCvRef.current = null;
    if (bModo !== 'lottie' || !cfg.bola.lottie_url) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;left:-9999px;top:0;width:96px;height:96px;pointer-events:none';
    document.body.appendChild(div);
    lottieDivRef.current = div;
    let vivo = true;
    montarLottieEn(div, cfg.bola.lottie_url, { loop: true }).then((off) => {
      if (!vivo) { off(); return; }
      lottieOffRef.current = off;
      lottieCvRef.current = div.querySelector('canvas');
    });
    return () => {
      vivo = false;
      lottieOffRef.current?.();
      lottieOffRef.current = null;
      lottieCvRef.current = null;
      div.remove();
    };
  }, [cfg.bola.lottie_url, bModo]);

  // ---- canvas ----
  useEffect(() => {
    const ajustar = () => {
      const cv = canvasRef.current;
      const host = escenario.grillaEl;
      if (!cv || !host) return;
      const prop = cfgRef.current.tablero?.proporcion || 1.45;
      const w = host.clientWidth || 320;
      // el tablero es más alto que ancho; la altura sale de la
      // proporción (el `aspect-ratio` del canvas ya la fija en el CSS).
      const h = host.clientHeight || Math.round(w * prop);
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dibujar();
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(ajustar) : null;
    if (ro && escenario.grillaEl) ro.observe(escenario.grillaEl);
    return () => { window.removeEventListener('resize', ajustar); ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escenario, cfg.tablero.proporcion]);

  // ---- soltar una bolita cuando llega la tirada ----
  useEffect(() => {
    if (!tirada) return;
    bolaRef.current = {
      path: tirada.path, k: tirada.k, tabla: tirada.tabla, filas: tirada.filas,
      p: -0.5, landing: null, landAt: 0,
    };
    lastRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(bucle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tirada]);

  // dibujo constante mientras hay flashes / bola; si no, se dibuja el
  // tablero en reposo una vez.
  useEffect(() => {
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, riesgo, cfg.rtp, tema]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ---------------- geometría ----------------
  function geo() {
    const cv = canvasRef.current!;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = cv.width / dpr, h = cv.height / dpr;
    const b = bolaRef.current;
    const n = b ? b.filas : filasRef.current;
    const topPad = Math.max(14, h * 0.03);
    const botPad = Math.max(38, h * 0.08);
    const rowGap = (h - topPad - botPad) / n;
    const spacing = Math.min(w / (n + 2.2), rowGap * 1.4);
    return { w, h, n, topPad, botPad, rowGap, spacing, cx: w / 2 };
  }
  const xAt = (g: ReturnType<typeof geo>, colUnit: number) => g.cx + colUnit * g.spacing / 2;
  const yRow = (g: ReturnType<typeof geo>, p: number) => g.topPad + p * g.rowGap + g.rowGap * 0.5;

  function col(g: ReturnType<typeof geo>, b: Bola, depth: number): number {
    depth = Math.max(0, Math.min(b.path.length, depth));
    let c = 0;
    for (let i = 0; i < depth; i++) c += b.path[i];
    return c;
  }

  // ---------------- dibujo ----------------
  function css(v: string) {
    return getComputedStyle(escenario.el).getPropertyValue(v).trim() || v;
  }
  function dibujar() {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const g = geo();
    ctx.clearRect(0, 0, g.w, g.h);
    const t = temaRef.current;
    const b = bolaRef.current;
    const n = g.n;

    // clavos
    ctx.fillStyle = cfgRef.current.clavos.color || t.clavo;
    for (let r = 0; r < n; r++) {
      for (let j = 0; j <= r; j++) {
        ctx.beginPath();
        ctx.arc(xAt(g, 2 * j - r), yRow(g, r), Math.max(1.6, g.spacing * 0.09), 0, TAU);
        ctx.fill();
      }
    }

    // cubetas
    const tabla = b ? b.tabla : tablaLocal(n);
    const okC = css('--ok') || '#4fd08a';
    const acC = css('--accent') || '#f5b638';
    const by = g.topPad + n * g.rowGap + 2;
    const bw = g.spacing * 0.9, bh = g.botPad - 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ff = css('--pk-font-display') || "'Orbitron', monospace";
    ctx.font = `700 ${Math.min(12, g.spacing * 0.42)}px ${ff}`;
    for (let k = 0; k <= n; k++) {
      const m = tabla[k] ?? 1;
      const bx = xAt(g, 2 * k - n);
      const cc = m >= 50 ? '#ff5a52' : m >= 10 ? '#ff8a3d' : m >= 2 ? acC : m >= 1 ? okC : '#5f7391';
      const age = flashRef.current[k] ? performance.now() - flashRef.current[k] : 1e9;
      const gl = Math.max(0, 1 - age / 420);
      const lift = Math.sin(gl * Math.PI) * 6;
      ctx.fillStyle = rgba(cc, 0.16 + gl * 0.5);
      roundRect(ctx, bx - bw / 2, by - lift, bw, bh, 5);
      ctx.fill();
      ctx.fillStyle = cc;
      ctx.fillText(mx(m), bx, by - lift + bh / 2);
    }

    // bolita
    if (b) {
      const seg = Math.floor(b.p);
      const frac = b.p - seg;
      const cFrom = col(g, b, seg);
      const cTo = col(g, b, seg + 1);
      const cu = cFrom + (cTo - cFrom) * ease(frac);
      let x = xAt(g, cu);
      let y = yRow(g, b.p);
      if (b.landing == null && b.p < n) y -= Math.sin(frac * Math.PI) * (g.rowGap * 0.24);
      if (b.landing != null) { x = xAt(g, 2 * b.k - n); y = yRow(g, n) + b.landing * 14; }
      dibujarBola(ctx, x, y, Math.max(5, cfgRef.current.bola.tam * 0.5));
    }
  }

  function dibujarBola(ctx: CanvasRenderingContext2D, x: number, y: number, R: number) {
    const t = temaRef.current;
    const lcv = lottieCvRef.current;
    if (bModo === 'lottie' && lcv && lcv.width) {
      ctx.drawImage(lcv, x - R, y - R, R * 2, R * 2);
      return;
    }
    const im = imgRef.current;
    if (bModo === 'imagen' && im && im.complete && im.naturalWidth) {
      ctx.drawImage(im, x - R, y - R, R * 2, R * 2);
      return;
    }
    if (bModo === 'emoji' && cfgRef.current.bola.emojiFallback) {
      ctx.font = `${R * 2}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfgRef.current.bola.emojiFallback, x, y + R * 0.08);
      return;
    }
    const grd = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.2, x, y, R);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.35, t.bola);
    grd.addColorStop(1, rgba(t.bola, 0.7));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
  }

  function tablaLocal(n: number): number[] {
    // reposo: tabla aproximada solo para mostrar las cubetas
    const b = riesgoRef.current === 'bajo' ? 1.32 : riesgoRef.current === 'alto' ? 2.7 : 1.78;
    const probs: number[] = [];
    let c = 1;
    const tot = Math.pow(2, n);
    for (let k = 0; k <= n; k++) { probs.push(c / tot); c = (c * (n - k)) / (k + 1); }
    const crudo = probs.map((_p, k) => Math.pow(b, Math.abs(k - n / 2)));
    const esp = crudo.reduce((a, r, k) => a + probs[k] * r, 0) || 1;
    const esc = cfgRef.current.rtp / esp;
    return crudo.map((r) => {
      const m = r * esc;
      return m >= 100 ? Math.round(m) : m >= 10 ? Math.round(m * 10) / 10 : Math.max(0.1, Math.round(m * 100) / 100);
    });
  }

  // ---------------- bucle ----------------
  function bucle(now: number) {
    const b = bolaRef.current;
    if (!b) { dibujar(); return; }
    const dt = Math.min(48, now - (lastRef.current || now));
    lastRef.current = now;
    // filas por ms; cfg.velocidad la baja (más lento = más suspenso)
    const vel = (reduce ? 0.028 : 0.0135) * (cfgRef.current.velocidad || 1);
    if (b.landing == null) {
      b.p += dt * vel;
      if (b.p >= b.filas) {
        b.p = b.filas;
        b.landing = 0;
        b.landAt = now;
        flashRef.current[b.k] = performance.now();
        onLandRef.current(b.tabla[b.k] ?? 1);
      }
    } else {
      b.landing = Math.min(1, (now - b.landAt) / 150);
      if (now - b.landAt > 420) { bolaRef.current = null; }
    }
    // limpiar flashes viejos para poder frenar el bucle en reposo
    const t0 = performance.now();
    let flashVivo = false;
    for (const k of Object.keys(flashRef.current)) {
      if (t0 - flashRef.current[+k] > 480) delete flashRef.current[+k];
      else flashVivo = true;
    }
    dibujar();
    if (bolaRef.current || flashVivo) {
      rafRef.current = requestAnimationFrame(bucle);
    } else {
      dibujar();
    }
  }

  // ---------------- render ----------------
  const deco = tema.deco ? (
    <div aria-hidden style={{
      position: 'absolute', inset: '-22px', borderRadius: 20, overflow: 'hidden',
      pointerEvents: 'none', zIndex: -1,
    }} dangerouslySetInnerHTML={{ __html: tema.deco }} />
  ) : null;

  const estilos = (
    <style>{`
      .pk-flash { animation: pkFlash .4s ease; }
      @keyframes pkFlash { 40% { transform: scale(1.1); } }
    `}</style>
  );

  return (
    <>
      {createPortal(
        <canvas ref={canvasRef} style={{
          width: '100%', display: 'block',
          aspectRatio: `1 / ${Math.max(0.8, Math.min(2.4, cfg.tablero?.proporcion || 1.45))}`,
        }} />,
        escenario.grillaEl,
      )}
      {createPortal(<>{estilos}{deco}</>, escenario.el)}
    </>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ease(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function rgba(color: string, a: number): string {
  const c = (color || '').trim();
  if (c.startsWith('rgb')) return c.replace(/rgba?\(([^)]+)\)/, (_x, inner) => {
    const p = inner.split(',').slice(0, 3).map((s: string) => s.trim());
    return `rgba(${p.join(',')},${a})`;
  });
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    let r: number, g: number, b: number;
    if (c.length === 4) { r = (n >> 8 & 15) * 17; g = (n >> 4 & 15) * 17; b = (n & 15) * 17; }
    else { r = n >> 16 & 255; g = n >> 8 & 255; b = n & 255; }
    return `rgba(${r},${g},${b},${a})`;
  }
  return c || `rgba(0,0,0,${a})`;
}
