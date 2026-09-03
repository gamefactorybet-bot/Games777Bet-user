// =========================================================
// MOTOR 7 UP 7 DOWN — se tiran dos dados y la suma cae en una de tres
// zonas: 7 ABAJO (2–6), LUCKY 7 (=7) o 7 ARRIBA (8–12). El jugador
// apuesta a una zona; una tirada y se resuelve.
//
// La misma matemática la usan el servidor (api/jugar-instant) y el
// frontend (src/SieteUd.tsx).
//
// RTP EXACTO con una sola perilla, como Dice:
//   pago(zona) = rtp / P(zona)
// EV = P(zona) · (rtp / P(zona)) = rtp, para CUALQUIER zona. La casa
// se queda con 1 − rtp elijas la zona que elijas. Los pagos se pueden
// tocar a mano (cfg.pagos) y el motor te muestra el RTP real que queda.
//
// Con dos dados de N caras hay N² combinaciones; la suma va de 2 a 2N
// en campana. Base 6 caras: P(2–6)=15/36, P(7)=6/36, P(8–12)=15/36.
// =========================================================

export const CFG_DEFAULT = {
  rtp: 0.97,
  caras: 6,               // caras por dado (2..12 son razonables; base 6)
  // Pagos fijados a mano por el operador. null / ausente = exacto por RTP.
  pagos: { abajo: null, siete: null, arriba: null },
  tema: 'clasico',
  fondoUrl: null,         // imagen de fondo del área de juego
  cartelUrl: null,        // imagen del cartel que sale al ganar
};

const ZONAS = ['abajo', 'siete', 'arriba'];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Reparto de la suma de dos dados de `caras` lados: { suma: combinaciones }. */
export function reparto(caras) {
  const N = clamp(Math.round(num(caras, 6)), 2, 12);
  const out = {};
  for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) out[a + b] = (out[a + b] || 0) + 1;
  return { N, total: N * N, conteo: out };
}

/** Probabilidad (0-1) de cada zona para dados de `caras` lados. */
export function probsZonas(caras) {
  const { N, total, conteo } = reparto(caras);
  let abajo = 0, siete = 0, arriba = 0;
  for (const k of Object.keys(conteo)) {
    const s = Number(k), c = conteo[k];
    if (s < 7) abajo += c;
    else if (s === 7) siete += c;
    else arriba += c;
  }
  // Con menos de 6 caras puede no haber ningún 7 (p. ej. 2 caras: sumas 2-4).
  return { abajo: abajo / total, siete: siete / total, arriba: arriba / total, N, total };
}

export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  const caras = clamp(Math.round(num(c.caras, D.caras)), 2, 12);

  const srcP = obj(c.pagos);
  const pagos = { abajo: null, siete: null, arriba: null };
  for (const z of ZONAS) {
    const v = num(srcP[z], NaN);
    if (Number.isFinite(v) && v > 1) pagos[z] = Math.round(v * 100) / 100;
  }

  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.8, 0.999),
    caras,
    pagos,
    tema: str(c.tema, D.tema),
    fondoUrl: str(c.fondoUrl, null),
    cartelUrl: str(c.cartelUrl, null),
    // Posición de los controles / cartel (solo la usa el frontend; se pasa tal cual).
    controles: obj(c.controles),
  };
}

/** Pago exacto (sin redondear) de una zona: el fijado a mano o rtp/P. */
export function pagoRaw(cfg, zona) {
  const c = cfgConDefaults(cfg);
  const p = probsZonas(c.caras)[zona];
  if (c.pagos[zona] != null) return c.pagos[zona];
  return p > 0 ? c.rtp / p : 0;
}

/** Pago que se muestra / se cobra, redondeado a 2 decimales. */
export function pagoDe(cfg, zona) {
  return Math.round(pagoRaw(cfg, zona) * 100) / 100;
}

/** RTP real (0-1) de una zona = P(zona) · pago(zona) sin redondear. */
export function rtpZona(cfg, zona) {
  const c = cfgConDefaults(cfg);
  return probsZonas(c.caras)[zona] * pagoRaw(c, zona);
}

/**
 * RTP que muestra el editor y el chequeo de publicar: promedio del RTP
 * real de las tres zonas (si están todas por RTP, las tres dan igual).
 * Fracción 0-1.
 */
export function rtpDe(cfg) {
  const zonasConChance = ZONAS.filter((z) => probsZonas(cfgConDefaults(cfg).caras)[z] > 0);
  if (!zonasConChance.length) return cfgConDefaults(cfg).rtp;
  const s = zonasConChance.reduce((acc, z) => acc + rtpZona(cfg, z), 0);
  return s / zonasConChance.length;
}

/** Zona a la que pertenece una suma. */
export function zonaDeSuma(s) {
  return s < 7 ? 'abajo' : s === 7 ? 'siete' : 'arriba';
}

/**
 * Resuelve una jugada. `zona` la elige el jugador ('abajo' | 'siete' |
 * 'arriba'); si viene otra cosa cae en 'siete'. Devuelve:
 *  - dados: [d1, d2]
 *  - suma
 *  - zona: la apostada (efectiva)
 *  - zonaGanadora: la que salió
 *  - gano, mult
 */
export function tirar(cfg, zona) {
  const c = cfgConDefaults(cfg);
  const z = ZONAS.includes(zona) ? zona : 'siete';
  const d1 = 1 + Math.floor(Math.random() * c.caras);
  const d2 = 1 + Math.floor(Math.random() * c.caras);
  const suma = d1 + d2;
  const zg = zonaDeSuma(suma);
  const gano = zg === z;
  const mult = gano ? pagoDe(c, z) : 0;
  return {
    dados: [d1, d2],
    suma,
    zona: z,
    zonaGanadora: zg,
    gano,
    mult: Math.round(mult * 100) / 100,
  };
}
