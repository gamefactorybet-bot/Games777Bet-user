// =========================================================
// MOTOR LIMBO — el jugador elige un multiplicador objetivo, el
// servidor tira un número al azar y gana si el número llega o pasa el
// objetivo. Es la matemática del Crash sin la espera ni la animación.
//
// La misma matemática la usan el servidor (api/jugar-instant) y el
// frontend (src/Limbo.tsx).
//
// RTP EXACTO con una sola perilla: el número sale de
//   X = rtp / U      con U ~ Uniforme(0, 1]
// entonces P(X >= objetivo) = rtp / objetivo, y el pago es `objetivo`.
// EV = objetivo * (rtp / objetivo) = rtp, para CUALQUIER objetivo.
// =========================================================

export const CFG_DEFAULT = {
  rtp: 0.97,
  // El número nunca pasa de acá (topea el premio máximo).
  tope: 1000,
  // Objetivo con el que arranca el jugador.
  objetivoDefecto: 2,
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
  const tope = clamp(Math.round(num(c.tope, D.tope)), 5, 1_000_000);
  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.8, 0.999),
    tope,
    objetivoDefecto: clamp(num(c.objetivoDefecto, D.objetivoDefecto), 1.01, tope),
    tema: str(c.tema, D.tema),
    fondoUrl: str(c.fondoUrl, null),
  };
}

/** RTP (0-1) — lo que muestra el editor y el chequeo de publicar. */
export function rtpDe(cfg) {
  return cfgConDefaults(cfg).rtp;
}

/**
 * Resuelve una jugada. `objetivo` lo elige el jugador (dentro de lo
 * permitido). Devuelve:
 *  - resultado: número que salió (el "punto")
 *  - objetivo: el objetivo efectivo usado
 *  - gano: boolean
 *  - mult: multiplicador ganado (0 = perdió)
 */
export function tirar(cfg, objetivo) {
  const c = cfgConDefaults(cfg);
  const obj_ = clamp(num(objetivo, c.objetivoDefecto), 1.01, c.tope);
  // U en (0, 1] — nunca 0, para no dividir por cero.
  const u = 1 - Math.random();
  const resultado = clamp(c.rtp / u, 1, c.tope);
  const gano = resultado >= obj_;
  return {
    resultado: Math.round(resultado * 100) / 100,
    objetivo: Math.round(obj_ * 100) / 100,
    gano,
    mult: gano ? obj_ : 0,
  };
}
