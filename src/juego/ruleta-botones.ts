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
  Juego, NumeroRuleta, ResueltoBotones, RuletaBotonesCfg, RuletaSlot, SorpresaCfg,
} from '../types.ts';

export { CFG_DEFAULT };

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
  }));
}

export const totalTajadas = (numeros: NumeroRuleta[]): number =>
  numeros.reduce((a, n) => a + cantDe(n), 0);
