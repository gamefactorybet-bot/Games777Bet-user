// Qué herramientas muestra el ensamblador según el motor.
// Tres familias: no un `if` por cada juego.
//
//   rodillos  — 3×3, 5×3, ruleta de tajadas
//   mesa      — mines, crash, plinko, raspadita, keno, torre, ruleta-botones
//   instant   — limbo, dice, 7 up 7 down (escena React, sin escenario 420×860)

import type { NivelPremio, Sonido } from '../types.ts';

export type Familia = 'rodillos' | 'mesa' | 'instant';

export type SlotSonido = { tipo: Sonido['tipo']; etiqueta: string };
export type SlotNivel = { valor: NivelPremio; etiqueta: string };

export interface Caps {
  familia: Familia;
  simbolos: boolean;
  /** Capas del escenario: fondo de pantalla, marco, cartel. */
  capasEscenario: boolean;
  /** `fondo_url` (rodillo / tablero / casilla / rueda). */
  fondoArea: boolean;
  etiquetaFondoArea: string;
  girar: boolean;
  digitosPremio: boolean;
  efectosCss: boolean;
  efectosNivelesSlot: boolean;
  sonidos: SlotSonido[];
}

const SONIDO_RODILLOS: SlotSonido[] = [
  { tipo: 'musica_fondo', etiqueta: 'Música de fondo' },
  { tipo: 'giro', etiqueta: 'Sonido de giro' },
  { tipo: 'premio_chico', etiqueta: 'Premio chico' },
  { tipo: 'premio_grande', etiqueta: 'Premio grande' },
];

const SONIDO_MESA: SlotSonido[] = [
  { tipo: 'musica_fondo', etiqueta: 'Música de fondo' },
  { tipo: 'giro', etiqueta: 'Al jugar' },
  { tipo: 'premio_chico', etiqueta: 'Al ganar' },
  { tipo: 'premio_grande', etiqueta: 'Premio grande' },
];

const SONIDO_INSTANT: SlotSonido[] = [
  { tipo: 'musica_fondo', etiqueta: 'Música de fondo' },
  { tipo: 'premio_chico', etiqueta: 'Al ganar' },
  { tipo: 'premio_grande', etiqueta: 'Al perder' },
];

export const NIVELES_SLOT: SlotNivel[] = [
  { valor: 'dos_iguales', etiqueta: 'Dos iguales' },
  { valor: 'tres_iguales', etiqueta: 'Tres iguales' },
  { valor: 'premio_mayor', etiqueta: 'Premio mayor' },
];

export const NIVELES_MESA: SlotNivel[] = [
  { valor: 'tres_iguales', etiqueta: 'Al ganar' },
  { valor: 'premio_mayor', etiqueta: 'Premio grande' },
];

export function familiaDe(motor: string): Familia {
  const m = motor || '';
  if (m.startsWith('limbo') || m.startsWith('dice') || m.startsWith('sieteud')) return 'instant';
  if (
    m.startsWith('mines') || m.startsWith('crash') || m.startsWith('plinko')
    || m.startsWith('raspadita') || m.startsWith('keno') || m.startsWith('torre')
    || m === 'ruleta-botones'
  ) return 'mesa';
  return 'rodillos';
}

export function capsDe(motor: string): Caps {
  const familia = familiaDe(motor);
  const m = motor || '';

  if (familia === 'instant') {
    const esSieteUd = m.startsWith('sieteud');
    return {
      familia,
      simbolos: false,
      capasEscenario: false,
      fondoArea: !esSieteUd,
      etiquetaFondoArea: 'Fondo de pantalla',
      girar: false,
      digitosPremio: false,
      efectosCss: false,
      efectosNivelesSlot: false,
      sonidos: SONIDO_INSTANT,
    };
  }

  if (familia === 'mesa') {
    let etiquetaFondoArea = 'Fondo del área de juego';
    if (m.startsWith('mines')) etiquetaFondoArea = 'Textura de la casilla';
    else if (m.startsWith('plinko')) etiquetaFondoArea = 'Fondo del tablero';
    else if (m === 'ruleta-botones') etiquetaFondoArea = 'Fondo detrás de la rueda';
    return {
      familia,
      simbolos: false,
      capasEscenario: true,
      fondoArea: true,
      etiquetaFondoArea,
      girar: false,
      digitosPremio: true,
      efectosCss: true,
      efectosNivelesSlot: false,
      sonidos: SONIDO_MESA,
    };
  }

  return {
    familia,
    simbolos: true,
    capasEscenario: true,
    fondoArea: true,
    etiquetaFondoArea: m === 'ruleta' ? 'Fondo detrás de la rueda' : 'Fondo del rodillo',
    girar: true,
    digitosPremio: true,
    efectosCss: true,
    efectosNivelesSlot: true,
    sonidos: SONIDO_RODILLOS,
  };
}
