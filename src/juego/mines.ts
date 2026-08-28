// Helpers de Mines para el frontend. La matemática (dónde caen las
// minas, el multiplicador, cuándo se puede retirar) sale toda de
// `motor/mines-clasico.js` — la misma que usa el servidor. Acá solo
// va lo visual y el tipado.

import {
  colocarMinas as _colocarMinas,
  multiplicador as _multiplicador,
  puedeRetirar as _puedeRetirar,
  minasValidas as _minasValidas,
  TOTAL_CASILLAS,
} from '../../motor/mines-clasico.js';
import type { CSSProperties } from 'react';
import type { EstadoMines, Juego } from '../types.ts';

export const TOTAL: number = TOTAL_CASILLAS; // 25
export const LADO = 5; // grilla 5×5

export const colocarMinas = (minas: number): number[] => _colocarMinas(minas) as number[];
export const multiplicador = (minas: number, aciertos: number, margenCasa: number): number =>
  _multiplicador(minas, aciertos, margenCasa) as number;
export const puedeRetirar = (minas: number, aciertos: number): boolean =>
  _puedeRetirar(minas, aciertos) as boolean;
export const minasValidas = (minas: number): boolean => _minasValidas(minas) as boolean;

export const margenDe = (juego: Juego): number => Number(juego.mines_margen_pct ?? 0.03);

/** Cara de una casilla: la imagen configurada del juego o un estilo
 * por defecto con un emoji, así se puede probar la mecánica sin arte. */
export function casillaCara(
  juego: Juego,
  cara: 'oculta' | 'segura' | 'mina',
): { style: CSSProperties; emoji: string | null } {
  const url = cara === 'oculta' ? juego.mines_casilla_oculta_url
    : cara === 'segura' ? juego.mines_casilla_segura_url
    : juego.mines_casilla_mina_url;

  if (url) {
    return { style: { background: `center/cover no-repeat url('${url}')` }, emoji: null };
  }
  if (cara === 'oculta') {
    return { style: { background: 'var(--surface-alt)', border: '1px solid var(--border)' }, emoji: null };
  }
  if (cara === 'segura') {
    return { style: { background: 'rgba(91,191,136,.18)', border: '1px solid var(--ok)' }, emoji: '💎' };
  }
  return { style: { background: 'rgba(229,104,107,.22)', border: '1px solid var(--danger)' }, emoji: '💣' };
}

/** Estado visible de una partida de Mines, común a la vista previa y a
 * la pantalla real. `minasPos` es null mientras se juega (no se sabe /
 * no se muestra) y se llena al terminar. */
export interface EstadoPartida {
  fase: 'inactiva' | EstadoMines;
  minas: number;
  apuesta: number;
  reveladas: number[];
  minasPos: number[] | null;
  multiplicador: number;
  puedeRetirar: boolean;
  saldo: number;
  ganancia: number | null;
  cargando: boolean;
  error: string | null;
}

export function estadoInicial(minas: number, apuesta: number, saldo: number): EstadoPartida {
  return {
    fase: 'inactiva', minas, apuesta, reveladas: [], minasPos: null,
    multiplicador: 1, puedeRetirar: false, saldo, ganancia: null,
    cargando: false, error: null,
  };
}
