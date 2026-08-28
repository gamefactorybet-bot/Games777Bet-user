// Calibración de RTP de un slot: escalar la tabla de pagos a un
// objetivo, y sugerir qué tocar cuando el RTP se sale de banda.
//
// Todo se resuelve con `analizar()` (cálculo exacto, no simulación).
// El RTP es lineal respecto de un factor global sobre todos los pagos,
// y monótono creciente respecto de cualquier `pago_*` de un símbolo —
// por eso alcanza con aritmética y una búsqueda binaria.

import { analizar } from '../motor.ts';
import type { PagosSimbolo, Simbolo } from '../types.ts';

const CAMPOS_PAGO = ['pago_dos', 'pago_tres', 'pago_cuatro', 'pago_cinco'] as const;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Con un campo de pago pisado por un valor nuevo. */
function conCampo(s: Simbolo, campo: keyof Simbolo, valor: number): Simbolo {
  return { ...s, [campo]: valor };
}

export function rtpDe(simbolos: Simbolo[], columnas: number): number {
  return simbolos.length ? analizar(simbolos, columnas).rtp : 0;
}

/** Todos los pagos × factor (redondeo a 2 decimales). El peso no se
 * toca. RTP escala lineal, así que factor = objetivo / rtpActual. */
export function escalarPagos(simbolos: Simbolo[], factor: number): Simbolo[] {
  return simbolos.map((s) => {
    const n: Simbolo = { ...s };
    for (const c of CAMPOS_PAGO) {
      const v = s[c] as number | null | undefined;
      if (v != null) (n as Record<string, unknown>)[c] = r2(Number(v) * factor);
    }
    return n;
  });
}

export function factorParaObjetivo(rtpActual: number, objetivo: number): number {
  return rtpActual > 0 ? objetivo / rtpActual : 1;
}

/** Foto de la tabla de pagos, para guardar como perfil. */
export function perfilDesdeSimbolos(simbolos: Simbolo[]): Record<string, PagosSimbolo> {
  const out: Record<string, PagosSimbolo> = {};
  for (const s of simbolos) {
    if (!s.id) continue;
    out[s.id] = {
      peso: s.peso,
      pago_dos: s.pago_dos,
      pago_tres: s.pago_tres,
      pago_cuatro: s.pago_cuatro ?? null,
      pago_cinco: s.pago_cinco ?? null,
    };
  }
  return out;
}

/** Restaura una foto de perfil sobre los símbolos actuales. Los
 * símbolos que el perfil no cubre quedan con su valor de borrador. */
export function aplicarPerfil(simbolos: Simbolo[], pagos: Record<string, PagosSimbolo>): Simbolo[] {
  return simbolos.map((s) => {
    const p = pagos[s.id];
    if (!p) return s;
    return {
      ...s,
      peso: p.peso,
      pago_dos: p.pago_dos,
      pago_tres: p.pago_tres,
      pago_cuatro: p.pago_cuatro ?? s.pago_cuatro,
      pago_cinco: p.pago_cinco ?? s.pago_cinco,
    };
  });
}

export interface Sugerencia {
  rtpActual: number;
  objetivo: number;
  /** Factor para "escalar todos los pagos". */
  factorGlobal: number;
  /** Alternativa: llevar el pago fuerte de UN símbolo a este valor. */
  porSimbolo: null | { nombre: string; campo: 'pago_tres' | 'pago_cinco'; de: number; a: number };
}

/**
 * Dado un RTP fuera del objetivo, devuelve dos formas de calibrar:
 *  (a) un factor global para todos los pagos, y
 *  (b) el símbolo que más aporta al RTP y el valor al que hay que
 *      llevar su pago fuerte (x3 en 3 rodillos, x5 en 5) para dar en
 *      el objetivo.
 */
export function sugerirCompensacion(simbolos: Simbolo[], columnas: number, objetivo: number): Sugerencia {
  const rtpActual = rtpDe(simbolos, columnas);
  const factorGlobal = Math.round(factorParaObjetivo(rtpActual, objetivo) * 1000) / 1000;
  const campo: 'pago_tres' | 'pago_cinco' = columnas >= 5 ? 'pago_cinco' : 'pago_tres';

  // Símbolo que más aporta por ese campo: se pone su pago en 0 y se
  // mide cuánto cae el RTP.
  let mejorI = -1;
  let mejorDrop = -Infinity;
  simbolos.forEach((s, i) => {
    if (Number(s[campo] ?? 0) <= 0) return;
    const drop = rtpActual - rtpDe(simbolos.map((x, j) => (j === i ? conCampo(x, campo, 0) : x)), columnas);
    if (drop > mejorDrop) { mejorDrop = drop; mejorI = i; }
  });

  let porSimbolo: Sugerencia['porSimbolo'] = null;
  if (mejorI >= 0 && Math.abs(rtpActual - objetivo) > 0.05) {
    const s = simbolos[mejorI];
    const de = Number(s[campo] ?? 0);
    let lo = rtpActual > objetivo ? 0 : de;
    let hi = rtpActual > objetivo ? de : de * 6 + 200;
    for (let k = 0; k < 34; k++) {
      const mid = (lo + hi) / 2;
      const rtp = rtpDe(simbolos.map((x, j) => (j === mejorI ? conCampo(x, campo, mid) : x)), columnas);
      if (rtp > objetivo) hi = mid; else lo = mid;
    }
    porSimbolo = { nombre: s.nombre, campo, de: r2(de), a: r2((lo + hi) / 2) };
  }

  return { rtpActual: r2(rtpActual), objetivo, factorGlobal, porSimbolo };
}
