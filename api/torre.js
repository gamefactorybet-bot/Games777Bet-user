import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { cfgConDefaults, forma, multPiso, tablaMultiplicadores, sortearTrampas } from '../motor/torre.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Endpoint único de Torre. El cliente manda `accion`:
//   'iniciar'  → arranca una partida (debita)
//   'subir'    → elige una casilla del piso actual
//   'retirar'  → el jugador se baja (acredita si ganó)
//
// El servidor guarda dónde están las trampas de cada piso y no las
// manda al navegador hasta que el jugador pierde o retira.

function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const accion = (req.body || {}).accion;
  try {
    if (accion === 'iniciar') return await iniciar(req, res);
    if (accion === 'subir') return await subir(req, res);
    if (accion === 'retirar') return await retirar(req, res);
    return res.status(400).json({ error: 'Acción de torre desconocida' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error en la partida de torre' });
  }
}

function estadoEnCurso(ronda, cfg) {
  const f = forma(cfg);
  return {
    roundId: ronda.id,
    piso: ronda.piso_actual,
    pisos: cfg.pisos,
    cols: f.cols,
    trampas: f.trampas,
    multiplicador: Number(ronda.mult_actual),
    escalera: tablaMultiplicadores(cfg),
    picks: ronda.picks || [],
    estado: ronda.estado,
  };
}

async function iniciar(req, res) {
  const { token, slug, apuesta } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  const jugadorId = idJugador(token);

  const { data: juego } = await supabaseAdmin.from('juegos').select('*')
    .eq('slug', slug).eq('estado', 'listo').maybeSingle();
  if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

  const cfg = cfgConDefaults(juego.torre_cfg);

  const { data: enCurso } = await supabaseAdmin.from('torre_rondas').select('*')
    .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
  if (enCurso) return res.status(200).json({ ...estadoEnCurso(enCurso, cfg), yaExistia: true });

  const monto = Number(apuesta);
  if (!monto || monto <= 0) return res.status(400).json({ error: 'Apuesta inválida' });
  if (monto < Number(juego.min_bet) || monto > Number(juego.max_bet)) {
    return res.status(400).json({ error: `La apuesta debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
  }

  const roundId = crypto.randomUUID();
  const trampas = sortearTrampas(cfg);

  // ORDEN: primero se reserva la fila (el índice único la protege de
  // carreras), RECIÉN DESPUÉS se cobra.
  const { data: ronda, error: errIns } = await supabaseAdmin.from('torre_rondas').insert({
    id: roundId, juego_id: juego.id, jugador_id: jugadorId,
    apuesta: monto, trampas, piso_actual: 1, mult_actual: 1, picks: [],
  }).select().single();

  if (errIns) {
    if (errIns.code === '23505') {
      const { data: enCurso2 } = await supabaseAdmin.from('torre_rondas').select('*')
        .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
      if (enCurso2) return res.status(200).json({ ...estadoEnCurso(enCurso2, cfg), yaExistia: true });
    }
    throw new Error(errIns.message);
  }

  let trasApostar;
  try {
    trasApostar = await apostar(token, roundId, monto);
  } catch (err) {
    await supabaseAdmin.from('torre_rondas').delete().eq('id', roundId);
    throw err;
  }

  return res.status(200).json({ ...estadoEnCurso(ronda, cfg), saldo: Number(trasApostar.balance), yaExistia: false });
}

async function subir(req, res) {
  const { token, slug, roundId, piso, casilla } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  const jugadorId = idJugador(token);
  const [{ data: juego }, { data: ronda }] = await Promise.all([
    supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
    supabaseAdmin.from('torre_rondas').select('*').eq('id', roundId).maybeSingle(),
  ]);
  if (!juego || !ronda) return res.status(404).json({ error: 'Partida no encontrada' });
  if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
    return res.status(403).json({ error: 'Esa partida no te pertenece' });
  }
  if (ronda.estado !== 'en_curso') return res.status(400).json({ error: 'Esta partida ya terminó' });

  const cfg = cfgConDefaults(juego.torre_cfg);
  const f = forma(cfg);

  const p = Number(piso);
  const c = Number(casilla);
  if (p !== ronda.piso_actual) {
    return res.status(409).json({ error: 'Ese no es el piso actual — recargá el estado de la partida.' });
  }
  if (!Number.isInteger(c) || c < 0 || c >= f.cols) {
    return res.status(400).json({ error: 'Casilla inválida' });
  }

  const trampasPiso = ronda.trampas[p - 1] || [];
  const esTrampa = trampasPiso.includes(c);
  const nuevosPicks = [...(ronda.picks || []), { piso: p, casilla: c }];

  if (esTrampa) {
    const { data: filas, error } = await supabaseAdmin.from('torre_rondas').update({
      estado: 'perdida', ganancia_final: 0, picks: nuevosPicks,
      version: ronda.version + 1, updated_at: new Date().toISOString(),
    }).eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
    if (error) throw new Error(error.message);
    if (!filas?.length) return res.status(409).json({ error: 'Otra operación ya actualizó esta partida.' });

    return res.status(200).json({
      trampa: true, piso: p, casilla: c, estado: 'perdida', trampasReveladas: ronda.trampas,
    });
  }

  // Segura: subió un piso.
  const nuevoPiso = p + 1;
  const llegoArriba = nuevoPiso > cfg.pisos;
  const multBanco = multPiso(cfg, p);

  if (llegoArriba) {
    const ganancia = Number((Number(ronda.apuesta) * multBanco).toFixed(2));
    const { data: filas, error } = await supabaseAdmin.from('torre_rondas').update({
      estado: 'retirada', mult_actual: multBanco, ganancia_final: ganancia, picks: nuevosPicks,
      version: ronda.version + 1, updated_at: new Date().toISOString(),
    }).eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
    if (error) throw new Error(error.message);
    if (!filas?.length) return res.status(409).json({ error: 'Otra operación ya actualizó esta partida.' });

    let saldo = null;
    if (ganancia > 0) {
      const trasPremiar = await premiar(token, roundId, ganancia);
      saldo = Number(trasPremiar.balance);
      if (!Number.isFinite(saldo)) throw new Error('El proveedor no devolvió un saldo válido tras el retiro');
    }
    return res.status(200).json({
      trampa: false, piso: nuevoPiso, casilla: c, top: true,
      multiplicador: multBanco, ganancia, saldo, trampasReveladas: ronda.trampas, estado: 'retirada',
    });
  }

  const { data: filas, error } = await supabaseAdmin.from('torre_rondas').update({
    piso_actual: nuevoPiso, mult_actual: multBanco, picks: nuevosPicks,
    version: ronda.version + 1, updated_at: new Date().toISOString(),
  }).eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
  if (error) throw new Error(error.message);
  if (!filas?.length) return res.status(409).json({ error: 'Otra operación ya actualizó esta partida.' });

  return res.status(200).json({
    trampa: false, piso: nuevoPiso, casilla: c, top: false,
    multiplicador: multBanco, estado: 'en_curso',
  });
}

async function retirar(req, res) {
  const { token, slug, roundId } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  const jugadorId = idJugador(token);
  const [{ data: juego }, { data: ronda }] = await Promise.all([
    supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
    supabaseAdmin.from('torre_rondas').select('*').eq('id', roundId).maybeSingle(),
  ]);
  if (!juego || !ronda) return res.status(404).json({ error: 'Partida no encontrada' });
  if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
    return res.status(403).json({ error: 'Esa partida no te pertenece' });
  }

  if (ronda.estado === 'retirada') {
    return res.status(200).json({
      ganancia: Number(ronda.ganancia_final), multiplicador: Number(ronda.mult_actual),
      trampasReveladas: ronda.trampas, repetido: true,
    });
  }
  if (ronda.estado !== 'en_curso') {
    return res.status(400).json({ error: 'Esta partida ya terminó y no se puede retirar' });
  }
  if (ronda.piso_actual <= 1) {
    return res.status(400).json({ error: 'Subí al menos un piso antes de retirar.' });
  }

  const cfg = cfgConDefaults(juego.torre_cfg);
  const k = ronda.piso_actual - 1;
  const mult = multPiso(cfg, k);
  const ganancia = Number((Number(ronda.apuesta) * mult).toFixed(2));

  const { data: filas, error } = await supabaseAdmin.from('torre_rondas')
    .update({ estado: 'retirada', mult_actual: mult, ganancia_final: ganancia, version: ronda.version + 1, updated_at: new Date().toISOString() })
    .eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
  if (error) throw new Error(error.message);

  if (!filas?.length) {
    const { data: actual } = await supabaseAdmin.from('torre_rondas').select('*').eq('id', roundId).maybeSingle();
    if (actual?.estado === 'retirada') {
      return res.status(200).json({
        ganancia: Number(actual.ganancia_final), multiplicador: Number(actual.mult_actual),
        trampasReveladas: actual.trampas, repetido: true,
      });
    }
    return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — no se procesó el retiro.' });
  }

  let saldo = null;
  if (ganancia > 0) {
    const trasPremiar = await premiar(token, roundId, ganancia);
    saldo = Number(trasPremiar.balance);
    if (!Number.isFinite(saldo)) throw new Error('Win777 no devolvió un saldo válido después del retiro');
  }

  return res.status(200).json({
    ganancia, multiplicador: mult, saldo, trampasReveladas: ronda.trampas, repetido: false,
  });
}
