import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import {
  colocarMinas, minasValidas, multiplicador, puedeRetirar, TOTAL_CASILLAS,
} from '../motor/mines-clasico.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Endpoint único de Mines. El cliente manda `accion`:
//   'iniciar'  → arranca una partida (debita)
//   'revelar'  → destapa una casilla
//   'retirar'  → el jugador se baja (acredita si ganó)
//
// (Antes eran api/mines-iniciar|revelar|retirar. Se juntaron para
// dejar lugar bajo el límite de 12 Serverless Functions de Vercel.)

// El token de Win777 identifica al jugador pero es un dato sensible de
// sesión: se guarda su hash, que alcanza para reconocer "es el mismo
// jugador" y para el índice único que impide dos partidas a la vez.
function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Lo que ve el cliente de una ronda EN CURSO nunca incluye
// posiciones_mina.
function formatearRonda(ronda) {
  return {
    roundId: ronda.id,
    minas: ronda.minas,
    reveladas: ronda.reveladas,
    estado: ronda.estado,
    multiplicador: Number(ronda.multiplicador_actual),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const accion = (req.body || {}).accion;
  try {
    if (accion === 'iniciar') return await iniciar(req, res);
    if (accion === 'revelar') return await revelar(req, res);
    if (accion === 'retirar') return await retirar(req, res);
    return res.status(400).json({ error: 'Acción de mines desconocida' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error en la partida de mines' });
  }
}

async function iniciar(req, res) {
  const { token, slug, apuesta, minas } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });
  if (!minasValidas(Number(minas))) {
    return res.status(400).json({ error: `La cantidad de minas debe ser entre 1 y ${TOTAL_CASILLAS - 1}` });
  }

  const jugadorId = idJugador(token);

  const { data: juego } = await supabaseAdmin.from('juegos').select('*')
    .eq('slug', slug).eq('estado', 'listo').maybeSingle();
  if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

  // Partida en curso: se devuelve ESA en vez de arrancar otra.
  const { data: enCurso } = await supabaseAdmin.from('mines_rondas').select('*')
    .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
  if (enCurso) return res.status(200).json({ ...formatearRonda(enCurso), yaExistia: true });

  const monto = Number(apuesta);
  if (!monto || monto <= 0) return res.status(400).json({ error: 'Apuesta inválida' });
  if (monto < Number(juego.min_bet) || monto > Number(juego.max_bet)) {
    return res.status(400).json({ error: `La apuesta debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
  }

  // roundId propio: es el id de la fila Y el roundId que Win777 usa
  // para relacionar débito y crédito. Mismo valor en las dos puntas.
  const roundId = crypto.randomUUID();
  const posicionesMina = colocarMinas(Number(minas));

  // ORDEN: primero se reserva la fila (el índice único la protege de
  // carreras), RECIÉN DESPUÉS se cobra.
  const { data: ronda, error: errorInsert } = await supabaseAdmin.from('mines_rondas').insert({
    id: roundId, juego_id: juego.id, jugador_id: jugadorId,
    apuesta: monto, minas: Number(minas),
    posiciones_mina: posicionesMina, reveladas: [],
  }).select().single();

  if (errorInsert) {
    if (errorInsert.code === '23505') {
      const { data: enCurso2 } = await supabaseAdmin.from('mines_rondas').select('*')
        .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
      if (enCurso2) return res.status(200).json({ ...formatearRonda(enCurso2), yaExistia: true });
    }
    throw new Error(errorInsert.message);
  }

  let trasApostar;
  try {
    trasApostar = await apostar(token, roundId, monto);
  } catch (err) {
    await supabaseAdmin.from('mines_rondas').delete().eq('id', roundId);
    throw err;
  }

  return res.status(200).json({ ...formatearRonda(ronda), saldo: Number(trasApostar.balance), yaExistia: false });
}

async function revelar(req, res) {
  const { token, slug, roundId, casilla } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });
  const idx = Number(casilla);
  if (!Number.isInteger(idx) || idx < 0 || idx >= TOTAL_CASILLAS) {
    return res.status(400).json({ error: 'Casilla inválida' });
  }

  const jugadorId = idJugador(token);

  const [{ data: juego }, { data: ronda }] = await Promise.all([
    supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
    supabaseAdmin.from('mines_rondas').select('*').eq('id', roundId).maybeSingle(),
  ]);
  if (!juego || !ronda) return res.status(404).json({ error: 'Partida no encontrada' });
  if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
    return res.status(403).json({ error: 'Esa partida no te pertenece' });
  }
  if (ronda.estado !== 'en_curso') {
    return res.status(400).json({ error: 'Esta partida ya terminó' });
  }

  const reveladas = ronda.reveladas || [];
  if (reveladas.includes(idx)) {
    return res.status(400).json({ error: 'Esa casilla ya está destapada' });
  }
  if (reveladas.length >= TOTAL_CASILLAS - ronda.minas) {
    return res.status(400).json({ error: 'Ya destapaste todas las casillas seguras — retirá para cobrar.' });
  }

  const esMina = ronda.posiciones_mina.includes(idx);

  if (esMina) {
    const { data: filas, error } = await supabaseAdmin.from('mines_rondas').update({
      estado: 'perdida', reveladas: [...reveladas, idx], ganancia_final: 0,
      version: ronda.version + 1, updated_at: new Date().toISOString(),
    }).eq('id', ronda.id).eq('version', ronda.version).select();
    if (error) throw new Error(error.message);
    if (!filas?.length) {
      return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — volvé a consultar el estado antes de reintentar.' });
    }
    return res.status(200).json({
      esMina: true, casilla: idx, estado: 'perdida', posicionesMina: ronda.posiciones_mina,
    });
  }

  const nuevasReveladas = [...reveladas, idx];
  const aciertos = nuevasReveladas.length;
  const mult = multiplicador(ronda.minas, aciertos, Number(juego.mines_margen_pct));
  const retiroHabilitado = puedeRetirar(ronda.minas, aciertos);
  const tableroCompleto = aciertos >= TOTAL_CASILLAS - ronda.minas;

  const { data: filas, error } = await supabaseAdmin.from('mines_rondas').update({
    reveladas: nuevasReveladas, multiplicador_actual: mult,
    version: ronda.version + 1, updated_at: new Date().toISOString(),
  }).eq('id', ronda.id).eq('version', ronda.version).select();
  if (error) throw new Error(error.message);
  if (!filas?.length) {
    return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — volvé a consultar el estado antes de reintentar.' });
  }

  return res.status(200).json({
    esMina: false, casilla: idx, estado: 'en_curso',
    multiplicador: mult, puedeRetirar: retiroHabilitado, tableroCompleto,
  });
}

async function retirar(req, res) {
  const { token, slug, roundId } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  const jugadorId = idJugador(token);

  const [{ data: juego }, { data: ronda }] = await Promise.all([
    supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
    supabaseAdmin.from('mines_rondas').select('*').eq('id', roundId).maybeSingle(),
  ]);
  if (!juego || !ronda) return res.status(404).json({ error: 'Partida no encontrada' });
  if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
    return res.status(403).json({ error: 'Esa partida no te pertenece' });
  }

  if (ronda.estado === 'retirada') {
    return res.status(200).json({
      ganancia: Number(ronda.ganancia_final), multiplicador: Number(ronda.multiplicador_actual), repetido: true,
    });
  }
  if (ronda.estado !== 'en_curso') {
    return res.status(400).json({ error: 'Esta partida ya terminó y no se puede retirar' });
  }

  const aciertos = (ronda.reveladas || []).length;
  if (!puedeRetirar(ronda.minas, aciertos)) {
    return res.status(400).json({ error: 'Todavía no se puede retirar — falta llegar al próximo punto de retiro.' });
  }

  const mult = multiplicador(ronda.minas, aciertos, Number(juego.mines_margen_pct));
  const ganancia = Number((Number(ronda.apuesta) * mult).toFixed(2));

  const { data: filasReclamadas, error: errorReclamo } = await supabaseAdmin.from('mines_rondas')
    .update({ estado: 'retirada', ganancia_final: ganancia, multiplicador_actual: mult, version: ronda.version + 1, updated_at: new Date().toISOString() })
    .eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
  if (errorReclamo) throw new Error(errorReclamo.message);

  if (!filasReclamadas?.length) {
    const { data: actual } = await supabaseAdmin.from('mines_rondas').select('*').eq('id', roundId).maybeSingle();
    if (actual?.estado === 'retirada') {
      return res.status(200).json({
        ganancia: Number(actual.ganancia_final), multiplicador: Number(actual.multiplicador_actual), repetido: true,
      });
    }
    return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — no se procesó el retiro.' });
  }

  let saldoFinal = null;
  if (ganancia > 0) {
    const trasPremiar = await premiar(token, roundId, ganancia);
    saldoFinal = Number(trasPremiar.balance);
    if (!Number.isFinite(saldoFinal)) {
      throw new Error('Win777 no devolvió un saldo válido después del retiro');
    }
  }

  return res.status(200).json({
    ganancia, multiplicador: mult, saldo: saldoFinal,
    posicionesMina: ronda.posiciones_mina, repetido: false,
  });
}
