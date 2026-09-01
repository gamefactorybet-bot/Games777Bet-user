// =========================================================
// MOTOR RASPADITA — una tarjeta con celdas tapadas que el jugador
// raspa. El resultado (qué premio salió y cómo queda la grilla) lo
// decide SIEMPRE el servidor; el navegador solo anima el raspado.
//
// La misma matemática la usan el servidor (api/raspadita-jugar) y el
// frontend (src/juego/raspadita.ts).
//
// RTP EXACTO: cada escalón de premio de cada símbolo lleva su
// multiplicador `m` y su frecuencia `cada` (1 de cada N tarjetas).
//   RTP = Σ (m / cada)
// No depende del azar de cómo se llena la grilla: primero se sortea
// el premio con esas probabilidades y después se arma la tarjeta que
// lo justifica (mismo criterio que Plinko).
// =========================================================

export const CFG_DEFAULT = {
  // 6 | 9 | 12 celdas. Siempre en 3 columnas.
  celdas: 9,
  simbolos: [
    { nombre: 'Cereza',   emoji: '🍒', icono_url: null, lottie_url: null, wild: false, tiers: [{ c: 3, m: 2,   cada: 6 }] },
    { nombre: 'Campana',  emoji: '🔔', icono_url: null, lottie_url: null, wild: false, tiers: [{ c: 3, m: 5,   cada: 25 }] },
    { nombre: 'Diamante', emoji: '💎', icono_url: null, lottie_url: null, wild: false, tiers: [{ c: 3, m: 15,  cada: 95 }] },
    { nombre: 'Siete',    emoji: '7️⃣', icono_url: null, lottie_url: null, wild: false, tiers: [{ c: 3, m: 60,  cada: 420 }] },
    { nombre: 'Corona',   emoji: '👑', icono_url: null, lottie_url: null, wild: false, tiers: [{ c: 3, m: 400, cada: 5000 }] },
    { nombre: 'Limón',    emoji: '🍋', icono_url: null, lottie_url: null, wild: false, tiers: [] },
  ],

  // ---- cosmético ----
  tema: 'clasico',
  fondoUrl: null,
  // La capa que se raspa.
  cobertura: { color: '#6b7280', imagen_url: null },
  // Marco / fondo de cada celda (opcional).
  celda: { imagen_url: null },
  // Lottie que se reproduce sobre cada celda ganadora al revelar.
  animGanar_url: null,
  historial: { mostrar: true, cantidad: 12 },
  controles: {},
};

const CELDAS_VALIDAS = [6, 9, 12];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function tiersConDefaults(v, celdas) {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) => {
      const o = obj(t);
      return {
        c: clamp(Math.round(num(o.c, 3)), 1, celdas),
        m: Math.max(0, num(o.m, 0)),
        cada: Math.max(1, Math.round(num(o.cada, 100))),
      };
    })
    .filter((t) => t.m > 0)
    .sort((a, b) => a.c - b.c);
}

function simbolosConDefaults(v, celdas) {
  const arr = Array.isArray(v) ? v : CFG_DEFAULT.simbolos;
  const out = arr.map((s) => {
    const o = obj(s);
    return {
      nombre: str(o.nombre, 'Símbolo'),
      emoji: str(o.emoji, '⭐'),
      icono_url: str(o.icono_url, null),
      lottie_url: str(o.lottie_url, null),
      wild: !!o.wild,
      tiers: o.wild ? [] : tiersConDefaults(o.tiers, celdas),
    };
  });
  // Siempre tiene que haber al menos 2 símbolos y alguno que pueda
  // servir de relleno (sin premio propio).
  if (out.length < 2) return simbolosConDefaults(CFG_DEFAULT.simbolos, celdas);
  return out;
}

