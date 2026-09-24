// Qué controles de slot se muestran en un juego. Lo que no está
// guardado queda prendido: un juego viejo no pierde botones.

export const CLAVES_PLANILLA = [
  { clave: 'girar', etiqueta: 'Girar' },
  { clave: 'auto', etiqueta: 'Auto' },
  { clave: 'fichas', etiqueta: 'Fichas' },
  { clave: 'menos', etiqueta: '− bajar apuesta' },
  { clave: 'mas', etiqueta: '+ subir apuesta' },
  { clave: 'x1', etiqueta: 'Velocidad x1' },
  { clave: 'x2', etiqueta: 'Velocidad x2' },
  { clave: 'x3', etiqueta: 'Velocidad x3' },
] as const;

export type ClavePlanilla = (typeof CLAVES_PLANILLA)[number]['clave'];

export interface Planilla {
  visibles: Record<ClavePlanilla, boolean>;
  /** PNG del botón Auto. Las demás imágenes viven en girar / botones. */
  autoImagen: string | null;
  /** null = a la izquierda de Girar, como antes de tener controles. */
  autoX: number | null;
  autoY: number | null;
  /** Lado más largo del PNG, en px. La otra medida sigue la forma del archivo. */
  autoTam: number;
  /** Posición propia de cada velocidad. Vacío = siguen en fila alrededor de turbo_x/y. */
  turboPos: Partial<Record<'x1' | 'x2' | 'x3', { x: number; y: number }>>;
}

const PRENDIDO: Record<ClavePlanilla, boolean> = {
  girar: true, auto: true, fichas: true, menos: true, mas: true, x1: true, x2: true, x3: true,
};

export function planillaDe(juego: { planilla?: unknown } | null | undefined): Planilla {
  const crudo = juego && juego.planilla && typeof juego.planilla === 'object'
    ? juego.planilla as Record<string, unknown>
    : {};
  const vis = crudo.visibles && typeof crudo.visibles === 'object'
    ? crudo.visibles as Record<string, unknown>
    : {};
  const visibles = { ...PRENDIDO };
  (Object.keys(PRENDIDO) as ClavePlanilla[]).forEach((k) => {
    if (vis[k] === false) visibles[k] = false;
  });
  const auto = crudo.auto_imagen_url;
  return {
    visibles,
    autoImagen: typeof auto === 'string' && auto ? auto : null,
    autoX: pct(crudo.auto_x),
    autoY: pct(crudo.auto_y),
    autoTam: tamAuto(crudo.auto_tam),
    turboPos: turboPosDe(crudo.turbo_pos),
  };
}

function turboPosDe(v: unknown): Planilla['turboPos'] {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : {};
  const out: Planilla['turboPos'] = {};
  (['x1', 'x2', 'x3'] as const).forEach((k) => {
    const p = o[k] && typeof o[k] === 'object' ? o[k] as Record<string, unknown> : null;
    const x = p ? pct(p.x) : null;
    const y = p ? pct(p.y) : null;
    if (x != null && y != null) out[k] = { x, y };
  });
  return out;
}

function pct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.max(0, Math.min(100, n)));
}

function tamAuto(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 64;
  return Math.round(Math.max(28, Math.min(220, n)));
}

export function planillaJson(p: Planilla) {
  return {
    visibles: { ...p.visibles },
    auto_imagen_url: p.autoImagen,
    auto_x: p.autoX,
    auto_y: p.autoY,
    auto_tam: p.autoTam,
    turbo_pos: p.turboPos,
  };
}

const ANCHO_ESCENARIO = 420;

/**
 * Dónde va cada velocidad. Si no tiene posición propia, queda en la fila
 * centrada en el grupo (turbo_x / turbo_y), como hasta ahora.
 */
export function posTurbo(
  p: Planilla,
  ancla: { x: number; y: number },
  tamanos: { x1: number; x2: number; x3: number },
): Record<'x1' | 'x2' | 'x3', { x: number; y: number }> {
  const claves = ['x1', 'x2', 'x3'] as const;
  const gap = 4;
  const anchos = claves.map((k) => Math.max(18, tamanos[k] || 28));
  const total = anchos.reduce((s, a) => s + a, 0) + gap * (claves.length - 1);
  let cursor = (ancla.x / 100) * ANCHO_ESCENARIO - total / 2;
  const out = {} as Record<'x1' | 'x2' | 'x3', { x: number; y: number }>;
  claves.forEach((k, i) => {
    const cx = cursor + anchos[i] / 2;
    const guardado = p.turboPos[k];
    out[k] = guardado ?? {
      x: Math.round(Math.max(0, Math.min(100, (cx / ANCHO_ESCENARIO) * 100))),
      y: Math.round(Math.max(0, Math.min(100, ancla.y))),
    };
    cursor += anchos[i] + gap;
  });
  return out;
}

/** Si hay X e Y guardados, el botón va ahí. Si no, queda a la izquierda del ancla. */
export function posAuto(
  p: Planilla,
  ancla: { x: number; y: number; tam: number },
): { x: number; y: number; offsetPx: number } {
  if (p.autoX != null && p.autoY != null) return { x: p.autoX, y: p.autoY, offsetPx: 0 };
  return { x: ancla.x, y: ancla.y, offsetPx: -(ancla.tam / 2 + 44) };
}

/** Lo que muestran los sliders antes de que alguien fije la posición. */
export function autoVisible(
  p: Planilla,
  ancla: { x: number; y: number; tam: number },
  anchoEscenario = 420,
): { x: number; y: number } {
  if (p.autoX != null && p.autoY != null) return { x: p.autoX, y: p.autoY };
  const x = ancla.x + ((-(ancla.tam / 2 + 44)) / anchoEscenario) * 100;
  return {
    x: Math.round(Math.max(0, Math.min(100, x))),
    y: Math.round(Math.max(0, Math.min(100, ancla.y))),
  };
}
