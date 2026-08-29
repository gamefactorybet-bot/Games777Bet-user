// =========================================================
// MOTOR "ruleta" — rueda de multiplicadores, partida en tajadas
// IGUALES (estilo "pizza"). Es un juego de UN giro, como los slots:
// lo resuelve api/jugar-girar.js con plata real, y también lo corren
// la vista previa y el simulador del ensamblador.
//
// Reutiliza la tabla `simbolos`: cada fila es un multiplicador —
//   nombre    = etiqueta que se dibuja en la tajada (×2, ×0, …)
//   peso      = cantidad de tajadas IGUALES que ocupa en la rueda
//   pago_tres = el multiplicador que paga (0 = pierde la apuesta)
//   color     = color de la tajada
//
// La probabilidad de cada multiplicador = sus tajadas / el total.
// Este archivo no se generaliza ni se toca para otros motores.
// =========================================================

import { construirRueda } from './ruleta-reparto.js';

export { construirRueda };

export const COLUMNAS = 1;
export const FILAS = 1;
export const FILA_PAGO = 0;

const multDe = (s) => Number(s.pago_tres) || 0;
const cantDe = (s) => Math.max(0, Math.round(Number(s.peso) || 0));

// Pick ponderado por `peso` — no lo usa el giro de la ruleta (que
// elige una tajada uniforme), pero lo pide la forma de MotorModulo.
export function elegirSimbolo(simbolos, total) {
  let r = Math.random() * (total || 1);
  for (const s of simbolos) {
    r -= cantDe(s);
    if (r <= 0) return s;
  }
  return simbolos[simbolos.length - 1];
}

export function girar(simbolos) {
  const slots = construirRueda(simbolos);
  if (!slots.length) {
    throw new Error('La ruleta no tiene tajadas configuradas (todos los pesos en 0).');
  }

  // Como todas las tajadas son iguales, el resultado es una tajada
  // uniforme al azar. El cliente solo la muestra girando hasta ahí.
  const destino = Math.floor(Math.random() * slots.length);
  const ganador = slots[destino];

  const premio = multDe(ganador);
  const premioMayor = Math.max(0, ...simbolos.map(multDe));
  const nivel = premio <= 0 ? null : premio >= premioMayor ? 'premio_mayor' : 'tres_iguales';

  const dibujo = slots.map((s) => ({
    et: s.nombre || ('×' + multDe(s)),
    mult: multDe(s),
    color: s.color || null,
  }));

  return {
    grilla: { tipo: 'ruleta', slots: dibujo, ganadora: destino },
    premio,
    nivel,
    filaPago: 0,
    simbolosGanadores: [],
  };
}
