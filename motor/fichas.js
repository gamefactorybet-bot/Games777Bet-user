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

export const FICHAS_DEFAULT = { fichas: [], sinCaja: false, modo: 'fila' };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d) => (typeof v === 'string' && v ? v : d);

/**
 * @param {{fichas?: unknown[], sinCaja?: boolean, modo?: string}} [cfg]
 * @returns {{sinCaja: boolean, modo: 'fila'|'abanico', fichas: Array<{valor:number, imagen_url:string|null, x:number, y:number, tam:number, imgTam:number}>}}
 */
export function fichasConDefaults(cfg) {
  const arr = Array.isArray(cfg && cfg.fichas) ? cfg.fichas : [];
  return {
    // Con fichas cargadas: oculta el recuadro "Apuesta: 5000" (cada
    // ficha ya muestra su valor). Sin efecto si no hay fichas.
    sinCaja: !!(cfg && cfg.sinCaja),
    // 'abanico': se ve solo la ficha activa y las demás se abren al
    // tocarla. La posición de la ficha 0 hace de ancla del abanico.
    modo: cfg && cfg.modo === 'abanico' ? 'abanico' : 'fila',
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
