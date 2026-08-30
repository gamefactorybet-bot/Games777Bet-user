import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { crecimiento } from './juego/crash.ts';
import { montarLottieEn } from './lottie.ts';
import { cargarFuenteCrash } from './juego/crash-temas.ts';
import type { TemaCrash } from './juego/crash-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { CrashCfg, EstadoCrash, PosControlesCrash } from './types.ts';

const TAU = Math.PI * 2;

interface CrashProps {
  escenario: Escenario;
  cfg: CrashCfg;
  tema: TemaCrash;
  pos: PosControlesCrash;
  estado: EstadoCrash;
  /** El multiplicador animado, escrito por el bucle de acá y leído por la mesa. */
  multVivoRef: MutableRefObject<number>;
  onAuto: (objetivo: number) => void;
  onTope: () => void;
}

const m2 = (n: number) => (Math.floor(n * 100) / 100).toFixed(2) + '×';

// El área de juego del Crash: un canvas que se dibuja por frame (sin
// re-render de React) y el número grande + el mensaje de resultado.
// El bucle de animación arranca al instante con `fase === 'en_curso'`
// y calcula el multiplicador desde `inicioTs` (reloj local ya
// ajustado al del servidor).
export function Crash({ escenario, cfg, tema, pos, estado, multVivoRef, onAuto, onTope }: CrashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const objRef = useRef<HTMLDivElement>(null);
  const lottieMountRef = useRef<HTMLDivElement>(null);
  const lottieOffRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const trailRef = useRef<number[][]>([]);
  const dispRef = useRef({ auto: false, tope: false, round: '' });
  const shakeRef = useRef(0);
  // Objetivo del objeto que vuela: lo calcula cada renderizador y lo
  // aplica `dibujar()` como transform en el overlay (no en el canvas).
  const objInfoRef = useRef({ x: 0, y: 0, rot: 0, visible: false });

  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const temaRef = useRef(tema);
  temaRef.current = tema;

  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- tema: fondo del escenario + variables + fuente + deco ----
  useEffect(() => {
    cargarFuenteCrash(tema);
    const el = escenario.el;
    const prevBg = el.style.background;
    if (tema.stageBg) el.style.background = tema.stageBg;
    const claves = Object.keys(tema.vars);
    for (const k of claves) el.style.setProperty(k, tema.vars[k]);
    if (tema.font) el.style.setProperty('--cr-body', tema.font.family);
    return () => {
      el.style.background = prevBg;
      for (const k of claves) el.style.removeProperty(k);
      el.style.removeProperty('--cr-body');
    };
  }, [tema, escenario]);

  // ---- imagen del objeto que vuela ----
  // ---- animación Lottie del objeto (gana sobre la imagen) ----
  useEffect(() => {
    lottieOffRef.current?.();
    lottieOffRef.current = null;
    const cont = lottieMountRef.current;
    if (!cfg.objeto.lottie_url || !cont) return;
    let vivo = true;
    montarLottieEn(cont, cfg.objeto.lottie_url, { loop: true }).then((off) => {
      if (vivo) lottieOffRef.current = off;
      else off();
    });
    return () => { vivo = false; lottieOffRef.current?.(); lottieOffRef.current = null; };
  }, [cfg.objeto.lottie_url, cfg.formato]);

  // ---- tamaño del canvas ----
  useEffect(() => {
    const ajustar = () => {
      const cv = canvasRef.current;
      const host = escenario.grillaEl;
      if (!cv || !host) return;
      const w = host.clientWidth || 320;
      const h = host.clientHeight || w;
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
  }, [escenario]);

  // ---- bucle de animación ----
  useEffect(() => {
    const e = estado;
    // reinicio de disparadores al arrancar una ronda nueva
    if (e.fase === 'en_curso' && e.roundId && dispRef.current.round !== e.roundId) {
      dispRef.current = { auto: false, tope: false, round: e.roundId };
      trailRef.current = [];
    }
    if (e.fase === 'retirada' || e.fase === 'reventada') shakeRef.current = performance.now();
    if (e.fase === 'reventada' && !reduce) {
      escenario.el.classList.add('cr-shake');
      setTimeout(() => escenario.el.classList.remove('cr-shake'), 440);
    }

    const paso = () => {
      const st = estadoRef.current;
      const c = cfgRef.current;
      if (st.fase === 'en_curso' && st.inicioTs != null) {
        const el = Date.now() - st.inicioTs;
        const m = crecimiento(el, c);
        multVivoRef.current = m;
        if (numRef.current) numRef.current.textContent = m2(m);
        const bm = document.getElementById('crash-monto-vivo');
        if (bm) bm.textContent = Math.round(st.apuesta * m).toLocaleString('es-PY');
        if (!dispRef.current.auto && st.autoActivo && st.autoObjetivo > 1 && m >= st.autoObjetivo) {
          dispRef.current.auto = true;
          onAuto(st.autoObjetivo);
        } else if (!dispRef.current.tope && m >= c.tope - 1e-9) {
          dispRef.current.tope = true;
          onTope();
        }
        dibujar();
        rafRef.current = requestAnimationFrame(paso);
        return;
      }
      multVivoRef.current = st.multiplicador || 1;
      dibujar();
      const terminada = st.fase === 'retirada' || st.fase === 'reventada';
      // seguir animando la explosión / celebración un rato, después parar
      if (terminada && performance.now() - shakeRef.current < 1700) {
        rafRef.current = requestAnimationFrame(paso);
      }
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase, estado.roundId]);

  // ---- número + mensaje según fase (React, poco frecuente) ----
  useEffect(() => {
    const n = numRef.current, mg = msgRef.current;
    if (!n || !mg) return;
    n.className = 'cr-num cr-fx-' + cfg.numero.efecto;
    mg.className = 'cr-msg';
    if (estado.fase === 'retirada') {
      n.classList.add('is-win', 'is-pop');
      n.textContent = m2(estado.multiplicador);
      mg.classList.add('is-win');
      mg.textContent = `Cobraste ${m2(estado.multiplicador)}  ·  +${Math.round(estado.ganancia || 0).toLocaleString('es-PY')}`;
    } else if (estado.fase === 'reventada') {
      n.classList.add('is-bust', 'is-pop');
      n.textContent = m2(estado.reventadoEn || estado.multiplicador || 1);
      mg.classList.add('is-bust');
      mg.textContent = `Reventó en ${m2(estado.reventadoEn || 1)}`;
    } else if (estado.fase === 'en_curso') {
      mg.textContent = '';
    } else {
      n.textContent = '1.00×';
      mg.textContent = 'Poné tu apuesta y despegá';
    }
  }, [estado.fase, estado.multiplicador, estado.reventadoEn, estado.ganancia, cfg.numero.efecto]);

  // ---- sonidos + animaciones del escenario (si el juego los tiene) ----
  useEffect(() => {
    const a = escenario.audios;
    if (estado.fase === 'en_curso') {
      if (a.musica_fondo?.paused) a.musica_fondo.play().catch(() => {});
      if (a.giro) { a.giro.currentTime = 0; a.giro.play().catch(() => {}); }
      escenario.lanzarAnimaciones('girar');
    } else if (estado.fase === 'retirada') {
      const grande = estado.multiplicador >= 5;
      const s = grande ? (a.premio_grande || a.premio_chico) : a.premio_chico;
      if (s) { s.currentTime = 0; s.play().catch(() => {}); }
      escenario.lanzarAnimaciones(grande ? 'premio_mayor' : 'premio_chico');
    } else if (estado.fase === 'reventada') {
      if (a.giro) a.giro.pause();
      escenario.lanzarAnimaciones('perder');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase]);

  // ---------------- dibujo ----------------
  function col(v: string): string {
    return getComputedStyle(escenario.el).getPropertyValue(v).trim() || v;
  }
  function trazo(): string {
    return cfg.curva.color || col('--cr-num') || temaRef.current.trazo;
  }
  function faseColor(): string {
    const f = estadoRef.current.fase;
    return f === 'reventada' ? (col('--danger') || '#e0574f')
      : f === 'retirada' ? (col('--ok') || '#35d08b')
      : trazo();
  }

  // Base de rotación según cómo apunta el arte del objeto.
  function noseBase(): number {
    return cfgRef.current.objeto.apunta === 'derecha' ? 0 : -Math.PI / 2;
  }
  function giroExtra(): number {
    return (cfgRef.current.objeto.giro || 0) * Math.PI / 180;
  }

  // Aplica la posición/rotación del objeto que vuela al overlay del
  // DOM (imagen, emoji o Lottie) — así puede seguir la curva y no se
  // ve estático.
  function aplicarObjeto() {
    const el = objRef.current;
    if (!el) return;
    const info = objInfoRef.current;
    el.style.opacity = info.visible ? '1' : '0';
    if (!info.visible) return;
    const tam = cfgRef.current.objeto.tam;
    el.style.transform = `translate3d(${(info.x - tam / 2).toFixed(1)}px, ${(info.y - tam / 2).toFixed(1)}px, 0) rotate(${info.rot.toFixed(3)}rad)`;
  }

  function dibujar() {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = cv.width / dpr, h = cv.height / dpr;
    ctx.clearRect(0, 0, w, h);

    const st = estadoRef.current;
    const c = cfgRef.current;
    const m = st.fase === 'en_curso' ? multVivoRef.current
      : st.fase === 'reventada' ? (st.reventadoEn || 1)
      : (st.multiplicador || 1);
    const activo = st.fase !== 'inactiva';

    objInfoRef.current.visible = false;
    if (c.curva.cuadricula && c.formato !== 'numero') drawGrid(ctx, w, h);

    if (c.formato === 'cohete') dibujarCohete(ctx, w, h, m, activo, st);
    else if (c.formato === 'numero') dibujarNumero(ctx, w, h, m, st);
    else if (c.formato === 'medidor') dibujarMedidor(ctx, w, h, m, st);
    else if (c.formato === 'odometro') dibujarOdometro(ctx, w, h, m, st);
    else dibujarCurva(ctx, w, h, m, activo, st);

    aplicarObjeto();
  }

  function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = col('--cr-grid') || 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    for (let gx = w - 4; gx > 0; gx -= 46) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = h - 12; gy > 0; gy -= 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
  }

  function dibujarCurva(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, activo: boolean, st: EstadoCrash) {
    if (!activo || st.inicioTs == null && st.fase === 'inactiva') return;
    const c = cfgRef.current;
    const padL = 12, padR = 22, padT = 16, padB = 22;
    const vw = w - padL - padR, vh = h - padT - padB;
    const elapsed = st.fase === 'en_curso' && st.inicioTs != null
      ? Date.now() - st.inicioTs
      : Math.log(Math.max(1, m)) / (Math.LN2 / (5000 / c.velocidad));
    const tEnd = Math.max(elapsed, 2600);
    const tStart = Math.max(0, tEnd - 9500);
    const mTop = Math.max(m * 1.2, 1.7);
    const X = (t: number) => padL + ((t - tStart) / (tEnd - tStart)) * vw;
    const Y = (mm: number) => padT + (1 - (mm - 1) / (mTop - 1)) * vh;
    const k = Math.LN2 / (5000 / c.velocidad);

    const pts: number[][] = [];
    const steps = 58;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(elapsed, tStart + (tEnd - tStart) * (i / steps));
      pts.push([X(t), Y(Math.min(c.tope, Math.exp(k * t)))]);
      if (t >= elapsed) break;
    }
    const tip = pts[pts.length - 1], prev = pts[pts.length - 2] || pts[0];
    const cc = faseColor();

    const g = ctx.createLinearGradient(0, padT, 0, h - padB);
    g.addColorStop(0, rgba(cc, c.curva.relleno ? 0.26 : 0));
    g.addColorStop(1, rgba(cc, 0));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], h - padB);
    pts.forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(tip[0], h - padB);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineWidth = c.curva.grosor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = cc;
    if (c.curva.glow) { ctx.shadowColor = rgba(cc, 0.8); ctx.shadowBlur = st.fase === 'en_curso' ? 14 : 4; }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const tang = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
    const seguir = c.objeto.seguir;
    let ox = tip[0], oy = tip[1];
    let rot = (seguir ? tang - noseBase() : 0) + giroExtra();
    if (st.fase === 'reventada') {
      const p = Math.min(1, (performance.now() - shakeRef.current) / 750);
      ox += p * 120; oy += -p * 60 + p * p * 150;
      rot += p * 1.4;
    }
    objInfoRef.current = { x: ox, y: oy, rot, visible: true };
  }

  function dibujarCohete(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, activo: boolean, st: EstadoCrash) {
    const c = cfgRef.current;
    const cx = w * 0.5;
    const floor = h - 26, ceil = 40;
    const frac = Math.min(1, Math.log(Math.max(1, m)) / Math.log(c.tope));
    const y = floor - frac * (floor - ceil);
    const cc = faseColor();
    if (c.objeto.estela && !reduce && st.fase === 'en_curso') {
      trailRef.current.unshift([cx + (Math.random() - 0.5) * 8, y + c.objeto.tam * 0.3]);
      if (trailRef.current.length > 26) trailRef.current.pop();
    } else if (st.fase === 'inactiva') { trailRef.current.length = 0; }
    const tr = trailRef.current;
    for (let i = tr.length - 1; i >= 0; i--) {
      const f = 1 - i / tr.length;
      ctx.beginPath();
      ctx.arc(tr[i][0], tr[i][1] + i * 2.4, 5 * f + 1, 0, TAU);
      ctx.fillStyle = rgba(cc, f * 0.5);
      ctx.fill();
    }
    if (!activo) return;
    const seguir = c.objeto.seguir;
    // sube derecho: se lo deja "mirando arriba" con un vaivén suave
    const base = seguir ? (-Math.PI / 2 - noseBase()) : 0;
    const sway = seguir && st.fase === 'en_curso' && !reduce ? Math.sin(performance.now() / 380) * 0.07 : 0;
    let ox = cx, oy = y;
    let rot = base + sway + giroExtra();
    if (st.fase === 'reventada') {
      const p = Math.min(1, (performance.now() - shakeRef.current) / 750);
      ox += p * 100; oy += -p * 120;
      rot += p * 1.6;
    }
    objInfoRef.current = { x: ox, y: oy, rot, visible: true };
  }

  function dibujarNumero(ctx: CanvasRenderingContext2D, w: number, h: number, _m: number, st: EstadoCrash) {
    const c = cfgRef.current;
    const cx = w / 2, cy = h * 0.44;
    const R = Math.min(w, h) * 0.34;
    const cc = faseColor();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = rgba(cc, 0.12);
    ctx.lineWidth = 6;
    ctx.stroke();
    if (st.fase === 'en_curso') {
      const p = Math.min(1, 1 - 1 / Math.max(1.0001, multVivoRef.current));
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      ctx.strokeStyle = cc;
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      if (c.curva.glow) { ctx.shadowColor = rgba(cc, 0.7); ctx.shadowBlur = 16; }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (st.fase !== 'inactiva') {
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.strokeStyle = cc;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  }

  function dibujarMedidor(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, st: EstadoCrash) {
    const c = cfgRef.current;
    const cx = w / 2, cy = h * 0.62, R = Math.min(w * 0.42, h * 0.5);
    const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    const cc = faseColor();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a1);
    ctx.strokeStyle = rgba(cc, 0.14);
    ctx.lineWidth = 10;
    ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * (i / 10);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14));
      ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      ctx.strokeStyle = rgba(cc, 0.35);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (st.fase !== 'inactiva') {
      const frac = Math.min(1, Math.log(Math.max(1, m)) / Math.log(c.tope));
      const a = a0 + (a1 - a0) * frac;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a);
      ctx.strokeStyle = cc;
      ctx.lineWidth = 10;
      if (c.curva.glow) { ctx.shadowColor = rgba(cc, 0.7); ctx.shadowBlur = 14; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      ctx.strokeStyle = cc;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, TAU);
      ctx.fillStyle = cc;
      ctx.fill();
    }
  }

  function dibujarOdometro(ctx: CanvasRenderingContext2D, w: number, h: number, m: number, st: EstadoCrash) {
    const c = cfgRef.current;
    const cc = faseColor();
    const y = h * 0.66;
    const speed = st.fase === 'en_curso' ? 40 + m * 14 : 0;
    const off = (performance.now() / 1000 * speed) % 44;
    ctx.strokeStyle = rgba(cc, 0.4);
    ctx.lineWidth = 2;
    for (let x = -off; x < w + 44; x += 22) {
      const alto = (Math.round(x + off) % 44 === 0) ? 16 : 8;
      ctx.beginPath();
      ctx.moveTo(x, y - alto);
      ctx.lineTo(x, y + alto);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(cc, 0.15);
    ctx.beginPath();
    ctx.moveTo(0, y - 26);
    ctx.lineTo(w, y - 26);
    ctx.moveTo(0, y + 26);
    ctx.lineTo(w, y + 26);
    ctx.stroke();
    // marca central
    ctx.fillStyle = cc;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, y - 30);
    ctx.lineTo(w / 2 + 6, y - 30);
    ctx.lineTo(w / 2, y - 22);
    ctx.closePath();
    ctx.fill();
  }

  // ---------------- render ----------------
  const cohete = cfg.formato === 'cohete';
  const conObjeto = cfg.formato === 'curva' || cfg.formato === 'cohete';
  const numTop = cohete ? Math.max(pos.multiplicador.y, 74) : pos.multiplicador.y;
  const oTam = cfg.objeto.tam;
  const objeto = conObjeto ? (
    <div ref={objRef} aria-hidden style={{
      position: 'absolute', left: 0, top: 0, width: oTam, height: oTam,
      transformOrigin: 'center', willChange: 'transform', pointerEvents: 'none',
      opacity: 0, transition: 'opacity .2s', zIndex: 5,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: oTam * 0.82, lineHeight: 1,
    }}>
      {cfg.objeto.lottie_url
        ? <div ref={lottieMountRef} style={{ width: '100%', height: '100%' }} />
        : cfg.objeto.imagen_url
          ? <img src={cfg.objeto.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span>{cfg.objeto.emojiFallback || '🚀'}</span>}
    </div>
  ) : null;
  const numeroBox = (
    <div className="cr-numwrap" data-fmt={cfg.formato} style={{
      position: 'absolute', left: `${pos.multiplicador.x}%`, top: `${numTop}%`,
      transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 12,
      fontFamily: 'var(--cr-body, inherit)',
    }}>
      <div ref={numRef} className={'cr-num cr-fx-' + cfg.numero.efecto} style={{
        fontFamily: 'var(--cr-font-display, var(--cr-body, inherit))', fontWeight: 800,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        fontSize: `calc(${cohete ? 34 : 46}px * ${cfg.numero.tam})`,
        color: cfg.numero.color || 'var(--cr-num, var(--accent))',
        textShadow: '0 0 26px var(--cr-glow, rgba(0,0,0,.3))',
      }}>1.00×</div>
      <div ref={msgRef} className="cr-msg" style={{
        marginTop: 6, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
        color: 'var(--text-dim)', textShadow: '0 1px 4px rgba(0,0,0,.5)',
      }}>Poné tu apuesta y despegá</div>
    </div>
  );

  const deco = tema.deco ? (
    <div aria-hidden style={{
      position: 'absolute', inset: '-22px', borderRadius: 20, overflow: 'hidden',
      pointerEvents: 'none', zIndex: -1,
    }} dangerouslySetInnerHTML={{ __html: tema.deco }} />
  ) : null;

  const estilos = (
    <style>{`
      .cr-num.is-win { color: var(--ok) !important; }
      .cr-num.is-bust { color: var(--danger) !important; }
      .cr-msg.is-win { color: var(--ok) !important; }
      .cr-msg.is-bust { color: var(--danger) !important; }
      .cr-num.is-pop { animation: crPop .3s ease; }
      @keyframes crPop { 40% { transform: scale(1.14); } }
      .cr-fx-pulso { animation: crPulse 1.4s ease-in-out infinite; }
      @keyframes crPulse { 50% { opacity: .82; } }
      .cr-fx-glow { text-shadow: 0 0 34px var(--cr-glow, rgba(0,0,0,.3)) !important; }
      .cr-shake { animation: crShake .42s ease; }
      @keyframes crShake {
        0%,100%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)}
        40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,-1px)} 80%{transform:translate(2px,2px)}
      }
      @media (prefers-reduced-motion: reduce) {
        .cr-num.is-pop, .cr-fx-pulso, .cr-shake { animation: none !important; }
      }
    `}</style>
  );

  return (
    <>
      {createPortal(<><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />{objeto}</>, escenario.grillaEl)}
      {createPortal(<>{estilos}{deco}{numeroBox}</>, escenario.el)}
    </>
  );
}

// ---- helpers de color ----
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
