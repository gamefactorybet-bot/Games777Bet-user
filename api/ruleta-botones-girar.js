import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { girarBotones, cfgConDefaults, totalApostado } from '../motor/ruleta-botones.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Resuelve un giro de la ruleta de botones con plata real. La apuesta
// es estructurada: { [indiceNumero]: montoApostadoAhí }. El navegador
// manda eso y un clientId (uno por giro); acá se debita el total en
// Win777, se resuelve el giro (incluida la sorpresa) y si hay premio
// se acredita. El navegador nunca decide el resultado.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuestas, clientId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    if (!clientId) return res.status(400).json({ error: 'Falta clientId' });
    if (!apuestas || typeof apuestas !== 'object') return res.status(400).json({ error: 'Apuestas inválidas' });

    const [{ data: juego }, { data: existente }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle(),
      supabaseAdmin.from('rondas_jugadas').select('*').eq('client_id', clientId).maybeSingle(),
    ]);
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });
    if (juego.motor !== 'ruleta-botones') return res.status(400).json({ error: 'Este juego no es una ruleta de botones' });

    // Reintento del mismo giro: se devuelve lo ya resuelto sin volver
    // a tocar el saldo.
    if (existente) {
      return res.status(200).json({
        resultado: existente.grilla,
        premio: Number(existente.premio),
        saldo: Number(existente.saldo_despues),
        repetido: true,
      });
    }

    const cfg = cfgConDefaults(juego.ruleta_botones_cfg);

    // Normalizar: solo índices válidos y montos positivos.
    const limpias = {};
    for (const [k, v] of Object.entries(apuestas)) {
      const i = Number(k);
      const m = Number(v);
      if (Number.isInteger(i) && i >= 0 && i < cfg.numeros.length && m > 0) limpias[i] = m;
    }
    const total = Number(totalApostado(limpias).toFixed(2));
    if (total <= 0) return res.status(400).json({ error: 'Poné al menos una ficha en un número' });
    if (total < Number(juego.min_bet) || total > Number(juego.max_bet)) {
      return res.status(400).json({ error: `La apuesta total debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
    }

    // Primero se cobra (Win777 es idempotente por roundId = clientId).
    const trasApostar = await apostar(token, clientId, total);

    const r = girarBotones(juego.ruleta_botones_cfg, limpias);
    const ganancia = Number(Number(r.premio || 0).toFixed(2));

    let saldoFinal;
    if (ganancia > 0) {
      saldoFinal = Number((await premiar(token, clientId, ganancia)).balance);
      if (!Number.isFinite(saldoFinal)) {
        throw new Error('Win777 no devolvió un saldo válido después del premio');
      }
    } else {
      saldoFinal = Number(trasApostar.balance);
    }

    // Guardado best-effort para la idempotencia local (no se espera).
    supabaseAdmin.from('rondas_jugadas').insert({
      juego_id: juego.id, client_id: clientId, apuesta: total, premio: ganancia,
      nivel_premio: null, grilla: r, saldo_despues: saldoFinal, simbolos_ganadores: [],
    }).then(({ error }) => { if (error) console.error('No se pudo registrar la ronda:', error.message); });

    return res.status(200).json({ resultado: r, premio: ganancia, saldo: saldoFinal, repetido: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al resolver el giro' });
  }
}
