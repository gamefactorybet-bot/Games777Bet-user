-- =========================================================
-- 46 — MOTORES INSTANTÁNEOS: LIMBO + DICE
--
-- Juegos "de una tirada": el servidor tira un número y listo, sin
-- multi-paso ni animación pesada. Los dos comparten el endpoint
-- api/jugar-instant.js (despacha por juego.motor).
--
-- RTP exacto de una sola perilla:
--   Limbo: X = rtp / random(); ganás si X >= objetivo; pago = objetivo.
--   Dice:  roll 0-100; pago = rtp / probabilidad.
--
-- Igual que crash/plinko/raspadita, toda la config vive en jsonb.
-- No usan la tabla `simbolos`.
-- =========================================================

alter table juegos
  add column if not exists limbo_cfg jsonb not null default '{}'::jsonb;

alter table juegos
  add column if not exists dice_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.limbo_cfg is
  'Config del motor limbo: { rtp, tope, objetivoDefecto, tema, fondoUrl }. Ver motor/limbo.js';
comment on column juegos.dice_cfg is
  'Config del motor dice: { rtp, chanceMin, chanceMax, umbralDefecto, direccionDefecto, tema, fondoUrl }. Ver motor/dice.js';
