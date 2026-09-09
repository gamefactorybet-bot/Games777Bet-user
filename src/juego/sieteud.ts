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
import { MATERIALES_DADO, type MaterialDado, type PaletaDados } from './dados3d.ts';

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

const FIELTRO: Record<string, { feltA: string; feltB: string; railA: string; railB: string; lip: string }> = {
  clasico: { feltA: '#1e2b46', feltB: '#111726', railA: '#4a3424', railB: '#1c140e', lip: '#c4a15a' },
  dorado: { feltA: '#2b2113', feltB: '#15100a', railA: '#6a4e22', railB: '#2a1c0a', lip: '#e8c583' },
  neon: { feltA: '#2a0d24', feltB: '#0a0712', railA: '#1a0e1c', railB: '#08050c', lip: '#ff5fc8' },
  oceano: { feltA: '#0d2a37', feltB: '#08131d', railA: '#1a3a48', railB: '#0a1a22', lip: '#5ec8e0' },
  casino: { feltA: '#1c3f2b', feltB: '#0d2016', railA: '#3d2414', railB: '#1a0e08', lip: '#d4a84a' },
  rubi: { feltA: '#3b161a', feltB: '#1b0b0d', railA: '#4a1818', railB: '#1a0808', lip: '#e07070' },
  zafiro: { feltA: '#162c54', feltB: '#0a1430', railA: '#1a2a4a', railB: '#0a1228', lip: '#7aa0f0' },
  amatista: { feltA: '#33204a', feltB: '#190f28', railA: '#2e1a3a', railB: '#12081c', lip: '#c090e0' },
  grafito: { feltA: '#282b31', feltB: '#131417', railA: '#3a3e44', railB: '#16181c', lip: '#c8ccd0' },
  arena: { feltA: '#3a2b1a', feltB: '#180f08', railA: '#5a3e22', railB: '#221408', lip: '#e0c090' },
};

const CUERPO: Record<MaterialDado, { dieHi: string; dieLo: string; pip: string }> = {
  marfil: { dieHi: '#f6f1e6', dieLo: '#c4b498', pip: '#1a1d24' },
  oro: { dieHi: '#f4d78a', dieLo: '#8a5410', pip: '#3a2108' },
  cromo: { dieHi: '#f0f4f8', dieLo: '#4a545e', pip: '#12151a' },
  cristal: { dieHi: '#e4f2ff', dieLo: '#5a8aaa', pip: '#1a3348' },
  rubi: { dieHi: '#ff8a96', dieLo: '#6a101c', pip: '#2a060c' },
  onix: { dieHi: '#4a5058', dieLo: '#0c0e12', pip: '#e8e4d4' },
};

export { MATERIALES_DADO };

export function paletaDadosDe(temaId?: string | null, materialId?: string | null): PaletaDados {
  const felt = FIELTRO[temaId || 'clasico'] || FIELTRO.clasico;
  const mat = (MATERIALES_DADO.some((m) => m.id === materialId) ? materialId : 'marfil') as MaterialDado;
  return { ...felt, ...CUERPO[mat], material: mat };
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
  historial: { x: 72, y: 4.2, escala: 1 },
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
