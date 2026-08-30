// =========================================================
// MOTOR CRASH — un multiplicador que sube y puede reventar.
//
// La misma matemática la usan el servidor (api/crash-*) y el
// frontend (src/juego/crash.ts) para que el número que ve el jugador
// sea EXACTAMENTE el que valida el servidor. El punto de reventón
// nunca sale al cliente mientras la ronda está en curso.
//
// Todo lo cosmético (formato, tema, imágenes, colores, controles) vive
// en el jsonb `juegos.crash_cfg` y el servidor lo ignora — solo le
// importan rtp, velocidad y tope.
// =========================================================

export const CFG_DEFAULT = {
  // ---- jugabilidad (afecta la plata) ----
  rtp: 0.95,          // 0.5–0.999. Única perilla de retorno. 1-rtp = prob. de reventón instantáneo.
  velocidad: 1.0,     // qué tan rápido sube (×2 a los ~5s con 1.0)
  tope: 100,          // multiplicador máximo; llegar ahí termina la ronda
  auto: { permitir: true, valorDefecto: 2.0, min: 1.01, max: 100 },

  // ---- cosmético ----
  formato: 'curva',   // curva | cohete | numero | medidor | odometro
  tema: 'clasico',
  objeto: {
    tipo: 'auto',          // auto | lottie | imagen | emoji — qué mostrar
    lottie_url: null,       // animación Lottie (.json / .lottie)
    imagen_url: null,       // imagen fija
    emojiFallback: '🚀',    // emoji
    tam: 64,
    estela: true,
    seguir: true,           // rota para seguir la curva / la subida
    apunta: 'arriba',       // orientación natural del arte: 'arriba' | 'derecha'
    giro: 0,                // ajuste fino de rotación, en grados
  },
  curva: { color: '#e8b13d', grosor: 3, relleno: true, glow: true, cuadricula: true },
  numero: { fuente: 'display', color: null, tam: 1.0, efecto: 'pulso' },
  fondoUrl: null,
  historial: { mostrar: true, cantidad: 12 },
  controles: {},
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const trunc2 = (x) => Math.floor(x * 100) / 100;
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Une lo guardado con los defaults — lo que falte cae en el default. */
export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  const au = obj(c.auto), o = obj(c.objeto), cu = obj(c.curva), nu = obj(c.numero), hi = obj(c.historial);
  return {
    rtp: clamp(num(c.rtp, D.rtp), 0.5, 0.999),
    velocidad: clamp(num(c.velocidad, D.velocidad), 0.2, 5),
    tope: clamp(Math.round(num(c.tope, D.tope)), 2, 100000),
    auto: {
      permitir: au.permitir !== false,
      valorDefecto: clamp(num(au.valorDefecto, D.auto.valorDefecto), 1.01, 100000),
      min: clamp(num(au.min, D.auto.min), 1.01, 100000),
      max: clamp(num(au.max, D.auto.max), 1.01, 100000),
    },
    formato: str(c.formato, D.formato),
    tema: str(c.tema, D.tema),
    objeto: {
      tipo: ['auto', 'lottie', 'imagen', 'emoji'].includes(o.tipo) ? o.tipo : 'auto',
      lottie_url: str(o.lottie_url, null),
      imagen_url: str(o.imagen_url, null),
      emojiFallback: str(o.emojiFallback, D.objeto.emojiFallback),
      tam: clamp(Math.round(num(o.tam, D.objeto.tam)), 16, 240),
      estela: o.estela !== false,
      seguir: o.seguir !== false,
      apunta: o.apunta === 'derecha' ? 'derecha' : 'arriba',
      giro: clamp(num(o.giro, 0), -180, 180),
    },
    curva: {
      color: str(cu.color, D.curva.color),
      grosor: clamp(Math.round(num(cu.grosor, D.curva.grosor)), 1, 12),
      relleno: cu.relleno !== false,
      glow: cu.glow !== false,
      cuadricula: cu.cuadricula !== false,
    },
    numero: {
      fuente: str(nu.fuente, D.numero.fuente),
      color: str(nu.color, null),
      tam: clamp(num(nu.tam, D.numero.tam), 0.4, 3),
      efecto: str(nu.efecto, D.numero.efecto),
    },
    fondoUrl: str(c.fondoUrl, null),
    historial: {
      mostrar: hi.mostrar !== false,
      cantidad: clamp(Math.round(num(hi.cantidad, D.historial.cantidad)), 0, 50),
    },
    controles: obj(c.controles),
  };
}

// Constante de crecimiento: mult = exp(k·t_ms). Con velocidad 1 llega
// a ×2 en ~5000 ms.
const K_BASE = Math.LN2 / 5000;
export const kDe = (cfg) => K_BASE * cfgConDefaults(cfg).velocidad;

/** Multiplicador mostrado a los `tMs` del arranque (>= 1, <= tope). */
export function crecimiento(tMs, cfg) {
  const c = cfgConDefaults(cfg);
  const m = Math.exp(K_BASE * c.velocidad * Math.max(0, num(tMs, 0)));
  return Math.min(c.tope, Math.max(1, trunc2(m)));
}

/** ms desde el arranque hasta alcanzar `mult` (inverso de crecimiento). */
export function tiempoHasta(mult, cfg) {
  const c = cfgConDefaults(cfg);
  const m = clamp(num(mult, 1), 1, c.tope);
  return Math.log(m) / (K_BASE * c.velocidad);
}

/**
 * Punto de reventón a partir de `r` uniforme en [0,1). Da RTP EXACTO =
 * cfg.rtp para cualquier objetivo de retiro: P(crash >= T) = rtp/T.
 */
export function puntoReventon(r, cfg) {
  const c = cfgConDefaults(cfg);
  const u = clamp(num(r, 0), 0, 0.999999999);
  if (u < 1 - c.rtp) return 1.0;               // reventón instantáneo
  return clamp(trunc2(c.rtp / (1 - u)), 1.0, c.tope);
}

/** Punto de reventón con el RNG del servidor. */
export function sortearReventon(cfg) {
  return puntoReventon(Math.random(), cfg);
}

/**
 * Resuelve un retiro. `inicioTs` / `ahoraTs` en ms epoch.
 * - retiro manual: paga al multiplicador del instante del pedido.
 * - auto-retiro (`objetivoAuto` > 1): si ya se alcanzó el objetivo, se
 *   paga a ese valor exacto (protege al jugador del lag de su cliente).
 * Gana solo si el multiplicador quedó por DEBAJO del punto de reventón.
 */
export function resolverRetiro({ inicioTs, ahoraTs, puntoCrash, apuesta, cfg, objetivoAuto }) {
  const c = cfgConDefaults(cfg);
  const crash = num(puntoCrash, 1);
  const monto = Math.max(0, num(apuesta, 0));
  const elapsed = Math.max(0, num(ahoraTs, 0) - num(inicioTs, 0));
  const actual = crecimiento(elapsed, c);

  const objAuto = num(objetivoAuto, 0);
  let mult = actual;
  if (objAuto > 1 && actual >= trunc2(objAuto)) mult = trunc2(objAuto);

  const gano = mult > 1 && mult < crash;
  const premio = gano ? Number((monto * mult).toFixed(2)) : 0;
  return { multiplicador: mult, gano, premio, reventadoEn: crash };
}

/** RTP teórico (informativo para el editor). */
export function rtpTeorico(cfg) {
  return cfgConDefaults(cfg).rtp;
}
