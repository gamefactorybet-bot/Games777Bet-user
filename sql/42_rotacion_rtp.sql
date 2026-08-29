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
