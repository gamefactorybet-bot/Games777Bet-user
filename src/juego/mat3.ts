// Álgebra de matrices 3×3 (row-major) para orientación de sólidos.
// Pura, sin dependencias. La usa el renderer de dados 3D.

export type M3 = number[]; // 9 números, row-major

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function m3mul(a: M3, b: M3): M3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

export function m3v(m: M3, v: number[]): number[] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Rotación `ang` (rad) alrededor del eje unitario (x,y,z). */
export function m3rot(x: number, y: number, z: number, ang: number): M3 {
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

/** Gram-Schmidt: frena la deriva numérica al acumular rotaciones. */
export function m3ortho(m: M3): M3 {
  let xx = m[0], xy = m[3], xz = m[6], yx = m[1], yy = m[4], yz = m[7];
  let l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const d = xx * yx + xy * yy + xz * yz; yx -= d * xx; yy -= d * xy; yz -= d * xz;
  l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
  const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
  return [xx, yx, zx, xy, yy, zy, xz, yz, zz];
}

export function m3T(m: M3): M3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Rotación 3×3 → eje-ángulo `{x,y,z,a}` (eje unitario, a en [0,π]). */
export function m3axisAngle(m: M3): { x: number; y: number; z: number; a: number } {
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
