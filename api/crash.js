import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { cfgConDefaults, sortearReventon, tiempoHasta, resolverRetiro } from '../motor/crash.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Endpoint único del Crash. El cliente manda `accion`:
//   'iniciar'  → arranca una ronda (debita)
//   'retirar'  → el jugador se baja (acredita si ganó)
//   'cerrar'   → la ronda llegó al tope/tiempo sin retiro (se liquida perdida)
//
// (Antes eran api/crash-iniciar|retirar|cerrar. Se juntaron para no
// pasar el límite de 12 Serverless Functions del plan de Vercel.)

// El token identifica al jugador pero no se guarda: se guarda su hash,
// que alcanza para reconocer "es el mismo jugador" y para el índice
// único que impide dos rondas en curso a la vez (jugador + juego).
function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Lo que ve el cliente de una ronda EN CURSO nunca incluye punto_crash.
function formatearRonda(ronda, servidorTs) {
  return {
    roundId: ronda.id,
    inicioTs: new Date(ronda.inicio_ts).getTime(),
    servidorTs,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const accion = (req.body || {}).accion;
  try {
    if (accion === 'iniciar') return await iniciar(req, res);
    if (accion === 'retirar') return await retirar(req, res);
    if (accion === 'cerrar') return await cerrar(req, res);
    return res.status(400).json({ error: 'Acción de crash desconocida' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error en la ronda de crash' });
  }
}

async function iniciar(req, res) {
  const { token, slug, apuesta } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  const jugadorId = idJugador(token);

  const { data: juego } = await supabaseAdmin.from('juegos').select('*')
    .eq('slug', slug).eq('estado', 'listo').maybeSingle();
  if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

  const cfg = cfgConDefaults(juego.crash_cfg);

  // Ronda en curso: si ya venció su tope, se liquida reventada antes de
  // dejar arrancar otra. Si sigue viva, se devuelve ESA.
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

  const roundId = crypto.randomUUID();
  const puntoCrash = sortearReventon(cfg);

  // ORDEN: primero se reserva la fila, RECIÉN DESPUÉS se cobra.
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

  // Recién ACÁ se cobra. Si falla, se borra la fila para no dejar una
  // ronda fantasma bloqueando.
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
}

async function retirar(req, res) {
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

  // Reintento de una ronda ya cerrada.
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

  // Se "reclama" el cierre ANTES de pagar, con escritura condicional a
  // la versión leída.
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
}

async function cerrar(req, res) {
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
}
