import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { cfgConDefaults, sortearReventon, tiempoHasta } from '../motor/crash.js';
import { apostar } from './_lib/proveedorCliente.js';

// El token identifica al jugador pero no se guarda: se guarda su hash,
// que alcanza para reconocer "es el mismo jugador" y para el índice
// único que impide dos rondas en curso a la vez (jugador + juego).
function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Lo que ve el cliente de una ronda EN CURSO nunca incluye
// punto_crash. Solo el arranque y el reloj del servidor.
function formatearRonda(ronda, servidorTs) {
  return {
    roundId: ronda.id,
    inicioTs: new Date(ronda.inicio_ts).getTime(),
    servidorTs,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuesta } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });

    const jugadorId = idJugador(token);

    const { data: juego } = await supabaseAdmin.from('juegos').select('*')
      .eq('slug', slug).eq('estado', 'listo').maybeSingle();
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

    const cfg = cfgConDefaults(juego.crash_cfg);

    // Ronda en curso: si ya pasó el tiempo hasta su tope (más un
    // margen), el jugador no retiró a tiempo — se liquida como
    // reventada antes de dejar arrancar otra. Si todavía está viva,
    // se devuelve ESA.
    const { data: enCurso } = await supabaseAdmin.from('crash_rondas').select('*')
      .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
    if (enCurso) {
      const vencida = Date.now() - new Date(enCurso.inicio_ts).getTime()
        > tiempoHasta(cfg.tope, cfg) + 3000;
      if (vencida) {
        await supabaseAdmin.from('crash_rondas')
          .update({ estado: 'reventada', ganancia_final: 0, version: enCurso.version + 1, updated_at: new Date().toISOString() })
          .eq('id', enCurso.id).eq('estado', 'en_curso');
      } else {
        return res.status(200).json({ ...formatearRonda(enCurso, Date.now()), yaExistia: true });
      }
    }

    const monto = Number(apuesta);
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Apuesta inválida' });
    if (monto < Number(juego.min_bet) || monto > Number(juego.max_bet)) {
      return res.status(400).json({ error: `La apuesta debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
    }

    // roundId propio: es el id de la fila y el roundId que el
    // proveedor relaciona entre este débito y el crédito de cuando se
    // retire — tiene que ser el mismo en las dos puntas.
    const roundId = crypto.randomUUID();
    const puntoCrash = sortearReventon(cfg);

    // ORDEN: primero se reserva la fila, RECIÉN DESPUÉS se cobra. El
    // índice único (una ronda en_curso por jugador y juego) hace que
    // si dos "iniciar" llegan juntos, solo uno inserte — el otro
    // falla acá, antes de cobrar nada.
    const { data: ronda, error: errorInsert } = await supabaseAdmin.from('crash_rondas').insert({
      id: roundId, juego_id: juego.id, jugador_id: jugadorId,
      apuesta: monto, punto_crash: puntoCrash,
    }).select().single();

    if (errorInsert) {
      if (errorInsert.code === '23505') {
        const { data: enCurso2 } = await supabaseAdmin.from('crash_rondas').select('*')
          .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
        if (enCurso2) return res.status(200).json({ ...formatearRonda(enCurso2, Date.now()), yaExistia: true });
      }
      throw new Error(errorInsert.message);
    }

    // Recién ACÁ se cobra, con la ronda ya reservada. Si falla, se
    // borra la fila para no dejar una ronda fantasma bloqueando.
    let trasApostar;
    try {
      trasApostar = await apostar(token, roundId, monto);
    } catch (err) {
      await supabaseAdmin.from('crash_rondas').delete().eq('id', roundId);
      throw err;
    }

    return res.status(200).json({
      ...formatearRonda(ronda, Date.now()),
      saldo: Number(trasApostar.balance),
      yaExistia: false,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo iniciar la ronda' });
  }
}
