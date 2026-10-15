import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Identidad de este deploy. Un mismo código sirve a varios proveedores:
// cada proyecto pone su nombre en VITE_PROVEEDOR_NOMBRE.
// Vite lo mete en la pantalla al construir. La API de Vercel no ve
// .env.production en process.env, así que el catálogo lo lee del archivo.
// Si el nombre no está en ningún lado, se mantiene gameswin777 para no
// cambiar el deploy que ya está en producción.

function valorEnArchivo(archivo, clave) {
  if (!existsSync(archivo)) return '';
  for (const linea of readFileSync(archivo, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte === -1) continue;
    if (limpia.slice(0, corte).trim() !== clave) continue;
    return limpia.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

function nombreDesdeArchivo() {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const raices = [process.cwd(), resolve(aqui, '../..')];
  const archivos = ['.env.production', '.env'];
  const claves = ['VITE_PROVEEDOR_NOMBRE', 'PROVEEDOR_NOMBRE'];
  for (const raiz of raices) {
    for (const archivo of archivos) {
      for (const clave of claves) {
        const valor = valorEnArchivo(resolve(raiz, archivo), clave).trim();
        if (valor) return valor;
      }
    }
  }
  return '';
}

export function nombreProveedor(env = process.env) {
  const v = String(env.VITE_PROVEEDOR_NOMBRE || env.PROVEEDOR_NOMBRE || '').trim();
  return v || nombreDesdeArchivo() || 'gameswin777';
}

// PROVEEDOR_* es el nombre actual. WIN777_* sigue valiendo en los
// deploys que ya lo tenían cargado.
export function credencialesPanel(env = process.env) {
  const secreto = String(env.PROVEEDOR_SECRETO || env.WIN777_PROVEEDOR_SECRETO || '').trim();
  const base = String(env.PROVEEDOR_API_BASE || env.WIN777_API_BASE || '').trim();
  return { secreto, base };
}
