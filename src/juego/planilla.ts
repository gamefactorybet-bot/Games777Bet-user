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
  return { visibles, autoImagen: typeof auto === 'string' && auto ? auto : null };
}

export function planillaJson(p: Planilla) {
  return { visibles: { ...p.visibles }, auto_imagen_url: p.autoImagen };
}
