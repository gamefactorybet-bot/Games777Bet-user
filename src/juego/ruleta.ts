// Helpers de la Ruleta de multiplicadores para el frontend. El
// reparto de las tajadas sale de `motor/ruleta.js` — la misma función
// que usa el servidor, así la rueda que se dibuja es idéntica a la que
// se resuelve.

import { construirRueda as _construirRueda } from '../../motor/ruleta-reparto.js';
import type { RuletaSlot, Simbolo } from '../types.ts';

// Paleta por defecto cuando un multiplicador no tiene color propio.
export const PALETA_RULETA = [
  '#3a3f4a', '#6b8afd', '#5bbf88', '#3fb6c4',
  '#d9a441', '#c77dff', '#e5686b', '#9b7ff0',
];

export const colorDe = (s: Simbolo, i: number): string =>
  (s.color as string) || PALETA_RULETA[i % PALETA_RULETA.length];

export const multDe = (s: Simbolo): number => Number(s.pago_tres) || 0;
export const tajadasDe = (s: Simbolo): number => Math.max(0, Math.round(Number(s.peso) || 0));
export const etiquetaDe = (s: Simbolo): string => s.nombre || ('×' + multDe(s));

/** Las tajadas de la rueda ya repartidas, listas para dibujar. */
export function slotsDe(simbolos: Simbolo[]): RuletaSlot[] {
  const conColor = simbolos.map((s, i) => ({ ...s, color: colorDe(s, i) }));
  return (_construirRueda(conColor) as Simbolo[]).map((s) => ({
    et: etiquetaDe(s),
    mult: multDe(s),
    color: (s.color as string) || null,
  }));
}

/** Total de tajadas de la rueda. */
export const totalTajadas = (simbolos: Simbolo[]): number =>
  simbolos.reduce((a, s) => a + tajadasDe(s), 0);
