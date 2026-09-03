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
// =========================================================

export interface PaletaDados {
  /** Fieltro: centro y borde del degradado radial. */
  feltA: string;
  feltB: string;
  /** Dado: claro y oscuro del degradado de cara. */
  dieHi: string;
  dieLo: string;
  /** Color de los puntos. */
  pip: string;
}

export interface OpcionesDados3D {
  paleta: PaletaDados;
  /** Imagen de fondo de la mesa (se dibuja bajo el fieltro con un velo). */
  fondo?: HTMLImageElement | null;
  /** Opacidad del velo del color del fieltro sobre la imagen (0-1). */
  velo?: number;
  /** Inclinación de cámara en radianes (0 = totalmente cenital). */
  tilt?: number;
  /** Respeta prefers-reduced-motion (salta a resultado). Por defecto sí. */
  animar?: boolean;
}

type M3 = number[]; // 3x3 row-major

// ---------- álgebra 3x3 ----------
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function m3mul(a: M3, b: M3): M3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}
function m3v(m: M3, v: number[]): number[] {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
function m3rot(x: number, y: number, z: number, ang: number): M3 {
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
function m3ortho(m: M3): M3 {
  let xx = m[0], xy = m[3], xz = m[6], yx = m[1], yy = m[4], yz = m[7];
  let l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const d = xx * yx + xy * yy + xz * yz; yx -= d * xx; yy -= d * xy; yz -= d * xz;
  l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
  const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
  return [xx, yx, zx, xy, yy, zy, xz, yz, zz];
}
function m3T(m: M3): M3 { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
function m3axisAngle(m: M3) {
  const ct = clamp((m[0] + m[4] + m[8] - 1) / 2, -1, 1), a = Math.acos(ct);
  if (a < 1e-5) return { x: 1, y: 0, z: 0, a: 0 };
  if (a > Math.PI - 1e-4) {
    const xx = (m[0] + 1) / 2, yy = (m[4] + 1) / 2, zz = (m[8] + 1) / 2;
    const xy = (m[1] + m[3]) / 4, xz = (m[2] + m[6]) / 4, yz = (m[5] + m[7]) / 4;
    let x: number, y: number, z: number;
    if (xx >= yy && xx >= zz) { x = Math.sqrt(Math.max(xx, 0)); y = xy / x; z = xz / x; }
    else if (yy >= zz) { y = Math.sqrt(Math.max(yy, 0)); x = xy / y; z = yz / y; }
    else { z = Math.sqrt(Math.max(zz, 0)); x = xz / z; y = yz / z; }
    const l = Math.hypot(x, y, z) || 1;
    return { x: x / l, y: y / l, z: z / l, a: Math.PI };
  }
  const s = 2 * Math.sin(a);
  return { x: (m[7] - m[5]) / s, y: (m[2] - m[6]) / s, z: (m[3] - m[1]) / s, a };
}

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

interface Dado {
  x: number; y: number; vx: number; vy: number; z: number; vz: number; zPk: number;
  rot: M3; spin: number; wob: number[];
  gP: number; gT: number; gDur: number; gTurn: number; gAxis: number[];
  gFrom: M3; gTarget: M3; gx0: number; gy0: number; gTx: number; gTy: number;
  settled: boolean;
}

export interface Dados3D {
  tirar(resultado: [number, number]): Promise<void>;
  resize(): void;
  destruir(): void;
  reposar(dados: [number, number]): void;
}

export function crearDados3D(canvas: HTMLCanvasElement, opts: OpcionesDados3D): Dados3D {
  const cx = canvas.getContext('2d')!;
  const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const TILT = opts.tilt ?? 0.38;
  const COST = Math.cos(TILT), SINT = Math.sin(TILT);
  const LIGHT = (() => { const x = -0.5, y = 0.32, z = 0.8, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  const reduce = opts.animar === false
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  let VW = 0, VH = 0;
  const SPECKLE: number[][] = [];
  for (let i = 0; i < 150; i++) SPECKLE.push([Math.random(), Math.random(), Math.random() * 1.4 + 0.3, Math.random() * 0.05]);
  const col = { hi: hexRgb(opts.paleta.dieHi), lo: hexRgb(opts.paleta.dieLo), pip: hexRgb(opts.paleta.pip) };
  const gradFeltA = opts.paleta.feltA, gradFeltB = opts.paleta.feltB;

  const dieSize = () => clamp(Math.min(VW * 0.15, VH * 0.19), 44, 78);
  const diePad = () => Math.max(12, dieSize() * 0.32);
  const speed = (d: Dado) => Math.hypot(d.vx, d.vy);
  const dieScale = (d: Dado) => 0.8 + 0.45 * clamp(d.z / (d.zPk || 1), 0, 1);

  const mk = (): Dado => ({
    x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, zPk: 1, rot: I3.slice(), spin: 0, wob: [0, 0, 0],
    gP: 0, gT: 0, gDur: 0, gTurn: 0, gAxis: [1, 0, 0], gFrom: I3.slice(), gTarget: I3.slice(),
    gx0: 0, gy0: 0, gTx: 0, gTy: 0, settled: true,
  });
  const dice: Dado[] = [mk(), mk()];
  let pend: [number, number] = [3, 4];
  let resolver: (() => void) | null = null;
  let raf = 0, last = 0, animT = 0;

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
    dice[0].x = VW * 0.5 - S * 0.7; dice[0].y = VH * 0.53;
    dice[1].x = VW * 0.5 + S * 0.7; dice[1].y = VH * 0.47;
    dice.forEach((d, k) => {
      d.z = 0; d.vx = d.vy = d.vz = d.spin = 0; d.wob = [0, 0, 0]; d.gP = 0; d.settled = true;
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
    const pad = diePad(), S = dieSize();
    dice.forEach((d, k) => {
      const dir = k ? 1 : -1;
      d.x = VW * 0.5 + dir * S * (0.5 + Math.random() * 0.4);
      d.y = VH - pad - S * 0.5 - Math.random() * 14;
      d.vx = dir * VW * (0.2 + Math.random() * 0.26) + (Math.random() * 70 - 35);
      d.vy = -VH * (1.12 + Math.random() * 0.5);
      d.z = 1; d.vz = VH * (1.95 + Math.random() * 0.55);
      d.zPk = (d.vz * d.vz) / (2 * VH * 7);
      d.spin = (Math.random() * 2 - 1) * 9 + dir * 3;
      d.wob = [(Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 5];
      d.rot = m3ortho(randRot());
      d.gP = 0; d.settled = false;
    });
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
    const S = dieSize(), off = S * 0.62, m = diePad() + S * 0.44;
    d.gx0 = d.x; d.gy0 = d.y;
    d.gTx = clamp(VW * 0.5 + (k ? off : -off) + (Math.random() - 0.5) * S * 0.3, m, VW - m);
    d.gTy = clamp(VH * 0.5 + (k ? -1 : 1) * S * 0.16 + (Math.random() - 0.5) * S * 0.4, m, VH - m);
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
    }
  }
  function bounce(d: Dado, axis: 'x' | 'y', lo: number, hi: number) {
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
  }

  function step(dt: number) {
    const pad = diePad(), S = dieSize(), hs = S * 0.44, h = S * 0.5, gz = VH * 7;
    for (let k = 0; k < 2; k++) {
      const d = dice[k];
      if (d.settled) continue;
      if (d.z > 0 || d.vz !== 0) {
        d.vz -= gz * dt; d.z += d.vz * dt;
        if (d.z <= 0) { d.z = 0; if (Math.abs(d.vz) > VH * 0.35) { d.vz = -d.vz * 0.4; d.vx *= 0.85; d.vy *= 0.85; wobKick(d, 7); } else d.vz = 0; }
      }
      const air = d.z > 1.5;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (!air) { const f = Math.exp(-3.6 * dt); d.vx *= f; d.vy *= f; d.spin *= Math.exp(-2.9 * dt); }
      const wdmp = Math.exp(-(air ? 0.9 : 3.4) * dt);
      d.wob[0] *= wdmp; d.wob[1] *= wdmp; d.wob[2] *= wdmp;
      bounce(d, 'x', pad + hs, VW - pad - hs);
      bounce(d, 'y', pad + hs, VH - pad - hs);

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
  }

  // ---------- dibujo ----------
  function roundRectPath(x: number, y: number, w: number, hh: number, r: number) {
    if (cx.roundRect) { cx.beginPath(); cx.roundRect(x, y, w, hh, r); return; }
    cx.beginPath();
    cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + hh, r); cx.arcTo(x + w, y + hh, x, y + hh, r);
    cx.arcTo(x, y + hh, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }
  function coverImg(im: HTMLImageElement, x: number, y: number, w: number, hh: number) {
    const ir = im.naturalWidth / im.naturalHeight, r = w / hh; let dw: number, dh: number;
    if (ir > r) { dh = hh; dw = hh * ir; } else { dw = w; dh = w / ir; }
    cx.drawImage(im, x + (w - dw) / 2, y + (hh - dh) / 2, dw, dh);
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

  function drawFelt() {
    cx.save();
    roundRectPath(0, 0, VW, VH, 18);
    const g = cx.createRadialGradient(VW * 0.5, VH * 0.34, VH * 0.04, VW * 0.5, VH * 0.52, VH * 0.95);
    g.addColorStop(0, gradFeltA); g.addColorStop(1, gradFeltB);
    cx.fillStyle = g; cx.fill(); cx.clip();
    const fondo = opts.fondo;
    if (fondo && fondo.complete && fondo.naturalWidth > 0) {
      coverImg(fondo, 0, 0, VW, VH);
      cx.globalAlpha = opts.velo ?? 0.5; cx.fillStyle = g; cx.fillRect(0, 0, VW, VH); cx.globalAlpha = 1;
    }
    cx.fillStyle = '#fff';
    for (const s of SPECKLE) { cx.globalAlpha = s[3]; cx.beginPath(); cx.arc(s[0] * VW, s[1] * VH, s[2], 0, 7); cx.fill(); }
    cx.globalAlpha = 1;
    const lg = cx.createRadialGradient(VW * 0.32, VH * 0.12, 8, VW * 0.32, VH * 0.12, VH * 0.95);
    lg.addColorStop(0, 'rgba(255,255,255,0.05)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = lg; cx.fillRect(0, 0, VW, VH);
    cx.lineWidth = 26; cx.strokeStyle = 'rgba(0,0,0,0.3)'; roundRectPath(0, 0, VW, VH, 18); cx.stroke();
    cx.lineWidth = 1.5; cx.strokeStyle = 'rgba(255,255,255,0.05)'; roundRectPath(3, 3, VW - 6, VH - 6, 15); cx.stroke();
    cx.restore();
  }
  function drawShadow(d: Dado) {
    const hh = dieSize() * 0.5 * dieScale(d), lift = d.z;
    const a = 0.4 * clamp(1 - lift / (VH * 0.7), 0.07, 1);
    const w = hh * 1.3 * (1 + lift / (VH * 1.2));
    cx.save();
    cx.translate(d.x + 3 + lift * 0.03, d.y + hh * 0.6 + 3 + lift * 0.05);
    cx.scale(1, 0.5);
    const rgd = cx.createRadialGradient(0, 0, hh * 0.1, 0, 0, w);
    rgd.addColorStop(0, `rgba(0,0,0,${a})`); rgd.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = rgd; cx.beginPath(); cx.arc(0, 0, w, 0, 7); cx.fill();
    cx.restore();
  }
  function drawDie(d: Dado) {
    const h = dieSize() * 0.5 * dieScale(d);
    const cxp = d.x, cyp = d.y, hc = d.z + h * 0.62;
    const scr = (p: number[]) => { const w = m3v(d.rot, p), wz = w[2] + hc; return [cxp + w[0], cyp - (w[1] * COST + wz * SINT)]; };
    const camZ = (dir: number[]) => { const w = m3v(d.rot, dir); return -w[1] * SINT + w[2] * COST; };
    const corners: number[][] = [];
    for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) for (let sz = -1; sz <= 1; sz += 2) corners.push(scr([sx * h, sy * h, sz * h]));
    const sil = hull2(corners);
    roundPoly(sil, h * 0.36);
    cx.fillStyle = rgb(lerp3(col.lo, [0, 0, 0], 0.16)); cx.fill();
    cx.lineWidth = 1; cx.strokeStyle = 'rgba(0,0,0,0.28)'; cx.stroke();

    const order = CUBE.map((f) => ({ f, dp: camZ(f.n) })).sort((a, b) => a.dp - b.dp);
    const IN = 0.8;
    for (const { f, dp: nz } of order) {
      if (nz < 0.03) continue;
      const N = m3v(d.rot, f.n);
      const lam = Math.max(0, N[0] * LIGHT[0] + N[1] * LIGHT[1] + N[2] * LIGHT[2]);
      const sh = 0.42 + 0.58 * lam;
      const q = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map((su) => scr([
        (f.n[0] + (f.u[0] * su[0] + f.v[0] * su[1]) * IN) * h,
        (f.n[1] + (f.u[1] * su[0] + f.v[1] * su[1]) * IN) * h,
        (f.n[2] + (f.u[2] * su[0] + f.v[2] * su[1]) * IN) * h,
      ]));
      const el = Math.min(Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]), Math.hypot(q[1][0] - q[2][0], q[1][1] - q[2][1]));
      roundPoly(q, el * 0.26);
      cx.fillStyle = rgb(lerp3(col.lo, col.hi, sh)); cx.fill();
      cx.lineWidth = 1; cx.strokeStyle = `rgba(255,255,255,${0.05 + 0.13 * lam})`; cx.stroke();
      if (nz > 0.14) {
        const pr = h * 0.125 * clamp(nz, 0.35, 1);
        cx.fillStyle = rgb(lerp3(col.pip, col.lo, (1 - nz) * 0.45));
        for (const pt of FACES[f.val]) {
          const pp = scr([
            (f.n[0] + (f.u[0] * pt[0] + f.v[0] * pt[1]) * 0.52) * h,
            (f.n[1] + (f.u[1] * pt[0] + f.v[1] * pt[1]) * 0.52) * h,
            (f.n[2] + (f.u[2] * pt[0] + f.v[2] * pt[1]) * 0.52) * h,
          ]);
          cx.beginPath(); cx.arc(pp[0], pp[1], pr, 0, 7); cx.fill();
        }
      }
    }
  }
  function draw() {
    if (!VW) return;
    cx.clearRect(0, 0, VW, VH);
    drawFelt();
    drawShadow(dice[0]); drawShadow(dice[1]);
    drawDie(dice[0]); drawDie(dice[1]);
  }

  function frame(ts: number) {
    if (!last) last = ts;
    const dt = Math.min(0.032, (ts - last) / 1000); last = ts;
    animT += dt;
    step(dt); draw();
    if (dice[0].settled && dice[1].settled) {
      raf = 0; last = 0;
      const done = resolver; resolver = null;
      if (done) setTimeout(done, 220);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function tirar(resultado: [number, number]): Promise<void> {
    pend = [clamp(Math.round(resultado[0]), 1, 6), clamp(Math.round(resultado[1]), 1, 6)];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    fit();
    if (reduce || !VW) {
      reposar(pend);
      return new Promise((res) => setTimeout(res, 240));
    }
    lanzar();
    animT = 0; last = 0;
    return new Promise((res) => { resolver = res; raf = requestAnimationFrame(frame); });
  }

  // arranque
  let ro: ResizeObserver | null = null;
  fit();
  reposar(pend);
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(canvas); }
  if (typeof window !== 'undefined') window.addEventListener('resize', fit);

  return {
    tirar,
    resize: fit,
    reposar,
    destruir() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; resolver = null;
      ro?.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    },
  };
}
