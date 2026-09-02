// =========================================================
// MOTOR KENO — el jugador marca unos números en un tablero, la banca
// saca las bolas y cobra según cuántas acierta.
//
// La misma matemática la usan el servidor (api/jugar-instant) y el
// frontend (src/Keno.tsx).
//
// RTP EXACTO: para cada cantidad de números marcados P, la
// probabilidad de acertar exactamente h es hipergeométrica
//   P(h) = C(P,h) · C(T-P, D-h) / C(T,D)
// con T = tablero y D = bolas que saca la banca. El RTP de una tabla
// es Σ P(h) · multiplicador(h). El motor arma los multiplicadores
// para clavar el RTP objetivo y después se pueden ajustar a mano
// (cfg.pagos). No hay estimación ni simulación.
// =========================================================

export const CFG_DEFAULT = {
  rtp: 0.95,
  tablero: 40,        // 25 | 40 | 80
  bolas: 10,          // cuántas saca la banca
  maxMarcar: 10,      // tope de números que puede marcar el jugador
  riesgo: 'medio',    // 'bajo' | 'medio' | 'alto'
  tema: 'clasico',
  fondoUrl: null,
  // Ajustes manuales de la tabla: { "<marcados>": { "<aciertos>": mult } }.
  // Lo que no está acá lo genera el motor.
  pagos: {},
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

const TABLEROS = [25, 40, 80];
const RIESGOS = ['bajo', 'medio', 'alto'];

export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  const tablero = TABLEROS.includes(Number(c.tablero)) ? Number(c.tablero) : D.tablero;
  const topeBolas = Math.floor(tablero / 2);
  const bolas = clamp(Math.round(num(c.bolas, D.bolas)), 1, topeBolas);
  const maxMarcar = clamp(Math.round(num(c.maxMarcar, D.maxMarcar)), 1, Math.min(15, topeBolas));
  const riesgo = RIESGOS.includes(c.riesgo) ? c.riesgo : D.riesgo;

  // pagos: se sanea a { P: { h: mult>=0 } } con P y h dentro de rango.
  const pagos = {};
  const src = obj(c.pagos);
  for (const kP of Object.keys(src)) {
    const P = Math.round(Number(kP));
    if (!(P >= 1 && P <= maxMarcar)) continue;
    const fila = obj(src[kP]);
    const limpio = {};
    for (const kh of Object.keys(fila)) {
      const h = Math.round(Number(kh));
      const m = num(fila[kh], NaN);
      if (h >= 0 && h <= P && Number.isFinite(m) && m >= 0) limpio[h] = Math.round(m * 100) / 100;
    }
    if (Object.keys(limpio).length) pagos[P] = limpio;
  }

  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.8, 0.999),
    tablero,
    bolas,
    maxMarcar,
    riesgo,
    tema: str(c.tema, D.tema),
    fondoUrl: str(c.fondoUrl, null),
    pagos,
  };
}

// ---------------- Combinatoria / hipergeométrica ----------------

const _lf = [0, 0];
function logFact(n) {
  if (_lf[n] != null) return _lf[n];
  let s = _lf[_lf.length - 1];
  for (let i = _lf.length; i <= n; i++) { s += Math.log(i); _lf[i] = s; }
  return _lf[n];
}
function logC(n, k) {
  if (k < 0 || k > n || n < 0) return -Infinity;
  return logFact(n) - logFact(k) - logFact(n - k);
}

/** Probabilidad de acertar exactamente `h` con tablero T, saca D, marca P. */
export function probAciertos(T, D, P, h) {
  const v = logC(P, h) + logC(T - P, D - h) - logC(T, D);
  return v === -Infinity ? 0 : Math.exp(v);
}

// ---------------- Tabla de pagos ----------------

const RIESGO_PARAMS = {
  bajo: { startFrac: 0.45, growth: 1.55, tope: 250 },
  medio: { startFrac: 0.55, growth: 2.0, tope: 1200 },
  alto: { startFrac: 0.64, growth: 2.7, tope: 6000 },
};

function redondear(m) {
  if (m === 0) return 0;
  if (m < 2) return Math.round(m * 100) / 100;
  if (m < 20) return Math.round(m * 10) / 10;
  return Math.round(m);
}

/** Tabla generada (sin ajustes manuales) para P números marcados. */
export function tablaBase(cfg, P) {
  const c = cfgConDefaults(cfg);
  const { startFrac, growth, tope } = RIESGO_PARAMS[c.riesgo];
  let start = Math.max(1, Math.round(P * startFrac));
  if (P <= 2) start = P;
  const w = [];
  for (let h = 0; h <= P; h++) w[h] = h < start ? 0 : Math.pow(growth, h - start);
  let raw = 0;
  for (let h = 0; h <= P; h++) raw += probAciertos(c.tablero, c.bolas, P, h) * w[h];
  const k = raw > 0 ? c.rtp / raw : 0;
  return w.map((x) => redondear(Math.min(tope, x * k)));
}

/** Tabla efectiva: la generada con los ajustes manuales de cfg.pagos. */
export function tablaDe(cfg, P) {
  const c = cfgConDefaults(cfg);
  const base = tablaBase(c, P);
  const over = c.pagos[P] || {};
  return base.map((v, h) => (over[h] != null ? over[h] : v));
}

/** RTP real (0-1) de la tabla efectiva para P marcados. */
export function rtpTabla(cfg, P) {
  const c = cfgConDefaults(cfg);
  const t = tablaDe(c, P);
  let s = 0;
  for (let h = 0; h <= P; h++) s += probAciertos(c.tablero, c.bolas, P, h) * t[h];
  return s;
}

/**
 * RTP que muestra el editor y el chequeo de publicar: el promedio del
 * RTP real sobre todas las cantidades de marcados posibles. Devuelve
 * fracción (0-1).
 */
export function rtpDe(cfg) {
  const c = cfgConDefaults(cfg);
  let s = 0;
  for (let P = 1; P <= c.maxMarcar; P++) s += rtpTabla(c, P);
  return c.maxMarcar > 0 ? s / c.maxMarcar : c.rtp;
}

// ---------------- Resolución de una jugada ----------------

function sacarBolas(T, D) {
  const pool = [];
  for (let i = 1; i <= T; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, D).sort((a, b) => a - b);
}

/**
 * Resuelve una jugada. `marcados` son los números que eligió el
 * jugador. Devuelve:
 *  - sorteados: los D números que salieron (ordenados)
 *  - marcados: los válidos del jugador (ordenados)
 *  - aciertos: cuántos marcados salieron
 *  - gano, mult
 */
export function tirar(cfg, marcados) {
  const c = cfgConDefaults(cfg);
  const limpio = Array.from(new Set(
    (Array.isArray(marcados) ? marcados : [])
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= c.tablero),
  )).sort((a, b) => a - b);

  if (limpio.length < 1) throw new Error('Marcá al menos un número.');
  if (limpio.length > c.maxMarcar) throw new Error(`Podés marcar hasta ${c.maxMarcar} números.`);

  const sorteados = sacarBolas(c.tablero, c.bolas);
  const set = new Set(sorteados);
  const aciertos = limpio.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0);
  const mult = tablaDe(c, limpio.length)[aciertos] || 0;

  return {
    sorteados,
    marcados: limpio,
    aciertos,
    gano: mult > 0,
    mult: Math.round(mult * 100) / 100,
  };
}
