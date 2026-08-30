-- =========================================================
-- CRASH — rondas.
--
-- Cada jugador tiene su propia ronda con su propio punto de reventón
-- (`punto_crash`), que NUNCA sale al cliente mientras la ronda está
-- en curso: el servidor valida el retiro contra el reloj.
--
-- Misma idea que `mines_rondas`: una sola ronda viva por jugador y
-- juego (índice único parcial), `roundId` propio compartido entre el
-- débito y el crédito, reclamo condicional por `version`.
-- =========================================================

-- Toda la config del Crash (rtp, velocidad, formato, tema, imágenes,
-- colores, controles) vive en este jsonb. El motor solo mira rtp,
-- velocidad y tope; el resto es cosmético.
alter table juegos
  add column if not exists crash_cfg jsonb not null default '{}'::jsonb;

create table if not exists crash_rondas (
  id             uuid primary key,
  juego_id       uuid not null references juegos(id) on delete cascade,
  jugador_id     text not null,                       -- sha256(token)
  apuesta        numeric not null,
  punto_crash    numeric not null,
  inicio_ts      timestamptz not null default now(),
  estado         text not null default 'en_curso',    -- en_curso | retirada | reventada
  mult_retiro    numeric,                             -- al multiplicador que retiró
  ganancia_final numeric,
  version        int not null default 0,
  updated_at     timestamptz not null default now()
);

-- Una sola ronda viva por jugador y juego.
create unique index if not exists crash_una_viva
  on crash_rondas (juego_id, jugador_id) where estado = 'en_curso';

-- Para la tira de "últimos reventones" del historial.
create index if not exists crash_rondas_juego
  on crash_rondas (juego_id, inicio_ts desc);
