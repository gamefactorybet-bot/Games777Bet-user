import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { cfgConDefaults, tirar } from '../motor/plinko.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Resuelve una tirada de Plinko con plata real. El navegador manda la
// apuesta, las filas y el riesgo elegidos, y un clientId (uno por
// tirada). Acá se debita, se sortea a qué cubeta cae (volados justos)
// y si hay premio se acredita. El resultado y el camino de la bolita
// los decide el servidor; el navegador solo anima.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuesta, filas, riesgo, clientId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    if (!clientId) return res.status(400).json({ error: 'Falta clientId' });

    const [{ data: juego }, { data: existente }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle(),
      supabaseAdmin.from('rondas_jugadas').select('*').eq('client_id', clientId).maybeSingle(),
    ]);
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });
    if (!String(juego.motor || '').startsWith('plinko')) {
      return res.status(400).json({ error: 'Este juego no es un Plinko' });
    }

    // Reintento de la misma tirada: se devuelve lo ya resuelto sin
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

    const cfg = cfgConDefaults(juego.plinko_cfg);

    // Primero se cobra (Win777 es idempotente por roundId = clientId).
    const trasApostar = await apostar(token, clientId, monto);

    const r = tirar(juego.plinko_cfg, filas, riesgo);
    const ganancia = Number((monto * (Number(r.mult) || 0)).toFixed(2));
    const resultado = { k: r.k, path: r.path, mult: r.mult, filas: r.filas, riesgo: r.riesgo, tabla: r.tabla };

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
      nivel_premio: null, grilla: resultado, saldo_despues: saldoFinal, simbolos_ganadores: [],
    }).then(({ error }) => { if (error) console.error('No se pudo registrar la tirada:', error.message); });

    return res.status(200).json({ resultado, premio: ganancia, saldo: saldoFinal, repetido: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al resolver la tirada' });
  }
}
