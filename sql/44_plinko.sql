-- =========================================================
-- PLINKO — la bolita cae entre clavos a una cubeta.
--
-- Motor de una sola tirada: lo resuelve api/plinko-tirar.js con
-- volados justos y devuelve el camino de la bolita. La idempotencia
-- reusa `rondas_jugadas` (client_id por tirada, resultado en `grilla`)
-- igual que la ruleta de botones — no hace falta tabla nueva.
--
-- Toda la config (rtp, filas y riesgo permitidos, tema, imágenes,
-- colores, controles) vive en este jsonb.
-- =========================================================

alter table juegos
  add column if not exists plinko_cfg jsonb not null default '{}'::jsonb;
