// Helpers de 7 Up 7 Down para el frontend. La matemática (probabilidad
// por zona, pago = rtp/P, sorteo de los dos dados) sale toda de
// `motor/sieteud.js` — la misma que corre el servidor.

import {
  cfgConDefaults as _cfg,
  probsZonas as _probs,
  pagoDe as _pagoDe,
  pagoRaw as _pagoRaw,
  rtpZona as _rtpZona,
  rtpDe as _rtpDe,
  zonaDeSuma as _zonaDeSuma,
  tirar as _tirar,
  CFG_DEFAULT,
} from '../../motor/sieteud.js';
import type { CSSProperties } from 'react';
import type { AjusteImg, Juego, PosControlesSieteUd, SieteUdCfg, TiradaInstant, ZonaSieteUd } from '../types.ts';
import type { PaletaDados } from './dados3d.ts';

export { CFG_DEFAULT };

/** El juego se diseña sobre una escena de teléfono de 420 × 860. */
export const ESCENA_W = 420;
export const ESCENA_H = 860;

export const ZONAS: ZonaSieteUd[] = ['abajo', 'siete', 'arriba'];

export const ZONA_INFO: Record<ZonaSieteUd, { nombre: string; rango: string }> = {
  abajo: { nombre: '7 ABAJO', rango: '2 – 6' },
  siete: { nombre: 'LUCKY 7', rango: '= 7' },
  arriba: { nombre: '7 ARRIBA', rango: '8 – 12' },
};

export const cfgDe = (juego: Juego): SieteUdCfg => _cfg(juego.sieteud_cfg) as SieteUdCfg;
export const cfgConDefaults = (cfg: Partial<SieteUdCfg>): SieteUdCfg => _cfg(cfg) as SieteUdCfg;

export const probsZonas = (caras: number): Record<ZonaSieteUd, number> => _probs(caras) as never;
export const pagoDe = (cfg: Partial<SieteUdCfg>, zona: ZonaSieteUd): number => _pagoDe(cfg, zona) as number;
export const pagoRaw = (cfg: Partial<SieteUdCfg>, zona: ZonaSieteUd): number => _pagoRaw(cfg, zona) as number;
export const rtpZona = (cfg: Partial<SieteUdCfg>, zona: ZonaSieteUd): number => _rtpZona(cfg, zona) as number;
export const rtpDe = (cfg: Partial<SieteUdCfg>): number => _rtpDe(cfg) as number;
export const zonaDeSuma = (s: number): ZonaSieteUd => _zonaDeSuma(s) as ZonaSieteUd;

export const tirarLocal = (cfg: Partial<SieteUdCfg>, zona: ZonaSieteUd): TiradaInstant & {
  dados: [number, number]; suma: number; zona: ZonaSieteUd; zonaGanadora: ZonaSieteUd; mult: number; gano: boolean;
} => _tirar(cfg, zona) as never;

// Reparto de la suma 2..2N para dibujar la campana.
export function campana(caras: number): { suma: number; frac: number; zona: ZonaSieteUd }[] {
  const N = Math.max(2, Math.min(12, Math.round(caras || 6)));
  const conteo: Record<number, number> = {};
  for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) conteo[a + b] = (conteo[a + b] || 0) + 1;
  const max = Math.max(...Object.values(conteo));
  return Object.keys(conteo).map((k) => {
    const s = Number(k);
    return { suma: s, frac: conteo[s] / max, zona: zonaDeSuma(s) };
  });
}

// ---------------- Paleta de la mesa por tema (para el canvas 3D) ----------------
// Los ids son los de instant-temas.ts.

const PALETAS: Record<string, PaletaDados> = {
  clasico: { feltA: '#1e2b46', feltB: '#111726', dieHi: '#ffffff', dieLo: '#d7ddec', pip: '#1b2130' },
  dorado: { feltA: '#2b2113', feltB: '#15100a', dieHi: '#2d323e', dieLo: '#191c24', pip: '#e6b354' },
  neon: { feltA: '#2a0d24', feltB: '#0a0712', dieHi: '#161125', dieLo: '#0e0a1c', pip: '#ff6bc0' },
  oceano: { feltA: '#0d2a37', feltB: '#08131d', dieHi: '#1c2942', dieLo: '#0f1626', pip: '#5ef0d0' },
  casino: { feltA: '#1c3f2b', feltB: '#0d2016', dieHi: '#fdf9ef', dieLo: '#e3dbc3', pip: '#c8352f' },
  rubi: { feltA: '#3b161a', feltB: '#1b0b0d', dieHi: '#ffffff', dieLo: '#e7d9db', pip: '#9e1f27' },
  zafiro: { feltA: '#162c54', feltB: '#0a1430', dieHi: '#f1f5ff', dieLo: '#c6d3ef', pip: '#274079' },
  amatista: { feltA: '#33204a', feltB: '#190f28', dieHi: '#f6f0fd', dieLo: '#d7c8ec', pip: '#5b3b86' },
  grafito: { feltA: '#282b31', feltB: '#131417', dieHi: '#3b4048', dieLo: '#22262c', pip: '#eef1f5' },
  arena: { feltA: '#3a2b1a', feltB: '#180f08', dieHi: '#4a4030', dieLo: '#2c2519', pip: '#f2e4c4' },
};

export function paletaDadosDe(temaId: string | undefined | null): PaletaDados {
  return PALETAS[temaId || 'clasico'] || PALETAS.clasico;
}

