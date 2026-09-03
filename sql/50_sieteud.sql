-- =========================================================
-- 50 — MOTOR 7 UP 7 DOWN
--
-- Dos dados, la suma cae en tres zonas: 7 ABAJO (2–6), LUCKY 7 (=7),
-- 7 ARRIBA (8–12). El jugador apuesta a una zona, se tira una vez y se
-- resuelve. Juego "de una tirada": comparte el endpoint
-- api/jugar-instant.js con Limbo, Dice y Keno (despacha por
-- juego.motor). No usa la tabla `simbolos`.
--
-- RTP exacto de una sola perilla, como Dice:
--   pago(zona) = rtp / P(zona)   →   EV = rtp para cualquier zona.
-- Los pagos se pueden fijar a mano (sieteud_cfg.pagos) y el editor
-- muestra el RTP real que queda. Toda la config vive en jsonb.
-- =========================================================

alter table juegos
  add column if not exists sieteud_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.sieteud_cfg is
  'Config del motor sieteud (7 Up 7 Down): { rtp, caras, pagos:{abajo,siete,arriba}, tema, fondoUrl, cartelUrl, controles }. Ver motor/sieteud.js';
