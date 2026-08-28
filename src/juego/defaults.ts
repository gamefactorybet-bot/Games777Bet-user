// Valores por defecto y helpers de dominio compartidos entre la vista
// previa del ensamblador (Preview) y la pantalla real del jugador
// (Jugar). Antes estaban copiados en `preview.js` y `jugar.js` con
// prefijos distintos y se desincronizaban.

import type { Juego, NivelPremio, PremioVisual } from '../types.ts';

/** Las cuatro capas que se posicionan y ordenan libremente. */
export const CAPAS = ['fondo_pantalla', 'marco', 'grilla', 'cartel'] as const;
export type CapaId = (typeof CAPAS)[number];

export const NOMBRE_CAPA: Record<CapaId, string> = {
  fondo_pantalla: 'Fondo de pantalla',
  marco: 'Marco',
  grilla: 'Grilla',
  cartel: 'Cartel',
};

export const NIVELES_PREMIO: { valor: NivelPremio; etiqueta: string }[] = [
  { valor: 'dos_iguales', etiqueta: 'Dos iguales' },
  { valor: 'tres_iguales', etiqueta: 'Tres iguales' },
  { valor: 'premio_mayor', etiqueta: 'Premio mayor' },
];

/** Posición, tamaño y filtros de las cuatro capas. Todo en % de la
 * pantalla salvo el blur (px). La grilla usa un solo "tamaño" para
 * mantener las celdas cuadradas. */
export interface PosCapas {
  fondo_pantalla_x: number; fondo_pantalla_y: number;
  fondo_pantalla_ancho: number; fondo_pantalla_alto: number;
  marco_x: number; marco_y: number;
  marco_ancho: number; marco_alto: number;
  grilla_x: number; grilla_y: number;
  grilla_tamano: number;
  grilla_icono_tamano: number;
  cartel_x: number; cartel_y: number;
  cartel_ancho: number; cartel_alto: number;
  fondo_pantalla_blur: number; fondo_pantalla_oscurecer: number;
  marco_blur: number; marco_oscurecer: number;
  cartel_blur: number; cartel_oscurecer: number;
  fondo_blur: number; fondo_oscurecer: number;
  [campo: string]: number;
}

const num = (v: unknown, def: number): number => (v == null ? def : Number(v));

// Valores por defecto si el juego todavía no tiene posición guardada
// (juegos creados antes de que existiera este ajuste).
export function conDefaults(juego: Juego): PosCapas {
  return {
    fondo_pantalla_x: num(juego.fondo_pantalla_x, 50), fondo_pantalla_y: num(juego.fondo_pantalla_y, 50),
    fondo_pantalla_ancho: num(juego.fondo_pantalla_ancho, 100), fondo_pantalla_alto: num(juego.fondo_pantalla_alto, 100),
    marco_x: num(juego.marco_x, 50), marco_y: num(juego.marco_y, 50),
    marco_ancho: num(juego.marco_ancho, 100), marco_alto: num(juego.marco_alto, 100),
    grilla_x: num(juego.grilla_x, 50), grilla_y: num(juego.grilla_y, 46),
    grilla_tamano: num(juego.grilla_tamano, 70),
    grilla_icono_tamano: num(juego.grilla_icono_tamano, 60),
    cartel_x: num(juego.cartel_x, 50), cartel_y: num(juego.cartel_y, 15),
    cartel_ancho: num(juego.cartel_ancho, 75), cartel_alto: num(juego.cartel_alto, 16),
    fondo_pantalla_blur: num(juego.fondo_pantalla_blur, 0), fondo_pantalla_oscurecer: num(juego.fondo_pantalla_oscurecer, 0),
    marco_blur: num(juego.marco_blur, 0), marco_oscurecer: num(juego.marco_oscurecer, 0),
    cartel_blur: num(juego.cartel_blur, 0), cartel_oscurecer: num(juego.cartel_oscurecer, 0),
    fondo_blur: num(juego.fondo_blur, 0), fondo_oscurecer: num(juego.fondo_oscurecer, 0),
  };
}

export function ordenPorDefecto(juego: Juego): CapaId[] {
  const orden = juego.capas_orden;
  if (Array.isArray(orden) && orden.length === 4) return [...orden] as CapaId[];
  return ['fondo_pantalla', 'marco', 'grilla', 'cartel'];
}

// Blur + oscurecer con `filter`. Para el fondo del rodillo va en la
// sub-capa de atrás, no en la grilla entera — si no, los íconos de las
// frutas se difuminarían también.
export function filtroCss(blur: number, oscurecer: number): string {
  return `blur(${blur}px) brightness(${1 - oscurecer / 100})`;
}

/** Estado editable del cuadro de premio de un nivel. Sale de una fila
 * de `premios_visuales` o de sus valores por defecto. */
export interface PosPremio {
  id: string | null;
  imagen_url: string | null;
  x: number; y: number; ancho: number; alto: number;
  blur: number; oscurecer: number;
  imagen_x: number; imagen_y: number; imagen_tamano: number;
  monto_x: number; monto_y: number;
  monto_alto: number; monto_espaciado: number;
}

export function posPremioDefaults(fila?: Partial<PremioVisual> | null): PosPremio {
  return {
    id: fila?.id || null,
    imagen_url: fila?.imagen_url || null,
    x: fila?.x ?? 50, y: fila?.y ?? 50, ancho: fila?.ancho ?? 60, alto: fila?.alto ?? 30,
    blur: fila?.blur ?? 0, oscurecer: fila?.oscurecer ?? 0,
    imagen_x: fila?.imagen_x ?? 50, imagen_y: fila?.imagen_y ?? 50, imagen_tamano: fila?.imagen_tamano ?? 60,
    monto_x: fila?.monto_x ?? 50, monto_y: fila?.monto_y ?? 50,
    monto_alto: fila?.monto_alto ?? 44, monto_espaciado: fila?.monto_espaciado ?? 4,
  };
}

export function escapeHtml(str: unknown): string {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
