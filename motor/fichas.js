// =========================================================
// FICHAS DE APUESTA RÁPIDA — compartidas por todos los juegos.
//
// Si un juego tiene fichas cargadas, el jugador toca una para fijar la
// apuesta (en vez de los −/+). Cada ficha es independiente: su valor,
// una imagen redonda con su tamaño propio, el tamaño del botón y su
// posición en la pantalla.
//
// Config en `juegos.fichas_cfg` (jsonb): { fichas: [...] }. Vacío =
// el juego usa sus controles de siempre.
// =========================================================

export const FICHAS_DEFAULT = { fichas: [], sinCaja: false, modo: 'fila', abanicoApertura: 100, abanicoArco: 136 };

const ABANICO_ORDENES = new Set(['lista', 'valor', 'valor-inv']);
const ABANICO_SALIDAS = new Set(['izquierda', 'centro', 'derecha']);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);

/**
 * @param {{fichas?: unknown[], sinCaja?: boolean, modo?: string}} [cfg]
 * @returns {{sinCaja: boolean, modo: 'fila'|'abanico', abanicoApertura: number, abanicoArco: number, abanicoOrden?: 'lista'|'valor'|'valor-inv', abanicoSale?: 'izquierda'|'centro'|'derecha', fichas: Array<{valor:number, imagen_url:string|null, x:number, y:number, tam:number, imgTam:number}>}}
 */
export function fichasConDefaults(cfg) {
  const arr = Array.isArray(cfg && cfg.fichas) ? cfg.fichas : [];
  const orden = cfg && ABANICO_ORDENES.has(cfg.abanicoOrden) ? cfg.abanicoOrden : null;
  const sale = cfg && ABANICO_SALIDAS.has(cfg.abanicoSale) ? cfg.abanicoSale : null;
  return {
    // Con fichas cargadas: oculta el recuadro "Apuesta: 5000" (cada
    // ficha ya muestra su valor). Sin efecto si no hay fichas.
    sinCaja: !!(cfg && cfg.sinCaja),
    // 'abanico': se ve solo la ficha activa y las demás se abren al
    // tocarla. La posición de la ficha 0 hace de ancla del abanico.
    modo: cfg && (cfg.modo === 'abanico' || cfg.modo === 'columna') ? cfg.modo : 'fila',
    // 100 = radio automático. 50 = más apretado, 200 = más lejos.
    abanicoApertura: clamp(Math.round(num(cfg && cfg.abanicoApertura, 100)), 50, 220),
    // Arco en grados (hacia arriba). 136 = el abanico original.
    abanicoArco: clamp(Math.round(num(cfg && cfg.abanicoArco, 136)), 70, 180),
    // Solo si el juego ya eligió. Si faltan, el slot 3×3/5×3 pone
    // menor→mayor y salida desde el centro (fichasCfgSlot).
    ...(orden ? { abanicoOrden: orden } : {}),
    ...(sale ? { abanicoSale: sale } : {}),
    fichas: arr
      .map((f) => {
        const o = f && typeof f === 'object' ? f : {};
        return {
          valor: Math.max(1, Math.round(num(o.valor, 1000))),
          imagen_url: str(o.imagen_url, null),
          x: clamp(num(o.x, 50), 0, 100),
          y: clamp(num(o.y, 88), 0, 100),
          tam: clamp(Math.round(num(o.tam, 54)), 28, 140),
          imgTam: clamp(Math.round(num(o.imgTam, 88)), 30, 100),
        };
      })
      .slice(0, 12),
  };
}

/** Las fichas de un juego, ya validadas. */
export function fichasDe(juego) {
  return fichasConDefaults(juego && juego.fichas_cfg).fichas;
}

/** true si además hay que ocultar el recuadro de apuesta. */
export function fichasSinCajaDe(juego) {
  const c = fichasConDefaults(juego && juego.fichas_cfg);
  return c.fichas.length > 0 && c.sinCaja;
}

/**
 * 'fila' | 'abanico' — cómo se muestran las fichas de este juego.
 * @returns {'fila'|'abanico'}
 */
export function fichasModoDe(juego) {
  return fichasConDefaults(juego && juego.fichas_cfg).modo;
}

