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
import type { EstadoMines, Juego, PosControlesMines } from '../types.ts';
import { temaMinesDe } from './mines-temas.ts';

export const TOTAL: number = TOTAL_CASILLAS; // 25
export const LADO = 5; // grilla 5×5

export const colocarMinas = (minas: number): number[] => _colocarMinas(minas) as number[];
export const multiplicador = (minas: number, aciertos: number, margenCasa: number): number =>
  _multiplicador(minas, aciertos, margenCasa) as number;
export const puedeRetirar = (minas: number, aciertos: number): boolean =>
  _puedeRetirar(minas, aciertos) as boolean;
export const minasValidas = (minas: number): boolean => _minasValidas(minas) as boolean;

export const margenDe = (juego: Juego): number => Number(juego.mines_margen_pct ?? 0.03);

export type Cara = 'oculta' | 'segura' | 'mina';

/** Cómo mostrar una cara de la casilla. Orden de resolución:
 * animación Lottie → imagen → estilo por defecto (con emoji). */
export interface CaraVisual {
  lottie: string | null;
  imagen: string | null;
  /** Estilo cuando no hay lottie ni imagen. */
  estilo: CSSProperties;
  emoji: string | null;
}

const CAMPO_LOTTIE: Record<Cara, keyof Juego> = {
  oculta: 'mines_casilla_oculta_lottie_url',
  segura: 'mines_casilla_segura_lottie_url',
  mina: 'mines_casilla_mina_lottie_url',
};
const CAMPO_IMAGEN: Record<Cara, keyof Juego> = {
  oculta: 'mines_casilla_oculta_url',
  segura: 'mines_casilla_segura_url',
  mina: 'mines_casilla_mina_url',
};

export function casillaCara(juego: Juego, cara: Cara): CaraVisual {
  const tema = temaMinesDe(juego.mines_tema);
  const defecto = cara === 'oculta'
    ? { estilo: { background: 'var(--mn-tile, var(--surface-alt))', border: '1px solid var(--mn-tile-border, var(--border))' } as CSSProperties, emoji: null }
    : cara === 'segura'
      ? { estilo: { background: 'var(--mn-safe-bg, rgba(91,191,136,.14))', border: '1px solid var(--mn-safe, var(--ok))' } as CSSProperties, emoji: tema.emojiSafe }
      : { estilo: { background: 'var(--mn-mine-bg, rgba(229,104,107,.16))', border: '1px solid var(--mn-mine, var(--danger))' } as CSSProperties, emoji: tema.emojiMina };

  return {
    lottie: (juego[CAMPO_LOTTIE[cara]] as string) || null,
    imagen: (juego[CAMPO_IMAGEN[cara]] as string) || null,
    estilo: defecto.estilo,
    emoji: defecto.emoji,
  };
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
  /** Casilla que pisó el jugador (para animar solo esa como explosión). */
  clicMina: number | null;
  /** Casilla tocada que está esperando la respuesta del servidor
   *  (feedback inmediato al click, antes de saber si es mina o segura). */
  pendiente: number | null;
  multiplicador: number;
  puedeRetirar: boolean;
  saldo: number;
  ganancia: number | null;
  cargando: boolean;
  error: string | null;
}

// ---------------- Controles del tablero (posición + aspecto) ----------------

export const CONTROLES_MINES_DEFAULT: PosControlesMines = {
  saldo: { x: 26, y: 8, ancho: 120, alto: 44, fondo_url: null },
  mult: { x: 74, y: 8, ancho: 152, alto: 44, fondo_url: null },
  apuesta: { x: 50, y: 79 },
  minas: { x: 50, y: 70, ancho: 180, grosor: 8, carril_url: null, thumb_url: null },
  boton: { x: 50, y: 91, ancho: 168, alto: 52, imagen_url: null },
};

/** Mezcla lo guardado en `juego.mines_controles` con los valores por
 * defecto — lo que falte en el jsonb cae en el default. */
export function posControlesDe(juego: Juego): PosControlesMines {
  const g = (juego.mines_controles || {}) as Partial<PosControlesMines>;
  const d = CONTROLES_MINES_DEFAULT;
  return {
    saldo: { ...d.saldo, ...g.saldo },
    mult: { ...d.mult, ...g.mult },
    apuesta: { ...d.apuesta, ...g.apuesta },
    minas: { ...d.minas, ...g.minas },
    boton: { ...d.boton, ...g.boton },
  };
}

export function estadoInicial(minas: number, apuesta: number, saldo: number): EstadoPartida {
  return {
    fase: 'inactiva', minas, apuesta, reveladas: [], minasPos: null, clicMina: null, pendiente: null,
    multiplicador: 1, puedeRetirar: false, saldo, ganancia: null,
    cargando: false, error: null,
  };
}
