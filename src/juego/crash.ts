// Helpers del Crash para el frontend. La matemática (crecimiento del
// multiplicador, punto de reventón, RTP, resolución del retiro) sale
// toda de `motor/crash.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  crecimiento as _crecimiento,
  tiempoHasta as _tiempoHasta,
  rtpTeorico as _rtp,
  CFG_DEFAULT,
} from '../../motor/crash.js';
import type { CrashCfg, EstadoCrash, Juego, PosControlesCrash } from '../types.ts';

export { CFG_DEFAULT };

export const cfgDe = (juego: Juego): CrashCfg => _cfg(juego.crash_cfg) as CrashCfg;

export const crecimiento = (tMs: number, cfg: Partial<CrashCfg>): number =>
  _crecimiento(tMs, cfg) as number;

export const tiempoHasta = (mult: number, cfg: Partial<CrashCfg>): number =>
  _tiempoHasta(mult, cfg) as number;

export const rtpTeorico = (cfg: Partial<CrashCfg>): number => _rtp(cfg) as number;

// ---------------- Posición de los controles de la mesa ----------------

export const CONTROLES_CRASH_DEFAULT: PosControlesCrash = {
  multiplicador: { x: 50, y: 33 },
  historial: { x: 50, y: 6 },
  saldo: { x: 22, y: 8 },
  auto: { x: 50, y: 70 },
  apuesta: { x: 50, y: 80 },
  boton: { x: 50, y: 90, ancho: 300, alto: 54, imagen_url: null },
};

/** Mezcla `cfg.controles` con los valores por defecto. */
export function posControlesCrashDe(cfg: Partial<CrashCfg>): PosControlesCrash {
  const g = (cfg.controles || {}) as Partial<PosControlesCrash>;
  const d = CONTROLES_CRASH_DEFAULT;
  return {
    multiplicador: { ...d.multiplicador, ...g.multiplicador },
    historial: { ...d.historial, ...g.historial },
    saldo: { ...d.saldo, ...g.saldo },
    auto: { ...d.auto, ...g.auto },
    apuesta: { ...d.apuesta, ...g.apuesta },
    boton: { ...d.boton, ...g.boton },
  };
}

export function estadoInicial(apuesta: number, saldo: number, cfg: CrashCfg): EstadoCrash {
  return {
    fase: 'inactiva', apuesta, saldo, multiplicador: 1,
    roundId: null, inicioTs: null, reventadoEn: null, ganancia: null,
    autoActivo: false, autoObjetivo: cfg.auto.valorDefecto,
    cargando: false, error: null, historial: [],
  };
}