export function cfgConDefaults(cfg) {
  const c = obj(cfg);
  const D = CFG_DEFAULT;
  const celdas = CELDAS_VALIDAS.includes(Math.round(num(c.celdas, D.celdas)))
    ? Math.round(num(c.celdas, D.celdas)) : D.celdas;
  const cob = obj(c.cobertura), cel = obj(c.celda), hi = obj(c.historial);
  return {
    celdas,
    simbolos: simbolosConDefaults(c.simbolos, celdas),
    tema: str(c.tema, D.tema),
    fondoUrl: str(c.fondoUrl, null),
    cobertura: { color: str(cob.color, D.cobertura.color), imagen_url: str(cob.imagen_url, null) },
    celda: { imagen_url: str(cel.imagen_url, null) },
    animGanar_url: str(c.animGanar_url, null),
    historial: {
      mostrar: hi.mostrar !== false,
      cantidad: clamp(Math.round(num(hi.cantidad, D.historial.cantidad)), 0, 50),
    },
    controles: obj(c.controles),
  };
}

/** { rtp (0-1), unoCada (prob de ganar algo → 1 cada N), premioMax (mult) }. */
export function metricasRTP(cfg) {
  const c = cfgConDefaults(cfg);
  let rtp = 0, pAlgo = 0, premioMax = 0;
  for (const s of c.simbolos) {
    if (s.wild) continue;
    for (const t of s.tiers) {
      rtp += t.m / t.cada;
      pAlgo += 1 / t.cada;
      if (t.m > premioMax) premioMax = t.m;
    }
  }
  return { rtp, unoCada: pAlgo > 0 ? Math.round(1 / pAlgo) : 0, premioMax };
}

/** RTP en porcentaje — lo que muestra el editor y el chequeo de publicar. */
export function rtpPromedio(cfg) {
  return metricasRTP(cfg).rtp;
}

function baraja(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sortea el premio y arma la tarjeta.
 * Devuelve:
 *  - grilla: number[]  índices de símbolo por celda (fila por fila, 3 columnas)
 *  - ganadoras: number[]  celdas que forman el premio (para resaltar)
 *  - mult: number  multiplicador ganado (0 = sin premio)
 *  - simboloGanador: number | null
 *  - cantidad: number
 */
export function jugar(cfg) {
  const c = cfgConDefaults(cfg);
  const N = c.celdas;

  // 1) elegir el resultado por frecuencia
  const opciones = [];
  c.simbolos.forEach((s, si) => {
    if (s.wild) return;
    s.tiers.forEach((t) => opciones.push({ si, c: Math.min(t.c, N), m: t.m, p: 1 / t.cada }));
  });
  const r = Math.random();
  let acc = 0;
  let res = null;
  for (const o of opciones) { acc += o.p; if (r < acc) { res = o; break; } }

  // 2) armar la grilla
  const grilla = new Array(N).fill(-1);
  const orden = baraja(N);
  const ganadoras = [];
  const wildIdx = c.simbolos.findIndex((s) => s.wild);

  if (res) {
    const usarWild = wildIdx > -1 && res.c >= 3 && Math.random() < 0.45 ? 1 : 0;
    for (let k = 0; k < res.c; k++) {
      const celda = orden[k];
      grilla[celda] = k < usarWild ? wildIdx : res.si;
      ganadoras.push(celda);
    }
  }

  // 3) relleno: nunca llegar a la cantidad que dispara un premio de otro símbolo
  const tope = c.simbolos.map((s) => {
    let mn = Infinity;
    for (const t of s.tiers) mn = Math.min(mn, t.c);
    return Number.isFinite(mn) ? mn - 1 : 999;
  });
  const cuenta = {};
  grilla.forEach((v) => { if (v >= 0) cuenta[v] = (cuenta[v] || 0) + 1; });
  const ganIdx = res ? res.si : -1;
  const fillerNeutro = c.simbolos.findIndex((s) => !s.wild && s.tiers.length === 0);

  for (const celda of orden) {
    if (grilla[celda] >= 0) continue;
    const cand = c.simbolos
      .map((_, i) => i)
      .filter((i) => i !== ganIdx && !c.simbolos[i].wild && (cuenta[i] || 0) < tope[i]);
    let pick = cand.length ? cand[Math.floor(Math.random() * cand.length)] : fillerNeutro;
    if (pick < 0) pick = 0;
    grilla[celda] = pick;
    cuenta[pick] = (cuenta[pick] || 0) + 1;
  }

  return {
    grilla,
    ganadoras,
    mult: res ? res.m : 0,
    simboloGanador: res ? res.si : null,
    cantidad: res ? res.c : 0,
  };
}
