-- =========================================================
-- 45 — MOTOR RASPADITA
--
-- Una tarjeta con celdas tapadas que el jugador raspa. Un solo motor
-- cubre muchos juegos: se elige la grilla (6/9/12) y, símbolo por
-- símbolo, sus escalones de premio (cantidad -> multiplicador ->
-- frecuencia). El RTP es exacto: RTP = Σ (multiplicador / cada).
--
-- Igual que Crash y Plinko, toda la config vive en una columna jsonb
-- de `juegos`. No usa la tabla `simbolos`.
-- =========================================================

alter table juegos
  add column if not exists raspa_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.raspa_cfg is
  'Config del motor raspadita: { celdas, simbolos[], tema, fondoUrl, cobertura, celda, animGanar_url, historial, controles }. Ver motor/raspadita.js';
