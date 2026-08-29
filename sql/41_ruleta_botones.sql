-- =========================================================
-- RULETA DE BOTONES (rueda de la fortuna con multiplicador sorpresa).
--
-- Motor nuevo `ruleta-botones`: 9 (o N) multiplicadores fijos, uno por
-- botón. El jugador apila fichas en el número que predice; si la rueda
-- cae ahí, cada ficha se paga × su multiplicador. En cada giro puede
-- salir un multiplicador sorpresa sobre un número al azar.
--
-- No usa la tabla `simbolos` ni api/jugar-girar (la apuesta es
-- estructurada: fichas por número). Toda la config vive en un jsonb:
--   {
--     "numeros":  [{ "mult":1, "cant":22, "color":"#3a3f4a", "et":"×1" }, …],
--     "fichas":   [100, 500, 1000, 5000],
--     "sorpresa": { "frecuencia":0.35,
--                   "pool":[{ "mult":5, "peso":52 }, …],
--                   "tope":0 }
--   }
--
-- Los giros se guardan en `rondas_jugadas` (idempotencia por
-- client_id), igual que los slots.
-- =========================================================

alter table juegos
  add column if not exists ruleta_botones_cfg jsonb not null default '{}'::jsonb;
