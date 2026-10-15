/** Nombre de este deploy. Cada proveedor lo define en VITE_PROVEEDOR_NOMBRE. */
export function nombreProveedor(): string {
  const v = String(import.meta.env.VITE_PROVEEDOR_NOMBRE || '').trim();
  return v || 'gameswin777';
}
