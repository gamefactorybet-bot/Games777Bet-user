// Helpers de la Ruleta de botones para el frontend. La matemática
// (reparto de tajadas, resolución del giro, RTP con sorpresa) sale
// toda de `motor/ruleta-botones.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  rtpNumero as _rtpNumero,
  rtpPromedio as _rtpPromedio,
  factorSorpresa as _factor,
  sorpresaEsperada as _es,
  girarBotones as _girar,
  CFG_DEFAULT,
} from '../../motor/ruleta-botones.js';
import { construirRueda } from '../../motor/ruleta-reparto.js';
import type {
  Juego, NumeroRuleta, PosControlesRuleta, ResueltoBotones, RuletaBotonesCfg, RuletaSlot, SorpresaCfg,
} from '../types.ts';

export { CFG_DEFAULT };

// ---------------- Posición de los controles de la mesa ----------------

export const CONTROLES_RULETA_DEFAULT: PosControlesRuleta = {
  sorpresa: { x: 50, y: 5 },
  resultado: { x: 50, y: 40 },
  fichas: { x: 50, y: 48 },
  botones: { x: 50, y: 69, ancho: 86 },
  saldo: { x: 24, y: 87 },
  apostado: { x: 58, y: 87 },
  girar: { x: 50, y: 95, ancho: 340, alto: 48, imagen_url: null },
};

/** Mezcla `cfg.controles` con los valores por defecto — lo que falte
 *  en el jsonb cae en el default. */
export function posControlesRuletaDe(cfg: Partial<RuletaBotonesCfg>): PosControlesRuleta {
  const g = (cfg.controles || {}) as Partial<PosControlesRuleta>;
  const d = CONTROLES_RULETA_DEFAULT;
  return {
    sorpresa: { ...d.sorpresa, ...g.sorpresa },
    resultado: { ...d.resultado, ...g.resultado },
    fichas: { ...d.fichas, ...g.fichas },
    botones: { ...d.botones, ...g.botones },
    saldo: { ...d.saldo, ...g.saldo },
    apostado: { ...d.apostado, ...g.apostado },
    girar: { ...d.girar, ...g.girar },
  };
}

export const cfgDe = (juego: Juego): RuletaBotonesCfg =>
  _cfg(juego.ruleta_botones_cfg) as RuletaBotonesCfg;

export const rtpNumero = (numeros: NumeroRuleta[], i: number): number =>
  _rtpNumero(numeros, i) as number;

export const rtpPromedio = (cfg: Partial<RuletaBotonesCfg>): number =>
  _rtpPromedio(cfg) as number;

export const factorSorpresa = (numeros: NumeroRuleta[], sorpresa: SorpresaCfg): number =>
  _factor(numeros, sorpresa) as number;

export const sorpresaEsperada = (pool: SorpresaCfg['pool']): number =>
  _es(pool) as number;

export const girarBotonesLocal = (
  cfg: Partial<RuletaBotonesCfg>,
  apuestas: Record<number, number>,
): ResueltoBotones => _girar(cfg, apuestas) as ResueltoBotones;

const cantDe = (n: NumeroRuleta) => Math.max(0, Math.round(Number(n.cant) || 0));
const multDe = (n: NumeroRuleta) => Math.max(0, Number(n.mult) || 0);

/** Las tajadas de la rueda ya repartidas, listas para dibujar. */
export function slotsDe(numeros: NumeroRuleta[]): RuletaSlot[] {
  return (construirRueda(numeros.map((n) => ({ ...n, peso: cantDe(n) }))) as NumeroRuleta[]).map((n) => ({
    et: n.et || ('×' + multDe(n)),
    mult: multDe(n),
    color: n.color || null,
    img: n.img || null,
  }));
}

export const totalTajadas = (numeros: NumeroRuleta[]): number =>
  numeros.reduce((a, n) => a + cantDe(n), 0);
