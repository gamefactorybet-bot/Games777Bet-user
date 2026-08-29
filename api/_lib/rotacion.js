import { supabaseAdmin } from './supabaseAdmin.js';

// Rotación automática de perfiles de RTP. Es GLOBAL (nunca mira al
// jugador, solo el reloj del servidor) y "lazy": se llama en cada
// giro y solo hace algo cuando el tramo actual venció.

function esNoche(hora, desde, hasta) {
  const h = ((hora % 24) + 24) % 24;
  return desde > hasta ? (h >= desde || h < hasta) : (h >= desde && h < hasta);
}

function pickPonderado(entradas) {
  const total = entradas.reduce((a, [, p]) => a + Math.max(0, p), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [id, p] of entradas) {
    r -= Math.max(0, p);
    if (r <= 0) return id;
  }
  return entradas[entradas.length - 1][0];
}

/**
 * Si el juego tiene rotación activa y el tramo actual venció, sortea
 * el próximo perfil según los pesos de la franja horaria y lo activa.
 * Se llama ANTES de leer el perfil activo en cada giro. Si algo falla
 * no rompe el giro: se queda el perfil que estaba.
 *
 * @param {string} juegoId
 */
export async function aplicarRotacion(juegoId) {
  try {
    const { data: cfg } = await supabaseAdmin
      .from('rotacion_rtp').select('*').eq('juego_id', juegoId).maybeSingle();
    if (!cfg?.activa) return;

    const { data: estado } = await supabaseAdmin
      .from('rotacion_estado').select('*').eq('juego_id', juegoId).maybeSingle();

    const ahora = new Date();
    if (estado && new Date(estado.hasta_ts) > ahora) return; // tramo vigente

    const { data: perfiles } = await supabaseAdmin
      .from('perfiles_rtp').select('id, nombre').eq('juego_id', juegoId);
    if (!perfiles?.length) return;
    const ids = new Set(perfiles.map((p) => p.id));

    const noche = esNoche(ahora.getHours(), cfg.noche_desde, cfg.noche_hasta);
    const pesos = (noche ? cfg.pesos_noche : cfg.pesos_dia) || {};
    let entradas = Object.entries(pesos)
      .filter(([id, p]) => ids.has(id) && Number(p) > 0)
      .map(([id, p]) => [id, Number(p)]);
    if (!entradas.length) entradas = perfiles.map((p) => [p.id, 1]); // sin config: parejo

    const elegido = pickPonderado(entradas);
    if (!elegido) return;

    const min = Math.max(1, cfg.segmento_min || 20);
    const max = Math.max(min, cfg.segmento_max || 90);
    const dur = Math.round(min + Math.random() * (max - min));
    const hasta = new Date(ahora.getTime() + dur * 60000);

    // Cerrar el tramo anterior en el historial y abrir el nuevo.
    await supabaseAdmin.from('rotacion_historial')
      .update({ hasta_ts: ahora.toISOString() })
      .eq('juego_id', juegoId).is('hasta_ts', null);

    await supabaseAdmin.from('rotacion_historial').insert({
      juego_id: juegoId, perfil_id: elegido,
      perfil_nombre: perfiles.find((p) => p.id === elegido)?.nombre || null,
      desde_ts: ahora.toISOString(), hasta_ts: null,
    });

    await supabaseAdmin.from('rotacion_estado').upsert({
      juego_id: juegoId, perfil_id: elegido, hasta_ts: hasta.toISOString(),
    });

    // Activar el perfil elegido (y desactivar los demás) en un solo
    // UPDATE atómico.
    await supabaseAdmin.rpc('rotar_perfil', { p_juego_id: juegoId, p_perfil_id: elegido });
  } catch (err) {
    console.error('[rotacion]', err?.message || err);
  }
}