/**
 * Props de vista para <Fichas> / <FichasStrip>: modo, geometría, orden y salida.
 * @returns {{ modo: 'fila'|'abanico', abanicoApertura: number, abanicoArco: number, abanicoOrden: 'lista'|'valor'|'valor-inv', abanicoSale: 'izquierda'|'centro'|'derecha' }}
 */
export function fichasVistaDe(juego) {
  const c = fichasCfgSlot(juego && juego.fichas_cfg);
  return {
    modo: c.modo,
    abanicoApertura: c.abanicoApertura,
    abanicoArco: c.abanicoArco,
    abanicoOrden: c.abanicoOrden,
    abanicoSale: c.abanicoSale,
  };
}

/**
 * Config del abanico en todos los motores. Si el juego todavía no
 * eligió orden ni salida, arranca de menor a mayor y desde el centro.
 * @param {object} [cfg]
 */
export function fichasCfgSlot(cfg) {
  const base = fichasConDefaults(cfg);
  return {
    ...base,
    abanicoOrden: base.abanicoOrden || 'valor',
    abanicoSale: base.abanicoSale || 'centro',
  };
}

function ordenarAbanico(fichas, orden) {
  const conIdx = fichas.map((f, i) => ({ f, i }));
  if (orden === 'valor') conIdx.sort((a, b) => a.f.valor - b.f.valor || a.i - b.i);
  else if (orden === 'valor-inv') conIdx.sort((a, b) => b.f.valor - a.f.valor || a.i - b.i);
  return conIdx.map((x) => x.f);
}

/**
 * Lugares del arco, activa incluida en la cuenta para que su sitio
 * quede vacío y el resto no se corra. `indice` va de izquierda a derecha.
 * @param {Array<{valor:number}>} fichas
 * @param {number} apuesta
 * @param {'lista'|'valor'|'valor-inv'} orden
 * @returns {Array<{ficha: {valor:number}, indice: number, total: number}>}
 */
export function puestosAbanico(fichas, apuesta, orden) {
  const lista = Array.isArray(fichas) ? fichas : [];
  if (!lista.length) return [];
  const activa = lista.find((f) => Math.round(f.valor) === Math.round(apuesta)) ?? lista[0];
  const ordenadas = ordenarAbanico(lista, orden);
  const total = ordenadas.length;
  const puestos = [];
  for (let indice = 0; indice < total; indice++) {
    const ficha = ordenadas[indice];
    if (ficha === activa) continue;
    puestos.push({ ficha, indice, total });
  }
  return puestos;
}

/**
 * Milisegundos de demora al abrirse. Centro usa el arco completo
 * (la activa puede ocupar el medio). Izquierda y derecha cuentan
 * solo las fichas que se ven, para que la primera salga al toque.
 * @param {number} indice
 * @param {number[]} visibles
 * @param {number} total
 * @param {'izquierda'|'centro'|'derecha'} sale
 */
export function demoraAbanico(indice, visibles, total, sale) {
  if (sale === 'centro') return Math.round(Math.abs(indice - (Math.max(1, total) - 1) / 2) * 26);
  const orden = [...visibles].sort((a, b) => a - b);
  const puesto = Math.max(0, orden.indexOf(indice));
  return (sale === 'derecha' ? orden.length - 1 - puesto : puesto) * 26;
}

/**
 * Reescribe solo el array de fichas, conservando modo / apertura / arco / sinCaja.
 * Lo usan las vistas previas al arrastrar una ficha, para no pisar el resto.
 */
export function parcheFichas(juego, fichas) {
  return { ...fichasConDefaults(juego && juego.fichas_cfg), fichas };
}

/**
 * Convierte montos simples (`juegos.fichas` = [1000, 2000, …]) en fichas
 * ricas, todas apiladas en (x, y). Lo usa el slot 3×3/5×3 al pasar a
 * abanico: esa tira HTML no sabe desplegarse, el overlay React sí.
 */
export function fichasDesdeMontos(montos, x, y) {
  const gx = clamp(num(x, 50), 0, 100);
  const gy = clamp(num(y, 88), 0, 100);
  return (Array.isArray(montos) ? montos : [])
    .map((v) => ({
      valor: Math.max(1, Math.round(num(v, 1000))),
      imagen_url: null,
      x: gx,
      y: gy,
      tam: 54,
      imgTam: 88,
    }))
    .slice(0, 12);
}
