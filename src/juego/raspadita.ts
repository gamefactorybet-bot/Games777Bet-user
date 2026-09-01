// Helpers de la raspadita para el frontend. La matemática (RTP,
// sorteo del premio, armado de la grilla) sale toda de
// `motor/raspadita.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  metricasRTP as _metricas,
  rtpPromedio as _rtpProm,
  jugar as _jugar,
  CFG_DEFAULT,
} from '../../motor/raspadita.js';
import type { EstadoRaspa, Juego, PosControlesRaspa, RaspaCfg, TiradaRaspa } from '../types.ts';

export { CFG_DEFAULT };

export const cfgDe = (juego: Juego): RaspaCfg => _cfg(juego.raspa_cfg) as RaspaCfg;

export const cfgConDefaults = (cfg: Partial<RaspaCfg>): RaspaCfg => _cfg(cfg) as RaspaCfg;

export const metricasRTP = (cfg: Partial<RaspaCfg>): { rtp: number; unoCada: number; premioMax: number } =>
  _metricas(cfg) as { rtp: number; unoCada: number; premioMax: number };

export const rtpPromedio = (cfg: Partial<RaspaCfg>): number => _rtpProm(cfg) as number;

export const jugarLocal = (cfg: Partial<RaspaCfg>): TiradaRaspa => _jugar(cfg) as TiradaRaspa;

// ---------------- Posición de los controles ----------------

export const CONTROLES_RASPA_DEFAULT: PosControlesRaspa = {
  saldo: { x: 22, y: 8 },
  historial: { x: 62, y: 8 },
  tarjeta: { x: 50, y: 44, ancho: 300 },
  premio: { x: 50, y: 44 },
  apuesta: { x: 50, y: 84 },
  boton: { x: 50, y: 93, ancho: 300, alto: 52, imagen_url: null },
};

export function posControlesRaspaDe(cfg: Partial<RaspaCfg>): PosControlesRaspa {
  const g = (cfg.controles || {}) as Partial<PosControlesRaspa>;
  const d = CONTROLES_RASPA_DEFAULT;
  return {
    saldo: { ...d.saldo, ...g.saldo },
    historial: { ...d.historial, ...g.historial },
    tarjeta: { ...d.tarjeta, ...g.tarjeta },
    premio: { ...d.premio, ...g.premio },
    apuesta: { ...d.apuesta, ...g.apuesta },
    boton: { ...d.boton, ...g.boton },
  };
}

export function estadoInicial(apuesta: number, saldo: number): EstadoRaspa {
  return { saldo, apuesta, cargando: false, error: null, historial: [] };
}

/** Filas de la grilla según la cantidad de celdas (siempre 3 columnas). */
export const filasDeCeldas = (celdas: number): number => Math.max(1, Math.round(celdas / 3));
