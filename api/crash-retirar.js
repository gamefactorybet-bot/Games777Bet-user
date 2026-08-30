import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { cfgConDefaults, resolverRetiro } from '../motor/crash.js';
import { premiar } from './_lib/proveedorCliente.js';

function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, roundId, objetivoAuto } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });

    const ahoraTs = Date.now();
    const jugadorId = idJugador(token);

    const [{ data: juego }, { data: ronda }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
      supabaseAdmin.from('crash_rondas').select('*').eq('id', roundId).maybeSingle(),
    ]);
    if (!juego || !ronda) return res.status(404).json({ error: 'Ronda no encontrada' });
    if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
      return res.status(403).json({ error: 'Esa ronda no te pertenece' });
    }

    // Reintento de una ronda ya cerrada (se cortó la conexión, etc.).
    if (ronda.estado !== 'en_curso') {
      return res.status(200).json({
        multiplicador: Number(ronda.mult_retiro ?? ronda.punto_crash),
        ganancia: Number(ronda.ganancia_final ?? 0),
        reventadoEn: Number(ronda.punto_crash),
        saldo: null,
        repetido: true,
      });
    }

    const cfg = cfgConDefaults(juego.crash_cfg);
    const inicioTs = new Date(ronda.inicio_ts).getTime();
    const { multiplicador, gano, premio, reventadoEn } = resolverRetiro({
      inicioTs, ahoraTs,
      puntoCrash: Number(ronda.punto_crash),
      apuesta: Number(ronda.apuesta),
      cfg, objetivoAuto,
    });

    const estado = gano ? 'retirada' : 'reventada';

    // Se "reclama" el cierre ANTES de pagar, con escritura condicional
    // a la versión leída: si dos pedidos llegan juntos calculan lo
    // mismo, pero solo uno pasa el `.eq('version', ...)` — el otro
    // sabe que llegó tarde sin haber intentado pagar de más.
    const { data: filas, error: errReclamo } = await supabaseAdmin.from('crash_rondas')
      .update({
        estado, mult_retiro: multiplicador, ganancia_final: premio,
        version: ronda.version + 1, updated_at: new Date().toISOString(),
      })
      .eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
    if (errReclamo) throw new Error(errReclamo.message);

    if (!filas?.length) {
      const { data: actual } = await supabaseAdmin.from('crash_rondas').select('*').eq('id', roundId).maybeSingle();
      return res.status(200).json({
        multiplicador: Number(actual?.mult_retiro ?? actual?.punto_crash ?? multiplicador),
        ganancia: Number(actual?.ganancia_final ?? 0),
        reventadoEn: Number(actual?.punto_crash ?? reventadoEn),
        saldo: null,
        repetido: true,
      });
    }

    let saldo = null;
    if (premio > 0) {
      const trasPremiar = await premiar(token, roundId, premio);
      saldo = Number(trasPremiar.balance);
      if (!Number.isFinite(saldo)) throw new Error('El proveedor no devolvió un saldo válido tras el retiro');
    }

    return res.status(200).json({ multiplicador, ganancia: premio, reventadoEn, saldo, repetido: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo retirar' });
  }
}
