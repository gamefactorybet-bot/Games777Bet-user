-- =========================================================
-- RULETA DE MULTIPLICADORES ("pizza").
--
-- Motor nuevo `ruleta`: rueda partida en tajadas IGUALES. Reutiliza
-- la tabla `simbolos` — cada fila es un multiplicador:
--   nombre    = etiqueta de la tajada (×2, ×0, …)
--   peso      = cantidad de tajadas iguales que ocupa en la rueda
--   pago_tres = el multiplicador que paga (0 = pierde la apuesta)
--   color     = color de la tajada (nuevo)
--
-- La probabilidad de cada multiplicador = sus tajadas / el total.
-- Es un juego de un giro: lo resuelve api/jugar-girar.js igual que
-- los slots, y el calibrador de RTP + los perfiles ("modos de pago")
-- funcionan igual.
-- =========================================================

alter table simbolos add column if not exists color text;
