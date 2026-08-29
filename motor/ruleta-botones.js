// =========================================================
// MOTOR "ruleta-botones" — rueda de la fortuna con 9 (o N)
// multiplicadores fijos, uno por botón. El jugador elige el valor de
// la ficha, predice qué número va a salir y apila fichas en ese botón.
// Si la rueda cae ahí, cada ficha se paga × su multiplicador.
//
// En cada giro puede aparecer un MULTIPLICADOR SORPRESA sobre un
// número al azar: si la rueda cae en ese número y el jugador le puso
// fichas, el premio se multiplica también por la sorpresa. Es la
// palanca que levanta el RTP (que de base es bajo con multiplicadores
// grandes) y le da emoción a cada jugada.
//
// A diferencia de los slots NO pasa por api/jugar-girar: la apuesta
// es estructurada (fichas por número), así que tiene su propio
// endpoint api/ruleta-botones-girar.js. Este archivo es matemática
// pura, sin estado ni DB — igual que mines-clasico.js.
// =========================================================

import { construirRueda } from './ruleta-reparto.js';

const cantDe = (n) => Math.max(0, Math.round(Number(n.cant) || 0));
const multDe = (n) => Math.max(0, Number(n.mult) || 0);

export const CFG_DEFAULT = {
  numeros: [
    { mult: 1,  cant: 22, color: '#3a3f4a', et: '×1' },
    { mult: 2,  cant: 11, color: '#4a6b8a', et: '×2' },
    { mult: 5,  cant: 7,  color: '#5bbf88', et: '×5' },
    { mult: 8,  cant: 5,  color: '#3fb6c4', et: '×8' },
    { mult: 15, cant: 3,  color: '#6b8afd', et: '×15' },
    { mult: 20, cant: 2,  color: '#9b7ff0', et: '×20' },
    { mult: 25, cant: 1,  color: '#d9a441', et: '×25' },
    { mult: 30, cant: 1,  color: '#e5686b', et: '×30' },
    { mult: 40, cant: 1,  color: '#c77dff', et: '×40' },
  ],
  fichas: [100, 500, 1000, 5000],
  sorpresa: {
    frecuencia: 0.35,
    pool: [
      { mult: 5,   peso: 52 },
      { mult: 10,  peso: 30 },
      { mult: 25,  peso: 12 },
      { mult: 50,  peso: 4.5 },
      { mult: 100, peso: 1.2 },
      { mult: 250, peso: 0.25 },
      { mult: 300, peso: 0.05 },
    ],
    tope: 0, // 0 = sin tope de premio por jugada
  },
};

/** Une la config guardada (jsonb del juego) con los valores por
 * defecto. Lo que falte cae en el default. */
export function cfgConDefaults(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const s = c.sorpresa && typeof c.sorpresa === 'object' ? c.sorpresa : {};
  return {
    numeros: Array.isArray(c.numeros) && c.numeros.length ? c.numeros : CFG_DEFAULT.numeros,
    fichas: Array.isArray(c.fichas) && c.fichas.length ? c.fichas.map(Number) : CFG_DEFAULT.fichas,
    sorpresa: {
      frecuencia: Number.isFinite(Number(s.frecuencia)) ? Number(s.frecuencia) : CFG_DEFAULT.sorpresa.frecuencia,
      pool: Array.isArray(s.pool) && s.pool.length ? s.pool : CFG_DEFAULT.sorpresa.pool,
      tope: Math.max(0, Number(s.tope) || 0),
    },
  };
}

const sorpPesoTotal = (pool) => pool.reduce((a, p) => a + Math.max(0, Number(p.peso) || 0), 0) || 1;

/** Multiplicador sorpresa esperado E[S] del pool. */
export function sorpresaEsperada(pool) {
  const t = sorpPesoTotal(pool);
  return pool.reduce((a, p) => a + (Math.max(0, Number(p.peso) || 0) / t) * (Number(p.mult) || 0), 0);
}

/** RTP de un número i = probabilidad × multiplicador (sin sorpresa). */
export function rtpNumero(numeros, i) {
  const total = numeros.reduce((a, n) => a + cantDe(n), 0) || 1;
  return (cantDe(numeros[i]) / total) * multDe(numeros[i]);
}

/** Factor por el que la sorpresa multiplica el RTP: aparece con
 * frecuencia f y cae en 1 de N números (uniforme). */
export function factorSorpresa(numeros, sorpresa) {
  const n = numeros.length || 1;
  const es = sorpresaEsperada(sorpresa.pool);
  return 1 + Math.max(0, sorpresa.frecuencia) * (1 / n) * (es - 1);
}

/** RTP promedio (apostando parejo a todos los botones), en %. */
export function rtpPromedio(cfg) {
  const c = cfgConDefaults(cfg);
  const base = c.numeros.reduce((a, _n, i) => a + rtpNumero(c.numeros, i), 0) / (c.numeros.length || 1);
  return base * factorSorpresa(c.numeros, c.sorpresa) * 100;
}

function pickPonderado(pool) {
  const t = sorpPesoTotal(pool);
  let r = Math.random() * t;
  for (const p of pool) {
    r -= Math.max(0, Number(p.peso) || 0);
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

/**
 * Resuelve un giro completo. `apuestas` = { [indiceNumero]: montoTotal }.
 * Devuelve el estado de la rueda para dibujar + el premio en plata.
 */
export function girarBotones(cfg, apuestas) {
  const c = cfgConDefaults(cfg);
  const numeros = c.numeros;

  // Se etiqueta cada número con su índice antes de repartir, porque
  // construirRueda devuelve copias (no las mismas referencias).
  const slots = construirRueda(numeros.map((n, i) => ({ ...n, peso: cantDe(n), _idx: i })));
  if (!slots.length) throw new Error('La ruleta no tiene tajadas configuradas.');

  const destinoSlot = Math.floor(Math.random() * slots.length);
  const ganadorSlot = slots[destinoSlot];
  const ganadorIdx = ganadorSlot._idx;
  const ganadorNum = numeros[ganadorIdx];

  const haySorpresa = Math.random() < Math.max(0, c.sorpresa.frecuencia);
  const sorpNum = haySorpresa ? Math.floor(Math.random() * numeros.length) : -1;
  const sorpMult = haySorpresa ? (Number(pickPonderado(c.sorpresa.pool).mult) || 1) : 1;

  const puesto = Math.max(0, Number((apuestas || {})[ganadorIdx]) || 0);
  const conSorpresa = haySorpresa && sorpNum === ganadorIdx && puesto > 0;

  let premio = puesto * multDe(ganadorNum) * (conSorpresa ? sorpMult : 1);
  if (c.sorpresa.tope > 0) premio = Math.min(premio, c.sorpresa.tope);
  premio = Number(premio.toFixed(2));

  return {
    // para dibujar / animar
    slots: slots.map((n) => ({ et: n.et || ('×' + multDe(n)), mult: multDe(n), color: n.color || null })),
    ganadora: destinoSlot,
    ganadorIdx,
    sorpresa: haySorpresa ? { num: sorpNum, mult: sorpMult } : null,
    conSorpresa,
    // resultado
    premio,
  };
}

/** Total apostado a partir de la estructura de apuestas. */
export function totalApostado(apuestas) {
  return Object.values(apuestas || {}).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0);
}