// ---------------- Retoque de imágenes ----------------

export const AJUSTE_IMG_DEFAULT: AjusteImg = { fit: 'cover', x: 50, y: 50, zoom: 100, blur: 0, osc: 0 };

export const FIT_OPC: { v: AjusteImg['fit']; t: string }[] = [
  { v: 'cover', t: 'Cubrir' }, { v: 'contain', t: 'Contener' }, { v: 'fill', t: 'Estirar' },
];

function filtroDe(a: AjusteImg): string {
  return [a.blur ? `blur(${a.blur}px)` : '', a.osc ? `brightness(${1 - a.osc / 100})` : '']
    .filter(Boolean).join(' ');
}

/**
 * Fondo full-bleed: SIEMPRE cubre (nunca deja franjas). El retoque sólo
 * panea, agranda (zoom ≥ 100 %), desenfoca y oscurece. Para una capa
 * `position:absolute; inset:0` dentro de un contenedor con overflow:hidden.
 */
export function estiloFondo(url: string | null | undefined, a: AjusteImg): CSSProperties {
  if (!url) return {};
  const z = Math.max(1, a.zoom / 100) + a.blur * 0.012;
  const f = filtroDe(a);
  return {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `url("${url}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundPosition: `${a.x}% ${a.y}%`,
    transform: `scale(${z.toFixed(3)})`,
    transformOrigin: `${a.x}% ${a.y}%`,
    ...(f ? { filter: f } : {}),
  };
}

/**
 * Imagen de contenido (cartel, botón): respeta el encuadre elegido y el
 * zoom en los tres modos. Pensada para una capa dedicada `position:absolute;
 * inset:0` (no para aplicarse directo al elemento interactivo): el zoom se
 * hace con `transform:scale()` sobre esa capa, igual que `estiloFondo`, para
 * no reescalar el botón/cartel entero (texto, borde) junto con la imagen.
 */
export function estiloImg(url: string | null | undefined, a: AjusteImg): CSSProperties {
  if (!url) return {};
  const size = a.fit === 'fill' ? '100% 100%' : a.fit;
  const z = Math.max(1, a.zoom / 100);
  const f = filtroDe(a);
  return {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `url("${url}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${a.x}% ${a.y}%`,
    backgroundSize: size,
    transform: z !== 1 ? `scale(${z.toFixed(3)})` : undefined,
    transformOrigin: `${a.x}% ${a.y}%`,
    ...(f ? { filter: f } : {}),
  };
}

// ---------------- Piezas de la escena ----------------
// Una sola lista que maneja el layout (SieteUdMesa) y el editor
// (SieteUdEditor) de forma genérica.

export type TipoPieza = 'punto' | 'ancho' | 'caja';

export interface MetaPieza {
  id: keyof PosControlesSieteUd;
  etiqueta: string;
  tipo: TipoPieza;
}

export const PIEZAS_SIETEUD: MetaPieza[] = [
  { id: 'mesa', etiqueta: 'Mesa (dados)', tipo: 'caja' },
  { id: 'cartel', etiqueta: 'Cartel de premio', tipo: 'caja' },
  { id: 'suma', etiqueta: 'Suma', tipo: 'punto' },
  { id: 'campana', etiqueta: 'Campana', tipo: 'ancho' },
  { id: 'zonas', etiqueta: 'Zonas de apuesta', tipo: 'ancho' },
  { id: 'apuesta', etiqueta: 'Apuesta / fichas', tipo: 'punto' },
  { id: 'boton', etiqueta: 'Botón de tirar', tipo: 'ancho' },
  { id: 'saldo', etiqueta: 'Saldo', tipo: 'punto' },
  { id: 'historial', etiqueta: 'Historial', tipo: 'punto' },
];

// ---------------- Posición de las piezas (% de 420 × 860) ----------------

export const CONTROLES_SIETEUD_DEFAULT: PosControlesSieteUd = {
  saldo: { x: 16, y: 4, escala: 1 },
  historial: { x: 78, y: 4, escala: 1 },
  mesa: { x: 50, y: 27, w: 92, h: 40, escala: 1 },
  cartel: { x: 50, y: 24, w: 80, h: 20, escala: 1 },
  suma: { x: 50, y: 52, escala: 1 },
  campana: { x: 50, y: 60, w: 68, escala: 1 },
  zonas: { x: 50, y: 71, w: 94, escala: 1 },
  apuesta: { x: 50, y: 82, escala: 1 },
  boton: { x: 50, y: 92, w: 84, escala: 1 },
};

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function posControlesSieteUdDe(cfg: Partial<SieteUdCfg>): PosControlesSieteUd {
  const g = (cfg.controles || {}) as Partial<PosControlesSieteUd>;
  const d = CONTROLES_SIETEUD_DEFAULT;
  const uno = <T extends { escala: number }>(base: T, over: Partial<T> | undefined): T => {
    const m = { ...base, ...(over || {}) };
    m.escala = num(m.escala, 1);
    return m;
  };
  return {
    saldo: uno(d.saldo, g.saldo),
    historial: uno(d.historial, g.historial),
    mesa: uno(d.mesa, g.mesa),
    cartel: uno(d.cartel, g.cartel),
    suma: uno(d.suma, g.suma),
    campana: uno(d.campana, g.campana),
    zonas: uno(d.zonas, g.zonas),
    apuesta: uno(d.apuesta, g.apuesta),
    boton: uno(d.boton, g.boton),
  };
}
