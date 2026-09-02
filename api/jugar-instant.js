import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import * as limbo from '../motor/limbo.js';
import * as dice from '../motor/dice.js';
import * as keno from '../motor/keno.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Endpoint único de los juegos "de una tirada": Limbo y Dice (y
// cualquier otro que se sume más adelante). Despacha por juego.motor.
// El navegador manda la apuesta, la opción del jugador (objetivo /
// umbral) y un clientId (uno por jugada). Acá se debita, se resuelve
// y si hay premio se acredita — todo del lado del servidor.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuesta, clientId, objetivo, umbral, direccion, marcados } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    if (!clientId) return res.status(400).json({ error: 'Falta clientId' });

    const [{ data: juego }, { data: existente }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle(),
      supabaseAdmin.from('rondas_jugadas').select('*').eq('client_id', clientId).maybeSingle(),
    ]);
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

    const motor = String(juego.motor || '');
    const esLimbo = motor.startsWith('limbo');
    const esDice = motor.startsWith('dice');
    const esKeno = motor.startsWith('keno');
    if (!esLimbo && !esDice && !esKeno) {
      return res.status(400).json({ error: 'Este juego no es de una tirada' });
    }

    // Reintento de la misma jugada: se devuelve lo ya resuelto.
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

    // Keno: se valida la selección ANTES de cobrar (el motor tira si
    // está mal; Limbo y Dice recortan en vez de fallar).
    if (esKeno) {
      const cfgK = keno.cfgConDefaults(juego.keno_cfg);
      const sel = Array.isArray(marcados) ? marcados : [];
      const validos = new Set(sel.map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= cfgK.tablero));
      if (validos.size < 1 || validos.size > cfgK.maxMarcar) {
        return res.status(400).json({ error: `Marcá entre 1 y ${cfgK.maxMarcar} números.` });
      }
    }

    // Primero se cobra (Win777 es idempotente por roundId = clientId).
    const trasApostar = await apostar(token, clientId, monto);

    let r, resultado;
    if (esLimbo) {
      r = limbo.tirar(juego.limbo_cfg, objetivo);
      resultado = { tipo: 'limbo', resultado: r.resultado, objetivo: r.objetivo, gano: r.gano, mult: r.mult };
    } else if (esDice) {
      r = dice.tirar(juego.dice_cfg, umbral, direccion);
      resultado = { tipo: 'dice', roll: r.roll, umbral: r.umbral, direccion: r.direccion, gano: r.gano, mult: r.mult, prob: r.prob };
    } else {
      r = keno.tirar(juego.keno_cfg, marcados);
      resultado = { tipo: 'keno', sorteados: r.sorteados, marcados: r.marcados, aciertos: r.aciertos, gano: r.gano, mult: r.mult };
    }

    const ganancia = Number((monto * (Number(r.mult) || 0)).toFixed(2));

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
    }).then(({ error }) => { if (error) console.error('No se pudo registrar la jugada:', error.message); });

    return res.status(200).json({ resultado, premio: ganancia, saldo: saldoFinal, repetido: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al resolver la jugada' });
  }
}
