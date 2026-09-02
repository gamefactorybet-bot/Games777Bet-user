-- =========================================================
-- 49 — MOTOR TORRE
--
-- El jugador sube piso por piso eligiendo una casilla. Si pisa la
-- trampa pierde todo; si zafa, el multiplicador crece y puede
-- retirar cuando quiera. Es "Mines en vertical".
--
-- Multi-paso: como Mines, el servidor guarda dónde están las
-- trampas de cada piso entre un paso y el siguiente, sin decírselo
-- al navegador hasta que el jugador pierde o retira. Por eso hace
-- falta la tabla `torre_rondas`, además de la config en jsonb.
--
-- RTP exacto por piso: p = (casillas - trampas) / casillas, y
-- mult(k) = RTP / p^k. Retire donde retire, el retorno esperado es
-- el mismo. Ver motor/torre.js.
-- =========================================================

alter table juegos
  add column if not exists torre_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.torre_cfg is
  'Config del motor torre: { rtp, dificultad (facil|media|dificil|experto|maestro|custom), cols, trampas, pisos, tema, fondoUrl, imágenes de las casillas, animaciones, pagos:{ [piso]:mult }, controles }. Ver motor/torre.js';

create table if not exists torre_rondas (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  -- Hash del token de Win777 (mismo criterio que mines_rondas): no es
  -- una cuenta propia, identifica al jugador entre pedidos.
  jugador_id text not null,

  apuesta    numeric(12,2) not null check (apuesta > 0),

  -- trampas[piso] = [índices de casilla que son trampa]. NUNCA se
  -- devuelve al cliente mientras estado='en_curso'.
  trampas    jsonb not null,
  -- picks[i] = { piso, casilla } que eligió el jugador (para redibujar
  -- el camino si se reconecta).
  picks      jsonb not null default '[]',

  piso_actual int not null default 1 check (piso_actual >= 1),

  estado     text not null default 'en_curso'
             check (estado in ('en_curso', 'retirada', 'perdida')),
  mult_actual   numeric(12,4) not null default 1,
  ganancia_final numeric(12,2),

  version    integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_torre_rondas_juego on torre_rondas (juego_id, jugador_id);
-- Como mucho una partida en_curso por jugador y juego a la vez.
create unique index if not exists idx_torre_rondas_una_en_curso
  on torre_rondas (juego_id, jugador_id)
  where estado = 'en_curso';

alter table torre_rondas enable row level security;

drop policy if exists "con sesion, leer" on torre_rondas;
create policy "con sesion, leer" on torre_rondas for select
  using (auth.uid() is not null);
