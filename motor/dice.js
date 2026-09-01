// =========================================================
// MOTOR DICE — el jugador mueve un umbral entre 0 y 100 y apuesta a
// que el número que sale es MAYOR o MENOR. El pago sale de la
// probabilidad: menos chance = paga más.
//
// La misma matemática la usan el servidor (api/jugar-instant) y el
// frontend (src/Dice.tsx).
//
// RTP EXACTO con una sola perilla:
//   pago = rtp / probabilidad
// EV = probabilidad * (rtp / probabilidad) = rtp, para cualquier umbral.
// =========================================================

export const CFG_DEFAULT = {
  rtp: 0.97,
  // Chance de ganar que puede elegir el jugador (tope de riesgo).
  chanceMin: 2,
  chanceMax: 95,
  umbralDefecto: 50,
  direccionDefecto: 'mayor', // 'mayor' | 'menor'
  tema: 'clasico',
  fondoUrl: null,
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  let chMin = clamp(Math.round(num(c.chanceMin, D.chanceMin)), 1, 49);
  let chMax = clamp(Math.round(num(c.chanceMax, D.chanceMax)), 51, 98);
  if (chMax <= chMin) chMax = clamp(chMin + 10, 51, 98);
  const dir = c.direccionDefecto === 'menor' ? 'menor' : 'mayor';
  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.8, 0.999),
    chanceMin: chMin,
    chanceMax: chMax,
    umbralDefecto: clamp(num(c.umbralDefecto, D.umbralDefecto), 1, 99),
    direccionDefecto: dir,
    tema: str(c.tema, D.tema),
    fondoUrl: str(c.fondoUrl, null),
  };
}

export function rtpDe(cfg) {
  return cfgConDefaults(cfg).rtp;
}

/** Chance de ganar de un umbral + dirección, en fracción (0-1). */
export function chanceDe(umbral, direccion) {
  const u = clamp(num(umbral, 50), 0, 100);
  return direccion === 'menor' ? u / 100 : (100 - u) / 100;
}

/**
 * Umbral efectivo: se recorta para que la chance del lado elegido
 * quede dentro de [chanceMin, chanceMax] del juego.
 */
export function umbralPermitido(cfg, umbral, direccion) {
  const c = cfgConDefaults(cfg);
  const dir = direccion === 'menor' ? 'menor' : 'mayor';
  const u = clamp(Math.round(num(umbral, c.umbralDefecto) * 100) / 100, 0, 100);
  // chance(u) tiene que estar entre chanceMin% y chanceMax%
  const lo = dir === 'mayor' ? 100 - c.chanceMax : c.chanceMin;
  const hi = dir === 'mayor' ? 100 - c.chanceMin : c.chanceMax;
  return { umbral: clamp(u, lo, hi), direccion: dir };
}

/**
 * Resuelve una jugada. Devuelve:
 *  - roll: número que salió (0.00 - 100.00)
 *  - umbral, direccion: los efectivos
 *  - gano, mult, prob
 */
export function tirar(cfg, umbral, direccion) {
  const c = cfgConDefaults(cfg);
  const { umbral: u, direccion: dir } = umbralPermitido(c, umbral, direccion);
  const roll = Math.floor(Math.random() * 10001) / 100; // 0.00 .. 100.00
  const gano = dir === 'mayor' ? roll > u : roll < u;
  const prob = chanceDe(u, dir);
  const mult = prob > 0 ? c.rtp / prob : 0;
  return {
    roll,
    umbral: u,
    direccion: dir,
    prob: Math.round(prob * 10000) / 10000,
    gano,
    mult: gano ? Math.round(mult * 10000) / 10000 : 0,
  };
}
