// =========================================================
// DADOS 3D — mesa de dados vista casi desde arriba, en canvas puro.
//
// Base reutilizable para cualquier juego de dados (7 Up 7 Down, y lo
// que venga). No sabe nada de reglas ni de RTP: recibe el resultado ya
// decidido (qué número tiene que quedar arriba en cada dado) y lo
// anima — tira, rueda con física, rebota, y en la última rodada
// desacelera hasta clavar esa cara, cerca del centro de la mesa.
//
// Cada dado es un cubo real: se dibujan sus 6 caras sombreadas por su
// ángulo hacia la luz, ordenadas por profundidad, con esquinas
// redondeadas. En el aire se ve más grande (cae desde alto).
// La mesa (paño + canto) se proyecta en la misma cámara: el borde de
// abajo se acerca, el de arriba se aleja.
// =========================================================

import { type M3, I3, m3mul, m3v, m3rot, m3ortho, m3T, m3axisAngle } from './mat3.ts';

/** Cómo se “siente” el dado. Independiente del fieltro de la mesa. */
export type MaterialDado = 'marfil' | 'oro' | 'cromo' | 'cristal' | 'rubi' | 'onix';

export const MATERIALES_DADO: { id: MaterialDado; nombre: string; colores: string[] }[] = [
  { id: 'marfil', nombre: 'Marfil', colores: ['#f4efe4', '#c9bba4'] },
  { id: 'oro', nombre: 'Oro', colores: ['#f0d078', '#8a5a14'] },
  { id: 'cromo', nombre: 'Cromo', colores: ['#e8eef4', '#4a525c'] },
  { id: 'cristal', nombre: 'Cristal', colores: ['#d4e8f8', '#6a9ab8'] },
  { id: 'rubi', nombre: 'Rubí', colores: ['#ff6a7c', '#6a1020'] },
  { id: 'onix', nombre: 'Ónix', colores: ['#3a3e46', '#0c0d10'] },
];

export interface PaletaDados {
  /** Fieltro: centro y borde del degradado radial. */
  feltA: string;
  feltB: string;
  /** Dado: claro y oscuro del degradado de cara. */
  dieHi: string;
  dieLo: string;
  /** Color de los puntos. */
  pip: string;
  /** Receta de material. Default marfil. */
  material?: MaterialDado;
  /** Madera del rail (claro / oscuro) y filete metálico. */
  railA?: string;
  railB?: string;
  lip?: string;
}

/** Eventos de impacto para audio / háptica. Fuerza 0–1. */
export interface FxDados {
  onThrow?: () => void;
  onBounce?: (fuerza: number) => void;
  onCollide?: (fuerza: number) => void;
  onLand?: (fuerza: number) => void;
  onSettle?: () => void;
}

interface RecetaMat {
  metal: number;
  glass: number;
  spec: number;
  specPow: number;
  rim: number;
  trans: number;
  pipWell: number;
}

const RECETA: Record<MaterialDado, RecetaMat> = {
  marfil: { metal: 0.12, glass: 0, spec: 0.32, specPow: 16, rim: 0.22, trans: 0, pipWell: 1 },
  oro: { metal: 0.88, glass: 0, spec: 0.72, specPow: 26, rim: 0.38, trans: 0, pipWell: 0.85 },
  cromo: { metal: 1, glass: 0, spec: 0.95, specPow: 42, rim: 0.52, trans: 0, pipWell: 0.55 },
  cristal: { metal: 0.08, glass: 1, spec: 0.92, specPow: 52, rim: 0.78, trans: 0.3, pipWell: 0.35 },
  rubi: { metal: 0.1, glass: 1, spec: 0.86, specPow: 46, rim: 0.7, trans: 0.34, pipWell: 0.4 },
  onix: { metal: 0.42, glass: 0, spec: 0.58, specPow: 34, rim: 0.42, trans: 0, pipWell: 1 },
};

/** Retoque de la imagen del fieltro. `fit` fijo en cover: nunca deja franjas. */
export interface AjusteFondoMesa {
  x: number; y: number; zoom: number; blur: number; osc: number;
}

