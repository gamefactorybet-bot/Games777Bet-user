// Helpers de la Torre para el frontend. La matemática (chance por
// piso, escalera de multiplicadores, sorteo de trampas) sale toda de
// `motor/torre.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  forma as _forma,
  chanceZafar as _chance,
  multBase as _multBase,
  multPiso as _multPiso,
  tablaMultiplicadores as _tabla,
  rtpPiso as _rtpPiso,
  rtpDe as _rtpDe,
  sortearTrampas as _sortear,
  DIFICULTADES,
  CFG_DEFAULT,
} from '../../motor/torre.js';
import type { EstadoTorre, Juego, PosControlesTorre, TorreCfg } from '../types.ts';

export { CFG_DEFAULT, DIFICULTADES };

export const cfgDe = (juego: Juego): TorreCfg => _cfg(juego.torre_cfg) as TorreCfg;
export const cfgConDefaults = (cfg: Partial<TorreCfg>): TorreCfg => _cfg(cfg) as TorreCfg;

export const forma = (cfg: Partial<TorreCfg>): { cols: number; trampas: number } => _forma(cfg) as never;
export const chanceZafar = (cfg: Partial<TorreCfg>): number => _chance(cfg) as number;
export const multBase = (cfg: Partial<TorreCfg>, k: number): number => _multBase(cfg, k) as number;
export const multPiso = (cfg: Partial<TorreCfg>, k: number): number => _multPiso(cfg, k) as number;
export const tablaMultiplicadores = (cfg: Partial<TorreCfg>): number[] => _tabla(cfg) as number[];
export const rtpPiso = (cfg: Partial<TorreCfg>, k: number): number => _rtpPiso(cfg, k) as number;
export const rtpDe = (cfg: Partial<TorreCfg>): number => _rtpDe(cfg) as number;
export const sortearTrampas = (cfg: Partial<TorreCfg>): number[][] => _sortear(cfg) as number[][];

// ---------------- Posición de los controles ----------------

export const CONTROLES_TORRE_DEFAULT: PosControlesTorre = {
  saldo: { x: 20, y: 7 },
  historial: { x: 68, y: 7 },
  multiplicador: { x: 50, y: 15 },
  apuesta: { x: 50, y: 84 },
  premio: { x: 50, y: 40 },
  torre: { x: 50, y: 47, ancho: 300 },
  boton: { x: 50, y: 92, ancho: 300, alto: 50, imagen_url: null },
};

export function posControlesTorreDe(cfg: Partial<TorreCfg>): PosControlesTorre {
  const g = (cfg.controles || {}) as Partial<PosControlesTorre>;
  const d = CONTROLES_TORRE_DEFAULT;
  return {
    saldo: { ...d.saldo, ...g.saldo },
    historial: { ...d.historial, ...g.historial },
    multiplicador: { ...d.multiplicador, ...g.multiplicador },
    apuesta: { ...d.apuesta, ...g.apuesta },
    premio: { ...d.premio, ...g.premio },
    torre: { ...d.torre, ...g.torre },
    boton: { ...d.boton, ...g.boton },
  };
}

export function estadoInicial(apuesta: number, saldo: number): EstadoTorre {
  return {
    saldo, apuesta, piso: 1, picks: [], trampas: null,
    fase: 'idle', mult: 1, res: null, error: null, historial: [],
  };
}
