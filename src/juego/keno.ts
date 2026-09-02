// Helpers del Keno para el frontend. La matemática (probabilidad
// hipergeométrica, tabla de multiplicadores, sorteo) sale toda de
// `motor/keno.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  tablaDe as _tabla,
  tablaBase as _tablaBase,
  rtpTabla as _rtpTabla,
  rtpDe as _rtpDe,
  probAciertos as _prob,
  tirar as _tirar,
  CFG_DEFAULT,
} from '../../motor/keno.js';
import type { EstadoKeno, Juego, KenoCfg, PosControlesKeno, TiradaInstant } from '../types.ts';

export { CFG_DEFAULT };

export const cfgDe = (juego: Juego): KenoCfg => _cfg(juego.keno_cfg) as KenoCfg;
export const cfgConDefaults = (cfg: Partial<KenoCfg>): KenoCfg => _cfg(cfg) as KenoCfg;

export const tablaDe = (cfg: Partial<KenoCfg>, marcados: number): number[] => _tabla(cfg, marcados) as number[];
export const tablaBase = (cfg: Partial<KenoCfg>, marcados: number): number[] => _tablaBase(cfg, marcados) as number[];
export const rtpTabla = (cfg: Partial<KenoCfg>, marcados: number): number => _rtpTabla(cfg, marcados) as number;
export const rtpDe = (cfg: Partial<KenoCfg>): number => _rtpDe(cfg) as number;
export const probAciertos = (T: number, D: number, P: number, h: number): number => _prob(T, D, P, h) as number;

export const tirarLocal = (cfg: Partial<KenoCfg>, marcados: number[]): TiradaInstant & {
  sorteados: number[]; marcados: number[]; aciertos: number; mult: number; gano: boolean;
} => _tirar(cfg, marcados) as never;

export const columnasKeno = (tablero: number): number => (tablero === 25 ? 5 : tablero === 80 ? 10 : 8);

// ---------------- Posición de los controles ----------------

export const CONTROLES_KENO_DEFAULT: PosControlesKeno = {
  saldo: { x: 20, y: 8 },
  historial: { x: 68, y: 8 },
  bolillero: { x: 50, y: 19, ancho: 86 },
  tablero: { x: 50, y: 41, ancho: 348 },
  premio: { x: 50, y: 55 },
  apuesta: { x: 50, y: 64 },
  acciones: { x: 50, y: 73 },
  boton: { x: 50, y: 87, ancho: 300, alto: 52, imagen_url: null },
};

export function posControlesKenoDe(cfg: Partial<KenoCfg>): PosControlesKeno {
  const g = (cfg.controles || {}) as Partial<PosControlesKeno>;
  const d = CONTROLES_KENO_DEFAULT;
  return {
    saldo: { ...d.saldo, ...g.saldo },
    historial: { ...d.historial, ...g.historial },
    bolillero: { ...d.bolillero, ...g.bolillero },
    tablero: { ...d.tablero, ...g.tablero },
    premio: { ...d.premio, ...g.premio },
    apuesta: { ...d.apuesta, ...g.apuesta },
    acciones: { ...d.acciones, ...g.acciones },
    boton: { ...d.boton, ...g.boton },
  };
}

export function estadoInicial(apuesta: number, saldo: number): EstadoKeno {
  return { saldo, apuesta, picked: [], drawn: [], fase: 'idle', res: null, cargando: false, error: null, historial: [] };
}
