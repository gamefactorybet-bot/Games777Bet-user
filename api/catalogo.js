import { supabaseAdmin, errorAdmin } from './_lib/supabaseAdmin.js';
import { origenJugar } from './_lib/dominio.js';
import { nombreProveedor } from './_lib/marca.js';

// Catálogo público, en el formato que espera "Sincronizar catálogo"
// del panel del casino: { proveedor, juegos: [...] }. El nombre sale
// de VITE_PROVEEDOR_NOMBRE, así cada deploy se anuncia con la suya.
// Solo trae juegos listo + publicado — un juego "listo" pero sin
// publicar todavía no debe salir acá.
//
// Sin autenticación: el panel no manda ningún secreto al leer esta
// URL (es un simple fetch). No viaja nada sensible — nombres,
// imágenes, límites de apuesta, la URL pública del juego.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { data: juegos, error } = await supabaseAdmin
    .from('juegos')
    .select('slug, nombre, descripcion, portada_url, min_bet, max_bet, version')
    .eq('estado', 'listo')
    .eq('publicado', true);

  if (error) return res.status(500).json({ error: errorAdmin(error) });

  const hostPedido = req.headers['x-forwarded-host'] || req.headers.host;
  const origen = origenJugar(hostPedido);

  const nombre = nombreProveedor();

  return res.status(200).json({
    proveedor: nombre,
    juegos: (juegos || []).map((j) => ({
      slug: j.slug,
      nombre: j.nombre,
      descripcion: j.descripcion || undefined,
      imagen_url: j.portada_url || undefined,
      motor: nombre,
      version: j.version,
      min_bet: Number(j.min_bet),
      max_bet: Number(j.max_bet),
      launch_url: `${origen}/jugar?slug=${encodeURIComponent(j.slug)}`,
    })),
  });
}
