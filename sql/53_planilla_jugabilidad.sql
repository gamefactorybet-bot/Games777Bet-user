-- Qué botones muestra el juego y, si Auto tiene imagen propia, cuál.
-- Vacío = se ve todo, como hasta ahora. Apagar uno no toca el RTP.
alter table juegos
  add column if not exists planilla jsonb not null default '{}'::jsonb;