export interface OpcionesDados3D {
  paleta: PaletaDados;
  /** Imagen de fondo de la mesa (se dibuja bajo el fieltro con un velo). */
  fondo?: HTMLImageElement | null;
  /** Retoque de esa imagen (posición, zoom, desenfoque, oscurecido). */
  fondoAjuste?: AjusteFondoMesa;
  /** Opacidad del velo del color del fieltro sobre la imagen (0-1). */
  velo?: number;
  /** Inclinación de cámara en radianes (0 = totalmente cenital). */
  tilt?: number;
  /** Respeta prefers-reduced-motion (salta a resultado). Por defecto sí. */
  animar?: boolean;
  /** Impactos para audio. Opcional. */
  fx?: FxDados;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------- cubo ----------
const CUBE = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], val: 1 },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0], val: 6 },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], val: 2 },
  { n: [0, -1, 0], u: [0, 0, 1], v: [-1, 0, 0], val: 5 },
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], val: 3 },
  { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, -1], val: 4 },
];
const SNAP0: Record<number, M3> = {
  1: I3, 6: m3rot(1, 0, 0, Math.PI),
  2: m3rot(1, 0, 0, Math.PI / 2), 5: m3rot(1, 0, 0, -Math.PI / 2),
  3: m3rot(0, 1, 0, -Math.PI / 2), 4: m3rot(0, 1, 0, Math.PI / 2),
};
const FACES: Record<number, number[][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

function hexRgb(h: string): number[] {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const lerp3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c: number[]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c: number[], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

interface Dado {
  x: number; y: number; vx: number; vy: number; z: number; vz: number; zPk: number;
  rot: M3; spin: number; wob: number[];
  gP: number; gT: number; gDur: number; gTurn: number; gAxis: number[];
  gFrom: M3; gTarget: M3; gx0: number; gy0: number; gTx: number; gTy: number;
  settled: boolean; sq: number;
}

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; col: number[]; }
interface Ring { x: number; y: number; r: number; a: number; max: number; col: number[]; }

export interface Dados3D {
  tirar(resultado: [number, number]): Promise<void>;
  resize(): void;
  destruir(): void;
  reposar(dados: [number, number]): void;
  /** Cambia la imagen del fieltro sin recrear el motor. */
  setFondo(img: HTMLImageElement | null, ajuste: AjusteFondoMesa | null, velo: number): void;
  /** Cambia la paleta (tema) sin recrear el motor. */
  setPaleta(p: PaletaDados): void;
}

const SPECKLE: number[][] = [];
for (let i = 0; i < 280; i++) SPECKLE.push([Math.random(), Math.random(), Math.random() * 1.35 + 0.25, Math.random() * 0.055]);
const NAP: number[][] = [];
for (let i = 0; i < 180; i++) NAP.push([Math.random(), Math.random(), Math.random() * 1.6 + 0.4, Math.random() * 0.04]);
const GRAIN: number[][] = [];
for (let i = 0; i < 20; i++) GRAIN.push([Math.random(), Math.random() * 0.5 + 0.2, (Math.random() - 0.5) * 8, i % 2]);

export function crearDados3D(canvas: HTMLCanvasElement, opts: OpcionesDados3D): Dados3D {
  const cx = canvas.getContext('2d')!;
  const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const TILT = opts.tilt ?? 0.38;
  const COST = Math.cos(TILT), SINT = Math.sin(TILT);
  const LIGHT = (() => { const x = -0.5, y = 0.32, z = 0.8, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  const reduce = opts.animar === false
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const fx = opts.fx;

  let VW = 0, VH = 0;
  let col = { hi: hexRgb(opts.paleta.dieHi), lo: hexRgb(opts.paleta.dieLo), pip: hexRgb(opts.paleta.pip) };
  let receta = RECETA[opts.paleta.material || 'marfil'] || RECETA.marfil;
  let gradFeltA = opts.paleta.feltA, gradFeltB = opts.paleta.feltB;
  let railA = opts.paleta.railA || '#3e2c1c';
  let railB = opts.paleta.railB || '#16100a';
  let lip = opts.paleta.lip || '#c4a15a';
  let feltHi = hexRgb(gradFeltA), feltLo = hexRgb(gradFeltB), lipRgb = hexRgb(lip);
  const VIEW = [0, -SINT, COST];
  let fondoImg: HTMLImageElement | null = opts.fondo ?? null;
  let fondoAj: AjusteFondoMesa | null = opts.fondoAjuste ?? null;
  let veloN = opts.velo ?? 0.5;

  const parts: Part[] = [];
  const rings: Ring[] = [];
  let shake = 0, flash = 0, gold7 = 0, idleT = 0, lastLucky = false;
  let settledSent = false;

  const dieSize = () => clamp(Math.min(VW * 0.15, VH * 0.19), 44, 78);
  const speed = (d: Dado) => Math.hypot(d.vx, d.vy);

  /** Caja de la mesa en espacio de layout (antes de proyectar). */
  function tableGeom() {
    const padX = Math.max(8, VW * 0.028);
    const padT = Math.max(12, VH * 0.042);
    const padB = Math.max(20, VH * 0.072);
    return { x0: padX, x1: VW - padX, y0: padT, y1: VH - padB };
  }
  /** 1 cerca (abajo) → ~0.84 lejos (arriba). Misma idea que rotateX(22°). */
  function depthS(y: number) {
    const g = tableGeom();
    const t = clamp((y - g.y0) / Math.max(1, g.y1 - g.y0), 0, 1);
    return 0.78 + 0.22 * t;
  }
  /** Layout (x,y) + altura z → pantalla. z>0 sube; z<0 es el canto de la losa. */
  function P(x: number, y: number, z: number): number[] {
    const g = tableGeom();
    const s = depthS(y);
    return [VW * 0.5 + (x - VW * 0.5) * s, g.y1 - (g.y1 - y) * COST - z * SINT];
  }
  function playPad() {
    const g = tableGeom();
    const m = Math.max(14, dieSize() * 0.3);
    return { loX: g.x0 + m, hiX: g.x1 - m, loY: g.y0 + m, hiY: g.y1 - m };
  }
  const dieScale = (d: Dado) => (0.8 + 0.45 * clamp(d.z / (d.zPk || 1), 0, 1)) * depthS(d.y);

  const mk = (): Dado => ({
    x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, zPk: 1, rot: I3.slice(), spin: 0, wob: [0, 0, 0],
    gP: 0, gT: 0, gDur: 0, gTurn: 0, gAxis: [1, 0, 0], gFrom: I3.slice(), gTarget: I3.slice(),
    gx0: 0, gy0: 0, gTx: 0, gTy: 0, settled: true, sq: 0,
  });
  const dice: Dado[] = [mk(), mk()];
  let pend: [number, number] = [3, 4];
  let resolver: (() => void) | null = null;
  let raf = 0, last = 0, animT = 0;

  function paletaDe(p: PaletaDados) {
    col = { hi: hexRgb(p.dieHi), lo: hexRgb(p.dieLo), pip: hexRgb(p.pip) };
    receta = RECETA[p.material || 'marfil'] || RECETA.marfil;
    gradFeltA = p.feltA; gradFeltB = p.feltB;
    railA = p.railA || '#3e2c1c'; railB = p.railB || '#16100a'; lip = p.lip || '#c4a15a';
    feltHi = hexRgb(gradFeltA); feltLo = hexRgb(gradFeltB); lipRgb = hexRgb(lip);
  }

  function puff(x: number, y: number, n: number, fuerza: number, gold = false) {
    if (parts.length > 70) return;
    const base = gold ? [232, 197, 90] : lerp3(feltHi, [255, 255, 255], 0.35);
    const count = Math.min(n, 70 - parts.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, s = (0.3 + Math.random()) * (28 + fuerza * 70);
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.72,
        life: 1, max: 0.28 + Math.random() * 0.35,
        r: (gold ? 1.4 : 0.8) + Math.random() * (gold ? 2.2 : 1.6),
        col: gold ? lerp3(base, [255, 240, 180], Math.random()) : base,
      });
    }
  }
  function ringAt(x: number, y: number, fuerza: number) {
    if (rings.length > 8) return;
    rings.push({ x, y, r: 6, a: clamp(0.18 + fuerza * 0.28, 0.1, 0.42), max: 18 + fuerza * 36, col: feltLo });
  }
  function celebrate() {
    gold7 = 1;
    flash = 1;
    const mx = (dice[0].x + dice[1].x) / 2, my = (dice[0].y + dice[1].y) / 2;
    puff(mx, my, 28, 0.85, true);
    ringAt(mx, my, 0.9);
  }

  function fit() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    VW = r.width; VH = r.height;
    canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!raf) draw();
  }

  function reposar(dados: [number, number]) {
    const S = dieSize();
    const g = tableGeom();
    const midY = (g.y0 + g.y1) * 0.5;
    dice[0].x = VW * 0.5 - S * 0.7; dice[0].y = midY + S * 0.08;
    dice[1].x = VW * 0.5 + S * 0.7; dice[1].y = midY - S * 0.1;
    dice.forEach((d, k) => {
      d.z = 0; d.vx = d.vy = d.vz = d.spin = 0; d.wob = [0, 0, 0]; d.gP = 0; d.settled = true; d.sq = 0;
      d.rot = m3ortho(m3mul(m3rot(0, 0, 1, k ? 0.26 : -0.19), SNAP0[dados[k]] || I3));
    });
    if (!raf) draw();
  }

  function randRot(): M3 {
    return m3mul(m3rot(1, 0, 0, Math.random() * 6.28), m3mul(m3rot(0, 1, 0, Math.random() * 6.28), m3rot(0, 0, 1, Math.random() * 6.28)));
  }
  function wobKick(d: Dado, m: number) {
    d.wob[0] += (Math.random() - 0.5) * m; d.wob[1] += (Math.random() - 0.5) * m; d.wob[2] += (Math.random() - 0.5) * m * 0.6;
  }

  function lanzar() {
    const pp = playPad(), S = dieSize();
    dice.forEach((d, k) => {
      const dir = k ? 1 : -1;
      d.x = clamp(VW * 0.5 + dir * S * (0.5 + Math.random() * 0.4), pp.loX + S * 0.4, pp.hiX - S * 0.4);
      d.y = pp.hiY - S * 0.35 - Math.random() * 12;
      d.vx = dir * VW * (0.2 + Math.random() * 0.26) + (Math.random() * 70 - 35);
      d.vy = -VH * (1.12 + Math.random() * 0.5);
      d.z = 1; d.vz = VH * (1.95 + Math.random() * 0.55);
      d.zPk = (d.vz * d.vz) / (2 * VH * 7);
      d.spin = (Math.random() * 2 - 1) * 9 + dir * 3;
      d.wob = [(Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 5];
      d.rot = m3ortho(randRot());
      d.gP = 0; d.settled = false; d.sq = 0;
    });
    parts.length = 0; rings.length = 0; shake = 0; flash = 0; gold7 = 0; idleT = 0; lastLucky = false; settledSent = false;
    fx?.onThrow?.();
  }

  function startGuide(d: Dado, k: number, v: number, wlen: number) {
    d.gTarget = m3ortho(m3mul(m3rot(0, 0, 1, (Math.random() - 0.5) * 0.5), SNAP0[pend[k]] || I3));
    d.gFrom = d.rot.slice();
    const rel = m3axisAngle(m3mul(d.gTarget, m3T(d.rot)));
    const extra = rel.a < Math.PI * 0.8 ? 2 * Math.PI : 0;
    d.gAxis = [rel.x, rel.y, rel.z];
    d.gTurn = rel.a + extra;
    const omega0 = clamp(v / (dieSize() * 0.45) + Math.abs(d.spin) + wlen, 5, 15);
    d.gDur = clamp((2 * d.gTurn) / omega0, 0.6, 1.25);
    const S = dieSize(), off = S * 0.62, pp = playPad(), hs = S * 0.44;
    d.gx0 = d.x; d.gy0 = d.y;
    d.gTx = clamp(VW * 0.5 + (k ? off : -off) + (Math.random() - 0.5) * S * 0.3, pp.loX + hs, pp.hiX - hs);
    d.gTy = clamp((pp.loY + pp.hiY) * 0.5 + (k ? -1 : 1) * S * 0.16 + (Math.random() - 0.5) * S * 0.4, pp.loY + hs, pp.hiY - hs);
    d.gT = 0; d.gP = 1; d.spin = 0; d.wob = [0, 0, 0];
  }

  function collide(a: Dado, b: Dado) {
    if (a.settled && b.settled) return;
    const S = dieSize(), min = S * 0.82;
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.001;
    if (dist >= min) return;
    const nx = dx / dist, ny = dy / dist, ov = (min - dist) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) {
      const imp = (-1.4 * vn) / 2;
      a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
      a.spin += (Math.random() - 0.5) * 6; b.spin += (Math.random() - 0.5) * 6;
      wobKick(a, 9); wobKick(b, 9);
      const f = clamp(Math.abs(vn) / (VW * 0.9), 0, 1);
      if (f > 0.08) {
        fx?.onCollide?.(f);
        puff((a.x + b.x) / 2, (a.y + b.y) / 2, 5, f);
        shake = Math.min(8, shake + f * 3);
      }
    }
  }
  function bounce(d: Dado, axis: 'x' | 'y', lo: number, hi: number) {
    const v0 = axis === 'x' ? d.vx : d.vy;
    if (axis === 'x') {
      if (d.x < lo) { d.x = lo; d.vx = Math.abs(d.vx) * 0.44; }
      else if (d.x > hi) { d.x = hi; d.vx = -Math.abs(d.vx) * 0.44; }
      else return;
    } else {
      if (d.y < lo) { d.y = lo; d.vy = Math.abs(d.vy) * 0.44; }
      else if (d.y > hi) { d.y = hi; d.vy = -Math.abs(d.vy) * 0.44; }
      else return;
    }
    d.spin += (Math.random() - 0.5) * 4; wobKick(d, 6);
    const f = clamp(Math.abs(v0) / (VW * 0.75), 0, 1);
    if (f > 0.06) {
      fx?.onBounce?.(f);
      puff(d.x, d.y, 4 + (f * 5) | 0, f);
      ringAt(d.x, d.y, f * 0.7);
      if (f > 0.28) shake = Math.min(8, shake + f * 4);
    }
  }

  function step(dt: number) {
    const pp = playPad(), S = dieSize(), hs = S * 0.44, h = S * 0.5, gz = VH * 7;
    for (let k = 0; k < 2; k++) {
      const d = dice[k];
      d.sq *= Math.exp(-9 * dt);
      if (d.settled) continue;
      if (d.z > 0 || d.vz !== 0) {
        d.vz -= gz * dt; d.z += d.vz * dt;
        if (d.z <= 0) {
          d.z = 0;
          const impact = Math.abs(d.vz);
          if (impact > VH * 0.35) {
            const f = clamp(impact / (VH * 2.2), 0, 1);
            d.vz = -d.vz * 0.4; d.vx *= 0.85; d.vy *= 0.85; wobKick(d, 7);
            d.sq = Math.min(0.2, 0.05 + f * 0.16);
            fx?.onLand?.(f);
            puff(d.x, d.y, 6 + (f * 8) | 0, f);
            ringAt(d.x, d.y, f);
            shake = Math.min(8, shake + f * 5);
          } else d.vz = 0;
        }
      }
      const air = d.z > 1.5;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (!air) { const f = Math.exp(-3.6 * dt); d.vx *= f; d.vy *= f; d.spin *= Math.exp(-2.9 * dt); }
      const wdmp = Math.exp(-(air ? 0.9 : 3.4) * dt);
      d.wob[0] *= wdmp; d.wob[1] *= wdmp; d.wob[2] *= wdmp;
      bounce(d, 'x', pp.loX + hs, pp.hiX - hs);
      bounce(d, 'y', pp.loY + hs, pp.hiY - hs);

      const v = speed(d), wlen = Math.hypot(d.wob[0], d.wob[1], d.wob[2]);
      if (d.gP === 0) {
        if (!air && v > 2) {
          const ax = -d.vy / v, ay = -d.vx / v;
          const roll = clamp(v / (h * 0.9), 0, 26);
          d.rot = m3mul(m3rot(ax, ay, 0, roll * dt), d.rot);
        }
        if (wlen > 0.002) d.rot = m3mul(m3rot(d.wob[0] / wlen, d.wob[1] / wlen, d.wob[2] / wlen, wlen * dt), d.rot);
        if (Math.abs(d.spin) > 0.002) d.rot = m3mul(m3rot(0, 0, 1, d.spin * dt), d.rot);
        d.rot = m3ortho(d.rot);
        if (d.z === 0 && (animT > 1.4 || (animT > 0.55 && v < 260))) startGuide(d, k, v, wlen);
      } else {
        d.gT += dt;
        const s = clamp(d.gT / d.gDur, 0, 1);
        const ease = s * (2 - s);
        d.rot = m3ortho(m3mul(m3rot(d.gAxis[0], d.gAxis[1], d.gAxis[2], d.gTurn * ease), d.gFrom));
        d.x = d.gx0 + (d.gTx - d.gx0) * ease;
        d.y = d.gy0 + (d.gTy - d.gy0) * ease;
        d.vx = d.vy = 0;
        if (s >= 1) { d.rot = d.gTarget.slice(); d.x = d.gTx; d.y = d.gTy; d.settled = true; }
      }
    }
    collide(dice[0], dice[1]);
    if (animT > 3.5) {
      for (let z = 0; z < 2; z++) {
        const dz = dice[z];
        if (dz.settled) continue;
        if (dz.gP === 0) startGuide(dz, z, speed(dz), Math.hypot(dz.wob[0], dz.wob[1], dz.wob[2]));
        if (animT > 4.7) { dz.rot = dz.gTarget.slice(); dz.settled = true; }
      }
    }

    shake *= Math.exp(-7 * dt);
    flash *= Math.exp(-1.8 * dt);
    gold7 *= Math.exp(-0.95 * dt);
    if (lastLucky && gold7 < 0.14) gold7 = 0.1 + 0.045 * (0.5 + 0.5 * Math.sin(idleT * 0.55));
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt / p.max; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.exp(-3.2 * dt); p.vy *= Math.exp(-3.2 * dt); p.vy += 40 * dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += (r.max - r.r) * (1 - Math.exp(-5 * dt));
      r.a *= Math.exp(-3.4 * dt);
      if (r.a < 0.012) rings.splice(i, 1);
    }
  }

  // ---------- dibujo ----------
  function coverImg(im: HTMLImageElement, x: number, y: number, w: number, hh: number) {
    const ir = im.naturalWidth / im.naturalHeight, r = w / hh; let dw: number, dh: number;
    if (ir > r) { dh = hh; dw = hh * ir; } else { dw = w; dh = w / ir; }
    cx.drawImage(im, x + (w - dw) / 2, y + (hh - dh) / 2, dw, dh);
  }
  function drawFondoMesa(im: HTMLImageElement, a: AjusteFondoMesa) {
    const ir = im.naturalWidth / im.naturalHeight, cr = VW / VH;
    let bw: number, bh: number;
    if (ir > cr) { bh = VH; bw = VH * ir; } else { bw = VW; bh = VW / ir; }
    const z = Math.max(1, a.zoom / 100);
    bw *= z; bh *= z;
    const ox = (VW - bw) * (a.x / 100), oy = (VH - bh) * (a.y / 100);
    cx.save();
    if (a.blur > 0) cx.filter = `blur(${a.blur}px)`;
    cx.drawImage(im, ox, oy, bw, bh);
    cx.restore();
    if (a.osc > 0) { cx.fillStyle = `rgba(0,0,0,${a.osc / 100})`; cx.fillRect(0, 0, VW, VH); }
  }
  function hull2(pts: number[][]) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const lo: number[][] = [], hi: number[][] = [];
    const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    for (let i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (let i = p.length - 1; i >= 0; i--) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p[i]) <= 0) hi.pop(); hi.push(p[i]); }
    lo.pop(); hi.pop(); return lo.concat(hi);
  }
  function roundPoly(pts: number[][], rad: number) {
    const n = pts.length; if (n < 3) return;
    cx.beginPath();
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const v1x = p0[0] - p1[0], v1y = p0[1] - p1[1], l1 = Math.hypot(v1x, v1y) || 1;
      const v2x = p2[0] - p1[0], v2y = p2[1] - p1[1], l2 = Math.hypot(v2x, v2y) || 1;
      const r = Math.min(rad, l1 * 0.5, l2 * 0.5);
      const a1x = p1[0] + (v1x / l1) * r, a1y = p1[1] + (v1y / l1) * r;
      const a2x = p1[0] + (v2x / l2) * r, a2y = p1[1] + (v2y / l2) * r;
      if (i === 0) cx.moveTo(a1x, a1y); else cx.lineTo(a1x, a1y);
      cx.quadraticCurveTo(p1[0], p1[1], a2x, a2y);
    }
    cx.closePath();
  }

  function poly(pts: number[][]) {
    cx.beginPath();
    cx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
    cx.closePath();
  }

  function drawFelt() {
    const g = tableGeom();
    const { x0, x1, y0, y1 } = g;
    const FACE = Math.max(28, Math.min(VW, VH) * 0.09);
    const LIPW = Math.max(9, Math.min(VW, VH) * 0.032);
    const rad = Math.max(9, Math.min(VW, VH) * 0.036);
    const side = lerp3(feltLo, hexRgb(railB), 0.55);
    const sideHi = lerp3(side, hexRgb(railA), 0.35);
    const outer = (z: number) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
    const inner = (z: number) => [P(x0 + LIPW, y0 + LIPW, z), P(x1 - LIPW, y0 + LIPW, z), P(x1 - LIPW, y1 - LIPW, z), P(x0 + LIPW, y1 - LIPW, z)];
    const top = outer(0);
    const bot = outer(-FACE);

    cx.save();
    cx.filter = 'blur(10px)';
    const sh = bot.map((p) => [p[0] + 3, p[1] + FACE * SINT * 0.55 + 8]);
    poly(sh);
    cx.fillStyle = 'rgba(0,0,0,0.42)';
    cx.fill();
    cx.restore();

    poly([P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, -FACE), P(x0, y0, -FACE)]);
    cx.fillStyle = rgb(lerp3(side, [0, 0, 0], 0.18));
    cx.fill();
    poly([P(x1, y0, 0), P(x1, y0, -FACE), P(x1, y1, -FACE), P(x1, y1, 0)]);
    cx.fillStyle = rgb(lerp3(sideHi, [0, 0, 0], 0.08));
    cx.fill();
    poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, -FACE), P(x0, y0, -FACE)]);
    cx.fillStyle = rgb(lerp3(side, [0, 0, 0], 0.28));
    cx.fill();

    const front = [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, -FACE), P(x0, y1, -FACE)];
    poly(front);
    const fg = cx.createLinearGradient(0, P(x0, y1, 0)[1], 0, P(x0, y1, -FACE)[1]);
    fg.addColorStop(0, rgb(sideHi));
    fg.addColorStop(0.12, lip);
    fg.addColorStop(0.18, rgb(lerp3(hexRgb(railA), side, 0.4)));
    fg.addColorStop(1, rgb(lerp3(hexRgb(railB), [0, 0, 0], 0.25)));
    cx.fillStyle = fg;
    cx.fill();
    for (const gn of GRAIN) {
      const t = gn[0];
      const a = P(x0 + (x1 - x0) * t, y1, -2);
      const b = P(x0 + (x1 - x0) * t, y1, -FACE * 0.92);
      cx.strokeStyle = gn[3] ? 'rgba(255,230,190,0.12)' : 'rgba(0,0,0,0.22)';
      cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
    }

    roundPoly(top, rad);
    const [tl, tr, br, bl] = top;
    const cx0 = (tl[0] + tr[0] + br[0] + bl[0]) / 4;
    const cy0 = (tl[1] + tr[1] + br[1] + bl[1]) / 4;
    const grad = cx.createRadialGradient(cx0, cy0 - (y1 - y0) * 0.12, VH * 0.04, cx0, cy0, Math.hypot(VW, VH) * 0.5);
    grad.addColorStop(0, gradFeltA);
    grad.addColorStop(0.55, rgb(lerp3(feltHi, feltLo, 0.45)));
    grad.addColorStop(1, gradFeltB);
    cx.fillStyle = grad;
    cx.fill();

    cx.save();
    roundPoly(top, rad); cx.clip();
    if (fondoImg && fondoImg.complete && fondoImg.naturalWidth > 0) {
      if (fondoAj) drawFondoMesa(fondoImg, fondoAj);
      else coverImg(fondoImg, 0, 0, VW, VH);
      roundPoly(top, rad);
      cx.globalAlpha = veloN; cx.fillStyle = grad; cx.fill(); cx.globalAlpha = 1;
    }
    cx.fillStyle = '#fff';
    for (const s of SPECKLE) {
      const q = P(s[0] * VW, s[1] * VH, 0);
      cx.globalAlpha = s[3]; cx.beginPath(); cx.arc(q[0], q[1], s[2] * depthS(s[1] * VH), 0, 7); cx.fill();
    }
    cx.fillStyle = '#000';
    for (const s of NAP) {
      const q = P(s[0] * VW, s[1] * VH, 0);
      cx.globalAlpha = s[3]; cx.beginPath(); cx.arc(q[0], q[1], s[2] * depthS(s[1] * VH), 0, 7); cx.fill();
    }
    cx.globalAlpha = 1;
    const pulse = 0.5 + 0.5 * Math.sin(idleT * 0.55);
    const l1 = cx.createRadialGradient(P(VW * 0.32, VH * 0.22, 0)[0], P(VW * 0.32, VH * 0.22, 0)[1], 6, cx0, cy0, VH * 0.7);
    l1.addColorStop(0, `rgba(255,248,230,${0.07 + 0.055 * pulse})`); l1.addColorStop(1, 'rgba(255,248,230,0)');
    cx.fillStyle = l1; cx.fillRect(0, 0, VW, VH);
    const l2 = cx.createRadialGradient(P(VW * 0.7, VH * 0.28, 0)[0], P(VW * 0.7, VH * 0.28, 0)[1], 4, cx0, cy0, VH * 0.55);
    l2.addColorStop(0, `rgba(255,255,255,${0.03 + 0.035 * pulse})`); l2.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = l2; cx.fillRect(0, 0, VW, VH);

    const mk = P(VW * 0.5, (y0 + y1) * 0.5, 0);
    const dw = Math.min(VW, VH) * 0.12 * depthS((y0 + y1) * 0.5);
    const dh = dw * 0.55;
    cx.strokeStyle = rgba(lipRgb, 0.18 + gold7 * 0.5);
    cx.lineWidth = 1.15 + gold7 * 1.4;
    cx.beginPath();
    cx.moveTo(mk[0], mk[1] - dh); cx.lineTo(mk[0] + dw, mk[1]); cx.lineTo(mk[0], mk[1] + dh); cx.lineTo(mk[0] - dw, mk[1]);
    cx.closePath(); cx.stroke();
    cx.save();
    cx.globalAlpha = 0.06 + gold7 * 0.55 + flash * 0.2;
    cx.fillStyle = rgb(lerp3(lipRgb, [255, 230, 150], 0.45));
    cx.font = `700 ${Math.min(VW, VH) * 0.2 * depthS((y0 + y1) * 0.5)}px Georgia, 'Times New Roman', serif`;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('7', mk[0], mk[1] + 2);
    cx.restore();

    const vig = cx.createRadialGradient(cx0, cy0, Math.min(VW, VH) * 0.14, cx0, cy0, Math.hypot(VW, VH) * 0.52);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.32)');
    cx.fillStyle = vig; cx.fillRect(0, 0, VW, VH);
    if (flash > 0.02) {
      const fl = cx.createRadialGradient(mk[0], mk[1], 8, mk[0], mk[1], Math.min(VW, VH) * 0.5);
      fl.addColorStop(0, rgba([255, 220, 120], 0.2 * flash));
      fl.addColorStop(1, 'rgba(255,220,120,0)');
      cx.fillStyle = fl; cx.fillRect(0, 0, VW, VH);
    }
    cx.restore();

    const lipPts = inner(0);
    cx.lineWidth = Math.max(2.1, LIPW * 0.22);
    cx.strokeStyle = lip;
    roundPoly(lipPts, rad * 0.7); cx.stroke();
    cx.lineWidth = 1;
    cx.strokeStyle = 'rgba(255,255,255,0.28)';
    roundPoly(lipPts, rad * 0.7); cx.stroke();

    cx.lineWidth = 1.2;
    cx.strokeStyle = 'rgba(255,255,255,0.14)';
    roundPoly(top, rad); cx.stroke();
    const nearA = P(x0 + 4, y1, 0.6), nearB = P(x1 - 4, y1, 0.6);
    cx.strokeStyle = 'rgba(255,255,255,0.2)';
    cx.lineWidth = 1.4;
    cx.beginPath(); cx.moveTo(nearA[0], nearA[1]); cx.lineTo(nearB[0], nearB[1]); cx.stroke();
  }

  function drawRings() {
    for (const r of rings) {
      const q = P(r.x, r.y, 0);
      const s = depthS(r.y);
      cx.save();
      cx.translate(q[0], q[1] + 4 * s); cx.scale(s, 0.48 * s);
      cx.beginPath(); cx.arc(0, 0, r.r, 0, 7);
      cx.strokeStyle = rgba(lipRgb, r.a * 0.55);
      cx.lineWidth = 1.4; cx.stroke();
      cx.restore();
    }
  }
  function drawParts() {
    for (const p of parts) {
      const q = P(p.x, p.y, 0);
      const s = depthS(p.y);
      cx.globalAlpha = clamp(p.life, 0, 1);
      cx.fillStyle = rgb(p.col);
      cx.beginPath(); cx.arc(q[0], q[1], p.r * (0.6 + p.life * 0.4) * s, 0, 7); cx.fill();
    }
    cx.globalAlpha = 1;
  }
  function drawShadow(d: Dado) {
    const s = depthS(d.y);
    const hh = dieSize() * 0.5 * dieScale(d), lift = d.z;
    const a = 0.46 * clamp(1 - lift / (VH * 0.7), 0.08, 1);
    const w = hh * (1.15 + lift / (VH * 1.05)) * (1 + d.sq * 0.5);
    const q = P(d.x, d.y, 0);
    cx.save();
    cx.translate(q[0] + 2 * s + lift * 0.03 * s, q[1] + hh * 0.58 + 2 * s + lift * 0.05 * s);
    cx.scale(s, 0.42 * s);
    const rgd = cx.createRadialGradient(0, 0, hh * 0.08, 0, 0, w);
    rgd.addColorStop(0, `rgba(0,0,0,${a})`);
    rgd.addColorStop(0.45, `rgba(0,0,0,${a * 0.45})`);
    rgd.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = rgd; cx.beginPath(); cx.arc(0, 0, w, 0, 7); cx.fill();
    cx.restore();
  }
  function drawDie(d: Dado) {
    const s = depthS(d.y);
    const h = dieSize() * 0.5 * dieScale(d);
    const [cxp, cyp] = P(d.x, d.y, 0);
    const hc = d.z * s + h * 0.62;
    const tw = idleT * 0.65;
    const L = [LIGHT[0] + Math.sin(tw) * 0.1, LIGHT[1] + Math.cos(tw * 0.8) * 0.07, LIGHT[2]];
    const Ll = Math.hypot(L[0], L[1], L[2]) || 1;
    L[0] /= Ll; L[1] /= Ll; L[2] /= Ll;
    cx.save();
    if (d.sq > 0.002) {
      cx.translate(cxp, cyp);
      cx.scale(1 + d.sq * 0.55, 1 - d.sq);
      cx.translate(-cxp, -cyp);
    }
    const scr = (p: number[]) => { const w = m3v(d.rot, p), wz = w[2] + hc; return [cxp + w[0] * s, cyp - (w[1] * COST + wz * SINT)]; };
    const camZ = (dir: number[]) => { const w = m3v(d.rot, dir); return -w[1] * SINT + w[2] * COST; };
    const corners: number[][] = [];
    for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) for (let sz = -1; sz <= 1; sz += 2) corners.push(scr([sx * h, sy * h, sz * h]));
    const sil = hull2(corners);
    const m = receta;

    roundPoly(sil, h * 0.36);
    if (m.glass) {
      cx.fillStyle = `rgba(${col.lo[0] | 0},${col.lo[1] | 0},${col.lo[2] | 0},${0.22 + m.trans * 0.25})`;
    } else {
      cx.fillStyle = rgb(lerp3(col.lo, [0, 0, 0], 0.22));
    }
    cx.fill();
    cx.lineWidth = 2.4;
    cx.strokeStyle = `rgba(255,255,255,${0.07 + m.rim * 0.22})`;
    cx.stroke();
    cx.lineWidth = 1;
    cx.strokeStyle = 'rgba(0,0,0,0.22)';
    cx.stroke();

    const order = CUBE.map((f) => ({ f, dp: camZ(f.n) })).sort((a, b) => a.dp - b.dp);
    const IN = 0.8;
    const pintarCara = (f: (typeof CUBE)[number], nz: number, atras: boolean) => {
      const N = m3v(d.rot, f.n);
      const lam = Math.max(0, N[0] * L[0] + N[1] * L[1] + N[2] * L[2]);
      const ndl = lam;
      const Rx = 2 * ndl * N[0] - L[0], Ry = 2 * ndl * N[1] - L[1], Rz = 2 * ndl * N[2] - L[2];
      const rvl = Math.hypot(Rx, Ry, Rz) || 1;
      const spec = Math.pow(Math.max(0, (Rx * VIEW[0] + Ry * VIEW[1] + Rz * VIEW[2]) / rvl), m.specPow) * m.spec;
      const fres = Math.pow(1 - clamp(Math.abs(nz), 0, 1), 2) * m.rim;
      const sh = 0.38 + 0.62 * lam;
      const q = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map((su) => scr([
        (f.n[0] + (f.u[0] * su[0] + f.v[0] * su[1]) * IN) * h,
        (f.n[1] + (f.u[1] * su[0] + f.v[1] * su[1]) * IN) * h,
        (f.n[2] + (f.u[2] * su[0] + f.v[2] * su[1]) * IN) * h,
      ]));
      const el = Math.min(Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]), Math.hypot(q[1][0] - q[2][0], q[1][1] - q[2][1]));
      roundPoly(q, el * 0.26);
      const base = lerp3(col.lo, col.hi, sh);
      const specCol = m.metal > 0.5 ? lerp3(base, col.hi, 0.65) : [245, 248, 255];
      const lit = lerp3(base, specCol, clamp(spec * (m.metal > 0.5 ? 0.9 : 0.55) + fres * 0.35, 0, 1));
      if (atras || m.glass) {
        const a = atras ? 0.12 + m.trans * 0.22 : 0.72 + (1 - m.trans) * 0.2;
        cx.fillStyle = `rgba(${lit[0] | 0},${lit[1] | 0},${lit[2] | 0},${a})`;
      } else {
        cx.fillStyle = rgb(lit);
      }
      cx.fill();
      cx.lineWidth = 1;
      cx.strokeStyle = `rgba(255,255,255,${0.04 + 0.16 * lam + fres * 0.25})`;
      cx.stroke();

      if (!atras && spec > 0.12 && nz > 0.2) {
        const cxq = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
        const cyq = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
        const hx = cxq - N[0] * el * 0.12 + L[0] * el * 0.18;
        const hy = cyq + N[1] * el * 0.08 - L[1] * el * 0.12;
        cx.save();
        roundPoly(q, el * 0.26); cx.clip();
        const rg = cx.createRadialGradient(hx, hy, 0, hx, hy, el * (m.glass ? 0.55 : 0.42));
        rg.addColorStop(0, `rgba(255,255,255,${clamp(spec * 0.85, 0, 0.7)})`);
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = rg; cx.fillRect(hx - el, hy - el, el * 2, el * 2);
        cx.restore();
      }

      if (!atras && nz > 0.14) {
        const pr = h * 0.125 * clamp(nz, 0.35, 1);
        for (const pt of FACES[f.val]) {
          const pp = scr([
            (f.n[0] + (f.u[0] * pt[0] + f.v[0] * pt[1]) * 0.52) * h,
            (f.n[1] + (f.u[1] * pt[0] + f.v[1] * pt[1]) * 0.52) * h,
            (f.n[2] + (f.u[2] * pt[0] + f.v[2] * pt[1]) * 0.52) * h,
          ]);
          if (m.pipWell > 0.2) {
            cx.fillStyle = `rgba(0,0,0,${0.22 * m.pipWell})`;
            cx.beginPath(); cx.arc(pp[0] + pr * 0.12, pp[1] + pr * 0.14, pr * 1.18, 0, 7); cx.fill();
          }
          cx.fillStyle = rgb(lerp3(col.pip, col.lo, (1 - nz) * 0.35));
          cx.beginPath(); cx.arc(pp[0], pp[1], pr, 0, 7); cx.fill();
          cx.fillStyle = `rgba(255,255,255,${0.22 + 0.2 * lam})`;
          cx.beginPath(); cx.arc(pp[0] - pr * 0.28, pp[1] - pr * 0.3, pr * 0.28, 0, 7); cx.fill();
        }
      }
    };

    if (m.glass) {
      for (const { f, dp: nz } of order) {
        if (nz >= -0.04) continue;
        pintarCara(f, nz, true);
      }
    }
    for (const { f, dp: nz } of order) {
      if (nz < 0.03) continue;
      pintarCara(f, nz, false);
    }
    cx.restore();
  }
  function draw() {
    if (!VW) return;
    cx.save();
    if (shake > 0.15) {
      const m = shake * 0.45;
      cx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    cx.clearRect(-8, -8, VW + 16, VH + 16);
    drawFelt();
    drawRings();
    drawShadow(dice[0]); drawShadow(dice[1]);
    drawDie(dice[0]); drawDie(dice[1]);
    drawParts();
    cx.restore();
  }

  function maybeSettle() {
    if (settledSent || !(dice[0].settled && dice[1].settled)) return;
    settledSent = true;
    lastLucky = pend[0] + pend[1] === 7;
    if (lastLucky) celebrate();
    fx?.onSettle?.();
    const done = resolver; resolver = null;
    if (done) setTimeout(done, 280);
  }

  function frame(ts: number) {
    if (!last) last = ts;
    const dt = Math.min(0.032, (ts - last) / 1000); last = ts;
    animT += dt;
    step(dt);
    if (dice[0].settled && dice[1].settled) {
      maybeSettle();
      idleT += dt;
      draw();
      if (!reduce) { raf = requestAnimationFrame(frame); return; }
      raf = 0; last = 0;
      return;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function tirar(resultado: [number, number]): Promise<void> {
    pend = [clamp(Math.round(resultado[0]), 1, 6), clamp(Math.round(resultado[1]), 1, 6)];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    fit();
    if (reduce || !VW) {
      reposar(pend);
      if (pend[0] + pend[1] === 7) { gold7 = 1; flash = 0.6; draw(); }
      fx?.onSettle?.();
      return new Promise((res) => setTimeout(res, 240));
    }
    lanzar();
    animT = 0; last = 0;
    return new Promise((res) => { resolver = res; raf = requestAnimationFrame(frame); });
  }

  let ro: ResizeObserver | null = null;
  fit();
  reposar(pend);
  settledSent = true;
  if (!reduce) { last = 0; raf = requestAnimationFrame(frame); }
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(canvas); }
  if (typeof window !== 'undefined') window.addEventListener('resize', fit);

  return {
    tirar,
    resize: fit,
    reposar,
    setFondo(img, ajuste, velo) {
      fondoImg = img; fondoAj = ajuste; veloN = velo;
      if (img && !img.complete) img.addEventListener('load', () => { if (!raf) draw(); }, { once: true });
      if (!raf) draw();
    },
    setPaleta(p) {
      paletaDe(p);
      if (!raf) draw();
    },
    destruir() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; resolver = null;
      ro?.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    },
  };
}
