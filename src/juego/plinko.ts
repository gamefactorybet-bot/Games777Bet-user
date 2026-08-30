// Helpers del Plinko para el frontend. La matemática (probabilidad de
// cada cubeta, tabla de multiplicadores, sorteo de la tirada) sale
// toda de `motor/plinko.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  tablaMultiplicadores as _tabla,
  probsCubetas as _probs,
  rtpDe as _rtpDe,
  rtpPromedio as _rtpProm,
  tirar as _tirar,
  CFG_DEFAULT,
} from '../../motor/plinko.js';
import type { EstadoPlinko, Juego, PlinkoCfg, PosControlesPlinko, TiradaResuelta } from '../types.ts';

export { CFG_DEFAULT };

export const cfgDe = (juego: Juego): PlinkoCfg => _cfg(juego.plinko_cfg) as PlinkoCfg;

export const tablaMultiplicadores = (filas: number, riesgo: string, rtp: number): number[] =>
  _tabla(filas, riesgo, rtp) as number[];

export const probsCubetas = (n: number): number[] => _probs(n) as number[];

export const rtpDe = (cfg: Partial<PlinkoCfg>, filas?: number, riesgo?: string): number =>
  _rtpDe(cfg, filas, riesgo) as number;

export const rtpPromedio = (cfg: Partial<PlinkoCfg>): number => _rtpProm(cfg) as number;

export const tirarLocal = (cfg: Partial<PlinkoCfg>, filas: number, riesgo: string): TiradaResuelta =>
  _tirar(cfg, filas, riesgo) as TiradaResuelta;

// ---------------- Posición de los controles ----------------

export const CONTROLES_PLINKO_DEFAULT: PosControlesPlinko = {
  saldo: { x: 22, y: 8 },
  historial: { x: 62, y: 8 },
  opciones: { x: 50, y: 74 },
  apuesta: { x: 50, y: 84 },
  boton: { x: 50, y: 93, ancho: 300, alto: 52, imagen_url: null },
};

export function posControlesPlinkoDe(cfg: Partial<PlinkoCfg>): PosControlesPlinko {
  const g = (cfg.controles || {}) as Partial<PosControlesPlinko>;
  const d = CONTROLES_PLINKO_DEFAULT;
  return {
    saldo: { ...d.saldo, ...g.saldo },
    historial: { ...d.historial, ...g.historial },
    opciones: { ...d.opciones, ...g.opciones },
    apuesta: { ...d.apuesta, ...g.apuesta },
    boton: { ...d.boton, ...g.boton },
  };
}

export function estadoInicial(apuesta: number, saldo: number, cfg: PlinkoCfg): EstadoPlinko {
  return {
    saldo, apuesta,
    filas: cfg.filasDefecto,
    riesgo: cfg.riesgoDefecto,
    cargando: false, error: null, historial: [],
  };
}
