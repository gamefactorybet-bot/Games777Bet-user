-- =========================================================
-- 48 — MOTOR KENO
--
-- El jugador marca números en un tablero, la banca saca las bolas y
-- cobra según cuántas acierta. Juego "de una tirada": comparte el
-- endpoint api/jugar-instant.js con Limbo y Dice (despacha por
-- juego.motor). No usa la tabla `simbolos`.
--
-- RTP exacto: para cada cantidad de marcados P la probabilidad de
-- acertar h es hipergeométrica P(h) = C(P,h)·C(T-P,D-h)/C(T,D). El
-- motor arma los multiplicadores para clavar el RTP objetivo y se
-- pueden ajustar a mano (keno_cfg.pagos). Toda la config vive en jsonb.
-- =========================================================

alter table juegos
  add column if not exists keno_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.keno_cfg is
  'Config del motor keno: { rtp, tablero (25|40|80), bolas, maxMarcar, riesgo, tema, fondoUrl, pagos:{ [marcados]:{ [aciertos]:mult } } }. Ver motor/keno.js';
