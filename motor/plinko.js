// =========================================================
// MOTOR PLINKO — la bolita cae entre clavos a una cubeta.
//
// La misma matemática la usan el servidor (api/plinko-tirar) y el
// frontend (src/juego/plinko.ts). El resultado (a qué cubeta cae) lo
// decide SIEMPRE el servidor con volados justos; el cliente solo
// anima la bolita por el camino que le manda el servidor.
//
// RTP con una sola perilla: la tabla de multiplicadores de cada
// combinación (filas × riesgo) se genera y se escala para que
// Σ prob(k)·mult(k) ≈ cfg.rtp.
// =========================================================

export const CFG_DEFAULT = {
  // ---- jugabilidad ----
  rtp: 0.97,
  // Velocidad de caída de la bolita. 1 = normal; menos = más lento y
  // con más suspenso. Solo afecta la animación, no la matemática.
  velocidad: 0.7,
  filasPermitidas: [8, 12, 16],
  filasDefecto: 12,
  riesgoPermitido: ['bajo', 'medio', 'alto'],
  riesgoDefecto: 'medio',

  // ---- cosmético ----
  tema: 'clasico',
  // Proporción del tablero: alto = ancho × esto. >1 = más alto que
  // ancho (recomendado para que los clavos se abran y la caída dure).
  tablero: { proporcion: 1.45 },
  bola: { tipo: 'auto', lottie_url: null, imagen_url: null, emojiFallback: '⚪', tam: 22 },
  clavos: { color: null },
  fondoUrl: null,
  historial: { mostrar: true, cantidad: 12 },
  controles: {},
};

const FILAS_VALIDAS = [8, 10, 12, 14, 16];
const RIESGOS = ['bajo', 'medio', 'alto'];
// Cuánto se abre el abanico de multiplicadores según el riesgo.
const BASE_RIESGO = { bajo: 1.32, medio: 1.78, alto: 2.7 };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function listaFilas(v) {
  const arr = Array.isArray(v) ? v.map(Number).filter((n) => FILAS_VALIDAS.includes(n)) : [];
  return arr.length ? [...new Set(arr)].sort((a, b) => a - b) : CFG_DEFAULT.filasPermitidas.slice();
}
function listaRiesgos(v) {
  const arr = Array.isArray(v) ? v.filter((r) => RIESGOS.includes(r)) : [];
  return arr.length ? arr : CFG_DEFAULT.riesgoPermitido.slice();
}

export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  const b = obj(c.bola), cl = obj(c.clavos), hi = obj(c.historial);
  const filas = listaFilas(c.filasPermitidas);
  const riesgos = listaRiesgos(c.riesgoPermitido);
  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.8, 0.999),
    velocidad: clamp(num(c.velocidad, D.velocidad), 0.25, 2),
    filasPermitidas: filas,
    filasDefecto: filas.includes(Math.round(num(c.filasDefecto, D.filasDefecto)))
      ? Math.round(num(c.filasDefecto, D.filasDefecto)) : filas[Math.floor(filas.length / 2)],
    riesgoPermitido: riesgos,
    riesgoDefecto: riesgos.includes(str(c.riesgoDefecto, D.riesgoDefecto)) ? str(c.riesgoDefecto, D.riesgoDefecto) : riesgos[0],
    tema: str(c.tema, D.tema),
    tablero: { proporcion: clamp(num(obj(c.tablero).proporcion, D.tablero.proporcion), 0.8, 2.4) },
    bola: {
      tipo: ['auto', 'lottie', 'imagen', 'emoji'].includes(b.tipo) ? b.tipo : 'auto',
      lottie_url: str(b.lottie_url, null),
      imagen_url: str(b.imagen_url, null),
      emojiFallback: str(b.emojiFallback, D.bola.emojiFallback),
      tam: clamp(Math.round(num(b.tam, D.bola.tam)), 8, 60),
    },
    clavos: { color: str(cl.color, null) },
    fondoUrl: str(c.fondoUrl, null),
    historial: {
      mostrar: hi.mostrar !== false,
      cantidad: clamp(Math.round(num(hi.cantidad, D.historial.cantidad)), 0, 50),
    },
    controles: obj(c.controles),
  };
}

/** Probabilidad de cada cubeta k (0..n): binomial C(n,k)/2^n. */
export function probsCubetas(n) {
  const tot = Math.pow(2, n);
  const out = [];
  let c = 1;
  for (let k = 0; k <= n; k++) {
    out.push(c / tot);
    c = (c * (n - k)) / (k + 1);
  }
  return out;
}

function redondearMult(m) {
  if (m >= 100) return Math.round(m);
  if (m >= 10) return Math.round(m * 10) / 10;
  return Math.max(0.1, Math.round(m * 100) / 100);
}

/** Tabla de multiplicadores para (filas, riesgo), escalada al RTP. */
export function tablaMultiplicadores(filas, riesgo, rtp) {
  const n = clamp(Math.round(num(filas, 12)), 8, 16);
  const b = BASE_RIESGO[riesgo] || BASE_RIESGO.medio;
  const probs = probsCubetas(n);
  const crudo = [];
  for (let k = 0; k <= n; k++) crudo.push(Math.pow(b, Math.abs(k - n / 2)));
  const espera = crudo.reduce((a, r, k) => a + probs[k] * r, 0) || 1;
  const escala = clamp(num(rtp, 0.97), 0.8, 0.999) / espera;
  return crudo.map((r) => redondearMult(r * escala));
}

/** RTP real de esa combinación (con la tabla ya redondeada). */
export function rtpDe(cfg, filas, riesgo) {
  const c = cfgConDefaults(cfg);
  const n = filas || c.filasDefecto;
  const r = riesgo || c.riesgoDefecto;
  const t = tablaMultiplicadores(n, r, c.rtp);
  const p = probsCubetas(n);
  return t.reduce((a, m, k) => a + p[k] * m, 0);
}

/** RTP promedio sobre todas las combinaciones permitidas (informativo). */
export function rtpPromedio(cfg) {
  const c = cfgConDefaults(cfg);
  const combos = [];
  for (const f of c.filasPermitidas) for (const r of c.riesgoPermitido) combos.push(rtpDe(c, f, r));
  return combos.length ? combos.reduce((a, x) => a + x, 0) / combos.length : c.rtp;
}

/**
 * Resuelve una tirada. `filas` y `riesgo` los elige el jugador (dentro
 * de lo permitido). Volados justos: `k` = cantidad de "derechas".
 */
export function tirar(cfg, filas, riesgo) {
  const c = cfgConDefaults(cfg);
  const n = c.filasPermitidas.includes(Math.round(num(filas, 0))) ? Math.round(Number(filas)) : c.filasDefecto;
  const r = c.riesgoPermitido.includes(riesgo) ? riesgo : c.riesgoDefecto;
  const path = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const der = Math.random() < 0.5;
    path.push(der ? 1 : -1);
    if (der) k++;
  }
  const tabla = tablaMultiplicadores(n, r, c.rtp);
  return { filas: n, riesgo: r, k, path, mult: tabla[k], tabla };
}
