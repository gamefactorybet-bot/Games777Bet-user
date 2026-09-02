// =========================================================
// MOTOR TORRE — el jugador sube piso por piso eligiendo una casilla.
// Si pisa la trampa, pierde todo; si zafa, el multiplicador crece y
// puede retirar cuando quiera. Es "Mines en vertical".
//
// La misma matemática la usan el servidor (api/torre.js) y el
// frontend (src/Torre.tsx).
//
// RTP EXACTO por piso: en cada piso hay `c` casillas y `t` trampas,
// así que la chance de elegir una segura es p = (c - t) / c. El
// multiplicador del piso k es
//   mult(k) = RTP / p^k
// Después de subir k pisos, la probabilidad de haber llegado es p^k,
// y el retorno esperado si retira ahí es p^k · (RTP / p^k) = RTP —
// el mismo número en todos los pisos. Se puede ajustar a mano cada
// escalón (torre_cfg.pagos) sin romper nada más.
// =========================================================

export const DIFICULTADES = {
  facil: { cols: 4, trampas: 1 },
  media: { cols: 3, trampas: 1 },
  dificil: { cols: 2, trampas: 1 },
  experto: { cols: 3, trampas: 2 },
  maestro: { cols: 4, trampas: 3 },
};

export const CFG_DEFAULT = {
  rtp: 0.97,
  dificultad: 'media',   // clave de DIFICULTADES, o 'custom'
  cols: 3,               // solo si dificultad === 'custom'
  trampas: 1,
  pisos: 9,
  tema: 'clasico',
  fondoUrl: null,
  casillaTapadaUrl: null,
  casillaSeguraUrl: null,
  casillaTrampaUrl: null,
  casillaPasadaUrl: null,
  fondoTorreUrl: null,
  animSubirUrl: null,
  animTrampaUrl: null,
  animRetiroUrl: null,
  // Ajustes manuales de la escalera: { "<piso>": mult }
  pagos: {},
  // Posición de los controles (solo la usa el frontend; se pasa tal cual).
  controles: {},
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  const esCustom = c.dificultad === 'custom';
  const dif = esCustom || DIFICULTADES[c.dificultad] ? c.dificultad : D.dificultad;

  const cols = clamp(Math.round(num(c.cols, D.cols)), 2, 6);
  let trampas = clamp(Math.round(num(c.trampas, D.trampas)), 1, 5);
  if (esCustom && trampas >= cols) trampas = cols - 1;

  const pisos = clamp(Math.round(num(c.pisos, D.pisos)), 4, 14);

  // pagos: se sanea a { piso: mult>=0 } dentro de rango.
  const pagos = {};
  const src = obj(c.pagos);
  for (const kP of Object.keys(src)) {
    const p = Math.round(Number(kP));
    const m = num(src[kP], NaN);
    if (p >= 1 && p <= pisos && Number.isFinite(m) && m >= 0) pagos[p] = Math.round(m * 100) / 100;
  }

  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.8, 0.999),
    dificultad: dif,
    cols, trampas, pisos,
    tema: str(c.tema, D.tema),
    fondoUrl: str(c.fondoUrl, null),
    casillaTapadaUrl: str(c.casillaTapadaUrl, null),
    casillaSeguraUrl: str(c.casillaSeguraUrl, null),
    casillaTrampaUrl: str(c.casillaTrampaUrl, null),
    casillaPasadaUrl: str(c.casillaPasadaUrl, null),
    fondoTorreUrl: str(c.fondoTorreUrl, null),
    animSubirUrl: str(c.animSubirUrl, null),
    animTrampaUrl: str(c.animTrampaUrl, null),
    animRetiroUrl: str(c.animRetiroUrl, null),
    pagos,
    controles: obj(c.controles),
  };
}

/** Casillas y trampas por piso, según la dificultad. */
export function forma(cfg) {
  const c = cfgConDefaults(cfg);
  if (c.dificultad === 'custom') return { cols: c.cols, trampas: c.trampas };
  return DIFICULTADES[c.dificultad] || DIFICULTADES.media;
}

/** Chance (0-1) de elegir una casilla segura en un piso. */
export function chanceZafar(cfg) {
  const f = forma(cfg);
  return (f.cols - f.trampas) / f.cols;
}

function redondear(m) {
  if (m === 0) return 0;
  if (m < 10) return Math.round(m * 100) / 100;
  if (m < 100) return Math.round(m * 10) / 10;
  return Math.round(m);
}

/** Multiplicador generado (sin ajustes manuales) para el piso k. */
export function multBase(cfg, k) {
  if (k <= 0) return 1;
  const c = cfgConDefaults(cfg);
  return redondear(c.rtp / Math.pow(chanceZafar(c), k));
}

/** Multiplicador efectivo (generado + torre_cfg.pagos) para el piso k. */
export function multPiso(cfg, k) {
  if (k <= 0) return 1;
  const c = cfgConDefaults(cfg);
  return c.pagos[k] != null ? c.pagos[k] : multBase(c, k);
}

/** La escalera completa: [mult(1), mult(2), ... mult(pisos)]. */
export function tablaMultiplicadores(cfg) {
  const c = cfgConDefaults(cfg);
  const out = [];
  for (let k = 1; k <= c.pisos; k++) out.push(multPiso(c, k));
  return out;
}

/** RTP real (0-1) en el piso k: p^k · mult(k). */
export function rtpPiso(cfg, k) {
  const c = cfgConDefaults(cfg);
  return Math.pow(chanceZafar(c), k) * multPiso(c, k);
}

/**
 * RTP que muestra el editor y el chequeo de publicar: el promedio del
 * RTP real sobre todos los pisos. Sin ajustes manuales da exactamente
 * cfg.rtp. Devuelve fracción (0-1).
 */
export function rtpDe(cfg) {
  const c = cfgConDefaults(cfg);
  let s = 0;
  for (let k = 1; k <= c.pisos; k++) s += rtpPiso(c, k);
  return c.pisos > 0 ? s / c.pisos : c.rtp;
}

/**
 * Sortea las trampas de toda la torre. Devuelve un array de `pisos`
 * elementos; cada uno es la lista (ordenada) de índices de casilla que
 * son trampa en ese piso.
 */
export function sortearTrampas(cfg) {
  const c = cfgConDefaults(cfg);
  const f = forma(c);
  const torre = [];
  for (let i = 0; i < c.pisos; i++) {
    const idx = [];
    for (let j = 0; j < f.cols; j++) idx.push(j);
    for (let k = idx.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      const t = idx[k]; idx[k] = idx[r]; idx[r] = t;
    }
    torre.push(idx.slice(0, f.trampas).sort((a, b) => a - b));
  }
  return torre;
}
