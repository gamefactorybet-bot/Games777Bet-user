-- ================================================
-- COMBINADO: sql/40 → sql/44 (ruletas + rotación RTP + crash + plinko)
-- Seguro de correr varias veces (todo es IF NOT EXISTS / OR REPLACE).
-- ================================================

-- ===================== sql/40_ruleta.sql =====================
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

-- ===================== sql/41_ruleta_botones.sql =====================
-- =========================================================
-- RULETA DE BOTONES (rueda de la fortuna con multiplicador sorpresa).
--
-- Motor nuevo `ruleta-botones`: 9 (o N) multiplicadores fijos, uno por
-- botón. El jugador apila fichas en el número que predice; si la rueda
-- cae ahí, cada ficha se paga × su multiplicador. En cada giro puede
-- salir un multiplicador sorpresa sobre un número al azar.
--
-- No usa la tabla `simbolos` ni api/jugar-girar (la apuesta es
-- estructurada: fichas por número). Toda la config vive en un jsonb:
--   {
--     "numeros":  [{ "mult":1, "cant":22, "color":"#3a3f4a", "et":"×1" }, …],
--     "fichas":   [100, 500, 1000, 5000],
--     "sorpresa": { "frecuencia":0.35,
--                   "pool":[{ "mult":5, "peso":52 }, …],
--                   "tope":0 }
--   }
--
-- Los giros se guardan en `rondas_jugadas` (idempotencia por
-- client_id), igual que los slots.
-- =========================================================

alter table juegos
  add column if not exists ruleta_botones_cfg jsonb not null default '{}'::jsonb;

-- ===================== sql/42_rotacion_rtp.sql =====================
-- =========================================================
-- ROTACIÓN AUTOMÁTICA DE PERFILES DE RTP.
--
-- Sobre los perfiles_rtp (los "modos de pago": Tacaño / Nivelado /
-- Generoso) que ya se activan a mano. Con la rotación, el servidor
-- los va cambiando solo en el tiempo: más modo generoso de noche,
-- menos de día, y con la duración de cada tramo al azar para que no
-- se aprenda el horario.
--
-- Es GLOBAL: nunca mira al jugador, solo el reloj. El RTP se mueve
-- dentro de la banda que definen los perfiles. Aplica a los juegos
-- que resuelve api/jugar-girar (slots y ruleta de multiplicadores).
--
-- Rotación "lazy": en cada giro, si el tramo actual venció, el
-- servidor sortea el próximo perfil según los pesos de la franja
-- horaria y lo activa. Cero cron.
-- =========================================================

create table if not exists rotacion_rtp (
  juego_id      uuid primary key references juegos(id) on delete cascade,
  activa        boolean not null default false,
  -- Franja "noche" en hora local del servidor (0-23). El resto es día.
  noche_desde   int not null default 22,
  noche_hasta   int not null default 8,
  -- Pesos por perfil, por franja: { "<perfil_id>": <peso> }.
  pesos_dia     jsonb not null default '{}'::jsonb,
  pesos_noche   jsonb not null default '{}'::jsonb,
  -- Duración de cada tramo, en minutos (se sortea entre min y max).
  segmento_min  int not null default 20,
  segmento_max  int not null default 90,
  actualizado   timestamptz not null default now()
);

create table if not exists rotacion_estado (
  juego_id   uuid primary key references juegos(id) on delete cascade,
  perfil_id  uuid references perfiles_rtp(id) on delete set null,
  hasta_ts   timestamptz not null
);

create table if not exists rotacion_historial (
  id            bigint generated always as identity primary key,
  juego_id      uuid not null references juegos(id) on delete cascade,
  perfil_id     uuid references perfiles_rtp(id) on delete set null,
  perfil_nombre text,
  desde_ts      timestamptz not null default now(),
  hasta_ts      timestamptz
);
create index if not exists idx_rotacion_hist_juego on rotacion_historial (juego_id, desde_ts desc);

alter table rotacion_rtp enable row level security;
alter table rotacion_estado enable row level security;
alter table rotacion_historial enable row level security;

drop policy if exists "con sesion, todo" on rotacion_rtp;
create policy "con sesion, todo" on rotacion_rtp for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on rotacion_estado;
create policy "con sesion, todo" on rotacion_estado for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on rotacion_historial;
create policy "con sesion, todo" on rotacion_historial for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Cambia el perfil activo del juego en un solo UPDATE atómico (así el
-- índice parcial uniq_perfil_activo_por_juego nunca ve dos activos).
-- Sin chequeo de sesión: lo llama el servidor (service role) en cada
-- rotación; el peor caso es que cambie qué modo de RTP está activo,
-- cosa que el operador ya controla.
create or replace function rotar_perfil(p_juego_id uuid, p_perfil_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update perfiles_rtp set activo = (id = p_perfil_id) where juego_id = p_juego_id;
$$;

-- ===================== sql/43_crash.sql =====================
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

-- ===================== sql/44_plinko.sql =====================
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
