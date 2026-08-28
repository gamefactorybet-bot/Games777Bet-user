-- =========================================================
-- PERFILES DE RTP ("modos de pago") por juego.
--
-- Hasta ahora un juego tenía una sola tabla de pagos (la tabla
-- `simbolos`). Con perfiles, `simbolos` pasa a ser el BORRADOR que se
-- edita en el ensamblador, y cada perfil es una foto guardada de los
-- pagos y pesos: "Tacaño" ~88%, "Nivelado" ~94%, "Generoso" ~97%.
--
-- El juego tiene UN perfil activo. `api/jugar-girar.js` lee ese perfil
-- y pisa los pagos de los símbolos antes de resolver el giro. Si no
-- hay perfil activo, usa `simbolos` tal cual (los juegos que ya
-- existen siguen funcionando igual).
--
-- El auto-switch por horario o por RTP real queda para más adelante;
-- por ahora se activa a mano desde el editor.
-- =========================================================

create table if not exists perfiles_rtp (
  id           uuid primary key default gen_random_uuid(),
  juego_id     uuid not null references juegos(id) on delete cascade,

  nombre       text not null,
  -- El RTP al que se calibró — informativo, para mostrarlo en la lista
  -- sin recalcular. El número real sale de recorrer `pagos`.
  rtp_objetivo numeric(6,2),

  -- Foto de la tabla de pagos, indexada por id de símbolo:
  --   { "<simbolo_id>": { "peso": 5, "pago_dos": 1, "pago_tres": 10,
  --                       "pago_cuatro": 25, "pago_cinco": 60 } }
  -- Un símbolo agregado DESPUÉS de crear el perfil no está acá: el
  -- servidor cae en su valor base para ese símbolo.
  pagos        jsonb not null default '{}'::jsonb,

  activo       boolean not null default false,
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_perfiles_rtp_juego on perfiles_rtp (juego_id, orden);

-- Como mucho un perfil activo por juego. Índice parcial: solo las
-- filas con activo=true entran, así puede haber muchas inactivas.
create unique index if not exists uniq_perfil_activo_por_juego
  on perfiles_rtp (juego_id) where activo;

alter table perfiles_rtp enable row level security;

-- Herramienta de un solo usuario, igual que el resto: con sesión, todo.
drop policy if exists "con sesion, todo" on perfiles_rtp;
create policy "con sesion, todo" on perfiles_rtp for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------
-- Activar un perfil (y desactivar los demás del mismo juego) en un
-- solo UPDATE atómico — así el índice parcial nunca ve dos activos a
-- la vez, cosa que pasaría si se hicieran dos updates separados.
-- ---------------------------------------------------------
create or replace function activar_perfil(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_juego uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;

  select juego_id into v_juego from perfiles_rtp where id = p_perfil_id;
  if v_juego is null then
    raise exception 'Perfil no encontrado';
  end if;

  update perfiles_rtp
     set activo = (id = p_perfil_id)
   where juego_id = v_juego;
end;
$$;

-- ---------------------------------------------------------
-- duplicar_juego: sumar la copia de los perfiles de RTP. Mismo
-- criterio que las otras tablas hijas (jsonb_populate_recordset, se
-- copia todo menos id y juego_id). La copia entra con activo=false:
-- un borrador nuevo no arranca con un perfil en vivo sin que alguien
-- lo revise, igual que no arranca publicado.
-- ---------------------------------------------------------
create or replace function duplicar_juego(p_juego_id uuid, p_nombre text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo_id uuid := gen_random_uuid();
  v_datos    jsonb;
begin
  if exists (select 1 from juegos where slug = p_slug) then
    raise exception 'Ya existe un juego con el slug "%"', p_slug;
  end if;

  select to_jsonb(j) into v_datos from juegos j where j.id = p_juego_id;

  if v_datos is null then
    raise exception 'No se encontró el juego a duplicar';
  end if;

  v_datos := v_datos
    || jsonb_build_object(
         'id', v_nuevo_id,
         'nombre', p_nombre,
         'slug', p_slug,
         'estado', 'borrador',
         'publicado', false,
         'version', 1,
         'created_at', now(),
         'updated_at', now()
       );

  insert into juegos select * from jsonb_populate_record(null::juegos, v_datos);

  insert into simbolos
  select * from jsonb_populate_recordset(null::simbolos, (
    select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from simbolos s where s.juego_id = p_juego_id
  ));

  insert into sonidos
  select * from jsonb_populate_recordset(null::sonidos, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from sonidos x where x.juego_id = p_juego_id
  ));

  insert into efectos
  select * from jsonb_populate_recordset(null::efectos, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from efectos x where x.juego_id = p_juego_id
  ));

  insert into premios_visuales
  select * from jsonb_populate_recordset(null::premios_visuales, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from premios_visuales x where x.juego_id = p_juego_id
  ));

  insert into digitos
  select * from jsonb_populate_recordset(null::digitos, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from digitos x where x.juego_id = p_juego_id
  ));

  insert into capas_libres
  select * from jsonb_populate_recordset(null::capas_libres, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from capas_libres x where x.juego_id = p_juego_id
  ));

  insert into botones
  select * from jsonb_populate_recordset(null::botones, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from botones x where x.juego_id = p_juego_id
  ));

  -- Perfiles de RTP: se copian, pero ninguno queda activo en la copia.
  insert into perfiles_rtp
  select * from jsonb_populate_recordset(null::perfiles_rtp, (
    select coalesce(jsonb_agg(
      to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id, 'activo', false)
    ), '[]'::jsonb)
    from perfiles_rtp x where x.juego_id = p_juego_id
  ));

  return v_nuevo_id;
end;
$$;
