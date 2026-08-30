import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// El cliente lo llama cuando su animación llegó al tope o al tiempo
// máximo sin que el jugador retire: se liquida la ronda como perdida
// y se revela el punto de reventón para animar la explosión.
function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, roundId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });

    const jugadorId = idJugador(token);
    const [{ data: juego }, { data: ronda }] = await Promise.all([
      supabaseAdmin.from('juegos').select('id').eq('slug', slug).maybeSingle(),
      supabaseAdmin.from('crash_rondas').select('*').eq('id', roundId).maybeSingle(),
    ]);
    if (!juego || !ronda) return res.status(404).json({ error: 'Ronda no encontrada' });
    if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
      return res.status(403).json({ error: 'Esa ronda no te pertenece' });
    }

    const respuesta = {
      multiplicador: Number(ronda.punto_crash),
      ganancia: 0,
      reventadoEn: Number(ronda.punto_crash),
      saldo: null,
    };

    if (ronda.estado !== 'en_curso') {
      return res.status(200).json({
        ...respuesta,
        ganancia: Number(ronda.ganancia_final ?? 0),
        multiplicador: Number(ronda.mult_retiro ?? ronda.punto_crash),
        repetido: true,
      });
    }

    await supabaseAdmin.from('crash_rondas')
      .update({ estado: 'reventada', ganancia_final: 0, version: ronda.version + 1, updated_at: new Date().toISOString() })
      .eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso');

    return res.status(200).json({ ...respuesta, repetido: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo cerrar la ronda' });
  }
}
