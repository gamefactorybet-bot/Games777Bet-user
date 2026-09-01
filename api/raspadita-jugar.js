import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { jugar } from '../motor/raspadita.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Resuelve una tarjeta de raspadita con plata real. El navegador manda
// la apuesta y un clientId (uno por tarjeta). Acá se debita, se sortea
// el premio y cómo queda la grilla, y si hay premio se acredita. El
// navegador solo anima el raspado sobre la grilla que le manda el
// servidor.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuesta, clientId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    if (!clientId) return res.status(400).json({ error: 'Falta clientId' });

    const [{ data: juego }, { data: existente }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle(),
      supabaseAdmin.from('rondas_jugadas').select('*').eq('client_id', clientId).maybeSingle(),
    ]);
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });
    if (!String(juego.motor || '').startsWith('raspadita')) {
      return res.status(400).json({ error: 'Este juego no es una raspadita' });
    }

    // Reintento de la misma tarjeta: se devuelve lo ya resuelto sin
    // volver a tocar el saldo.
    if (existente) {
      return res.status(200).json({
        resultado: existente.grilla,
        premio: Number(existente.premio),
        saldo: Number(existente.saldo_despues),
        repetido: true,
      });
    }

    const monto = Number(apuesta);
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Apuesta inválida' });
    if (monto < Number(juego.min_bet) || monto > Number(juego.max_bet)) {
      return res.status(400).json({ error: `La apuesta debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
    }

    // Primero se cobra (Win777 es idempotente por roundId = clientId).
    const trasApostar = await apostar(token, clientId, monto);

    const r = jugar(juego.raspa_cfg);
    const ganancia = Number((monto * (Number(r.mult) || 0)).toFixed(2));
    const resultado = {
      grilla: r.grilla, ganadoras: r.ganadoras, mult: r.mult,
      simboloGanador: r.simboloGanador, cantidad: r.cantidad,
    };

    let saldoFinal;
    if (ganancia > 0) {
      saldoFinal = Number((await premiar(token, clientId, ganancia)).balance);
      if (!Number.isFinite(saldoFinal)) throw new Error('Win777 no devolvió un saldo válido después del premio');
    } else {
      saldoFinal = Number(trasApostar.balance);
    }

    // Idempotencia local, best-effort.
    supabaseAdmin.from('rondas_jugadas').insert({
      juego_id: juego.id, client_id: clientId, apuesta: monto, premio: ganancia,
      nivel_premio: null, grilla: resultado, saldo_despues: saldoFinal, simbolos_ganadores: r.ganadoras,
    }).then(({ error }) => { if (error) console.error('No se pudo registrar la tarjeta:', error.message); });

    return res.status(200).json({ resultado, premio: ganancia, saldo: saldoFinal, repetido: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al resolver la tarjeta' });
  }
}
