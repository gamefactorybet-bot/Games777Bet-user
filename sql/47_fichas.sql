-- =========================================================
-- 47 — FICHAS DE APUESTA RÁPIDA (compartidas por todos los motores)
--
-- Botones redondos para fijar la apuesta de una, en vez de los −/+.
-- Cada ficha: valor, imagen redonda (con su tamaño), tamaño del botón
-- y posición. Config en jsonb, una sola columna para cualquier juego.
-- Vacío = el juego usa sus controles de siempre.
-- =========================================================

alter table juegos
  add column if not exists fichas_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.fichas_cfg is
  'Fichas de apuesta rápida: { fichas: [{ valor, imagen_url, x, y, tam, imgTam }] }. Ver motor/fichas.js';
