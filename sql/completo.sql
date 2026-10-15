-- =========================================================
-- Esquema completo para una base nueva.
-- Pegá este archivo entero en el SQL Editor de Supabase
-- y ejecutalo una sola vez. Si ya lo corriste y falló en
-- animaciones_lottie, volvé a pegar esta versión y ejecutalo
-- de nuevo: ese paso ahora sigue de largo.
--
-- Junta las planillas de sql/ en orden de nombre.
-- No incluye _combinado_40_a_50.sql: eso repite el 40 al 50.
-- Incluye los dos juegos de ejemplo (frutas y rodillos de oro).
-- =========================================================

-- ========== 01_esquema.sql ==========
-- =========================================================
-- gameswin777 — infraestructura de juegos, separada de Win777
--
-- Acá NO vive ningún jugador ni ningún saldo. Eso queda en el
-- Supabase de Win777, siempre. Esta base solo guarda cómo está
-- armado cada juego mientras lo construís: símbolos, pagos,
-- efectos visuales y sonidos.
--
-- Cuando un juego está listo, se publica en el manifiesto y
-- cualquier panel (Win777 u otro operador) lo sincroniza — la
-- integración usa el mismo protocolo de proveedores que ya
-- armamos para Win777.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Juegos en desarrollo
-- ---------------------------------------------------------
create table if not exists juegos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  descripcion text,

  -- borrador   -> recién arrancado, no se puede probar todavía
  -- en_prueba  -> tiene símbolos y se puede jugar en la vista previa
  -- listo      -> calibrado, puede publicarse en el manifiesto
  estado      text not null default 'borrador'
                check (estado in ('borrador', 'en_prueba', 'listo')),

  motor       text not null default 'clasico-3x3',
  min_bet     numeric(14,2) not null default 1000,
  max_bet     numeric(14,2) not null default 100000,

  -- Fondo del rodillo: una sola imagen para todo el juego,
  -- se repite detrás de las nueve celdas de la grilla.
  fondo_url   text,

  -- Marco/carcasa de la máquina: la imagen fija del diseño.
  marco_url   text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Símbolos de cada juego
-- ---------------------------------------------------------
create table if not exists simbolos (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  nombre     text not null,
  icono_url  text,

  peso       int not null default 5 check (peso > 0),
  pago_tres  numeric(10,2) not null default 0 check (pago_tres >= 0),
  pago_dos   numeric(10,2) not null default 0 check (pago_dos >= 0),

  orden      int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_simbolos_juego on simbolos (juego_id, orden);

-- ---------------------------------------------------------
-- Efectos visuales (CSS) de cada juego
--
-- El código CSS se guarda tal cual se escribió — se valida recién
-- al aplicarlo en el juego, no acá. La posición es en porcentaje,
-- no en píxeles, para que se vea igual en cualquier pantalla.
-- ---------------------------------------------------------
create table if not exists efectos (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,

  nombre      text not null,

  -- carcasa -> decorativo, siempre visible (brillo del marco, luces)
  -- premio  -> dispara solo cuando hay premio
  tipo        text not null default 'carcasa' check (tipo in ('carcasa', 'premio')),

  -- Solo para tipo='premio': qué nivel de premio lo dispara
  nivel_premio text check (nivel_premio in ('dos_iguales', 'tres_iguales', 'premio_mayor')),

  -- Solo para tipo='premio': dónde aparece
  posicion    text default 'linea' check (posicion in ('linea', 'pantalla')),

  css         text not null,

  -- Solo para tipo='carcasa': dónde va sobre la máquina, en %
  pos_x       numeric(5,2),
  pos_y       numeric(5,2),
  tamano      numeric(5,2) default 45,

  duracion_ms int default 900,

  created_at  timestamptz not null default now()
);

create index if not exists idx_efectos_juego on efectos (juego_id, tipo);

-- ---------------------------------------------------------
-- Sonidos de cada juego
-- ---------------------------------------------------------
create table if not exists sonidos (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  -- musica_fondo | giro | premio_chico | premio_grande
  tipo       text not null check (tipo in ('musica_fondo', 'giro', 'premio_chico', 'premio_grande')),
  archivo_url text not null,

  created_at timestamptz not null default now(),
  unique (juego_id, tipo)
);

-- Al tocar cualquier pieza de un juego, marcamos cuándo se editó
-- por última vez — útil para ordenar "en qué estabas trabajando".
create or replace function tocar_juego()
returns trigger
language plpgsql
as $$
begin
  update juegos set updated_at = now() where id = coalesce(new.juego_id, old.juego_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_tocar_simbolos on simbolos;
create trigger trg_tocar_simbolos after insert or update or delete on simbolos
  for each row execute function tocar_juego();

drop trigger if exists trg_tocar_efectos on efectos;
create trigger trg_tocar_efectos after insert or update or delete on efectos
  for each row execute function tocar_juego();

drop trigger if exists trg_tocar_sonidos on sonidos;
create trigger trg_tocar_sonidos after insert or update or delete on sonidos
  for each row execute function tocar_juego();

-- ========== 02_seguridad.sql ==========
-- =========================================================
-- Seguridad: solo vos podés entrar, y solo con sesión podés
-- tocar algo. Es una herramienta de un solo usuario — no hace
-- falta el sistema de permisos de Win777 acá.
-- =========================================================

alter table juegos enable row level security;
alter table simbolos enable row level security;
alter table efectos enable row level security;
alter table sonidos enable row level security;

drop policy if exists "con sesion, todo" on juegos;
create policy "con sesion, todo" on juegos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on simbolos;
create policy "con sesion, todo" on simbolos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on efectos;
create policy "con sesion, todo" on efectos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on sonidos;
create policy "con sesion, todo" on sonidos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------
-- Bucket para íconos, fondos y sonidos
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

drop policy if exists "lectura publica de assets" on storage.objects;
create policy "lectura publica de assets"
  on storage.objects for select
  using (bucket_id = 'assets');

drop policy if exists "con sesion sube assets" on storage.objects;
create policy "con sesion sube assets"
  on storage.objects for insert
  with check (bucket_id = 'assets' and auth.uid() is not null);

drop policy if exists "con sesion actualiza assets" on storage.objects;
create policy "con sesion actualiza assets"
  on storage.objects for update
  using (bucket_id = 'assets' and auth.uid() is not null);

drop policy if exists "con sesion borra assets" on storage.objects;
create policy "con sesion borra assets"
  on storage.objects for delete
  using (bucket_id = 'assets' and auth.uid() is not null);

-- ========== 03_demo_frutas.sql ==========
-- =========================================================
-- Juego de demostración: "Frutas del 777"
-- Slot 3x3 clásico, tema frutas, con comodín (wild).
-- RTP calibrado a ~91% — volatilidad media-baja, para que el
-- jugador de prueba gane seguido y no se frustre.
--
-- Corré esto en el SQL Editor de gameswin777 DESPUÉS del
-- 01_esquema.sql. Es seguro correrlo más de una vez: borra el
-- juego anterior con el mismo slug antes de recrearlo.
-- =========================================================

-- Si ya existía una demo con este slug, la borramos (cascade se
-- lleva símbolos, efectos y sonidos de un tirón).
delete from juegos where slug = 'frutas-del-777';

-- El juego
with nuevo as (
  insert into juegos (slug, nombre, descripcion, estado, motor, min_bet, max_bet)
  values (
    'frutas-del-777',
    'Frutas del 777',
    'Clásico de frutas con comodín. Tres iguales en la línea del medio pagan; el comodín completa cualquier combinación.',
    'listo',
    'clasico-3x3',
    1000,
    50000
  )
  returning id
)
-- Símbolos (RTP ~90.7%). El orden es de más común a más raro.
insert into simbolos (juego_id, nombre, peso, pago_tres, pago_dos, orden)
select id, v.nombre, v.peso, v.tres, v.dos, v.orden
from nuevo, (values
  ('cereza',   25, 4,   1,  0),
  ('limon',    22, 6,   2,  1),
  ('naranja',  18, 9,   2,  2),
  ('sandia',   14, 18,  4,  3),
  ('uva',      10, 38,  6,  4),
  ('campana',  6,  76,  11, 5),
  ('estrella', 3,  190, 24, 6),
  ('wild',     2,  400, 48, 7)
) as v(nombre, peso, tres, dos, orden);

-- Efectos visuales (CSS). Tres de premio, uno de carcasa.
insert into efectos (juego_id, nombre, tipo, nivel_premio, posicion, css, duracion_ms)
select id, e.nombre, e.tipo, e.nivel, e.pos, e.css, e.dur
from juegos j, (values

  -- Carcasa: brillo dorado que respira siempre alrededor del marco
  ('Brillo del marco', 'carcasa', null, null,
   E'@keyframes brillo-marco {\n  0%,100% { box-shadow: inset 0 0 20px rgba(217,164,65,.15); }\n  50% { box-shadow: inset 0 0 35px rgba(217,164,65,.4); }\n}\n.efecto { position:absolute; inset:0; border-radius:20px; pointer-events:none; animation: brillo-marco 3s ease-in-out infinite; }',
   3000),

  -- Dos iguales: destello suave sobre la línea
  ('Destello chico', 'premio', 'dos_iguales', 'linea',
   E'@keyframes destello-chico {\n  0% { opacity:0; transform:scale(.9); }\n  40% { opacity:.7; transform:scale(1.05); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(107,138,253,.5), transparent 70%); animation: destello-chico 700ms ease-out; }',
   700),

  -- Tres iguales: brillo más fuerte sobre la línea
  ('Destello grande', 'premio', 'tres_iguales', 'linea',
   E'@keyframes destello-grande {\n  0% { opacity:0; transform:scale(.8); }\n  30% { opacity:1; transform:scale(1.15); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(91,191,136,.6), transparent 65%); animation: destello-grande 900ms ease-out; }',
   900),

  -- Premio mayor: destello dorado que cubre toda la pantalla
  ('Explosión mayor', 'premio', 'premio_mayor', 'pantalla',
   E'@keyframes explosion-mayor {\n  0% { opacity:0; transform:scale(.5); }\n  25% { opacity:1; transform:scale(1.1); }\n  60% { opacity:.8; transform:scale(1); }\n  100% { opacity:0; transform:scale(1.05); }\n}\n.efecto-premio { background: radial-gradient(circle, rgba(217,164,65,.7), rgba(217,164,65,.2) 50%, transparent 75%); animation: explosion-mayor 1300ms ease-out; }',
   1300)

) as e(nombre, tipo, nivel, pos, css, dur)
where j.slug = 'frutas-del-777';

-- Confirmación
select
  j.nombre,
  j.estado,
  (select count(*) from simbolos where juego_id = j.id) as simbolos,
  (select count(*) from efectos where juego_id = j.id) as efectos
from juegos j where j.slug = 'frutas-del-777';

-- ========== 04_marco_ajustable.sql ==========
-- =========================================================
-- Ajuste fino del marco: posición y tamaño independientes en
-- X e Y, para poder deformar la imagen (estirar/contraer) hasta
-- que calce exacto sobre la grilla, sin depender de que el
-- archivo original tenga las proporciones perfectas.
-- =========================================================

alter table juegos
  add column if not exists marco_x     numeric(6,2) not null default 50,   -- % horizontal, centrado por defecto
  add column if not exists marco_y     numeric(6,2) not null default 50,   -- % vertical, centrado por defecto
  add column if not exists marco_ancho numeric(6,2) not null default 100,  -- % de ancho del contenedor
  add column if not exists marco_alto  numeric(6,2) not null default 100;  -- % de alto del contenedor

-- ========== 05_clientes.sql ==========
-- =========================================================
-- Clientes: los casinos a los que les servís juegos (hoy Win777,
-- mañana otros). Guarda la URL de su panel y el secreto que te
-- dieron al crear el proveedor de ese lado — es la llave que
-- necesita el servidor del juego para firmar sus llamadas.
-- =========================================================

create table if not exists clientes_conectados (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  panel_url  text not null,   -- ej: https://win777bet-panel.vercel.app
  secreto    text not null,   -- el que te dio SU panel al crear el proveedor
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Qué juegos están conectados a qué cliente. Un mismo juego puede
-- servir a varios casinos sin duplicar nada.
create table if not exists juego_clientes (
  juego_id   uuid not null references juegos(id) on delete cascade,
  cliente_id uuid not null references clientes_conectados(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (juego_id, cliente_id)
);

alter table clientes_conectados enable row level security;
alter table juego_clientes enable row level security;

drop policy if exists "con sesion, todo" on clientes_conectados;
create policy "con sesion, todo" on clientes_conectados for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on juego_clientes;
create policy "con sesion, todo" on juego_clientes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ========== 06_grilla_ajustable.sql ==========
-- =========================================================
-- Posición y tamaño de la grilla, igual de ajustable que el
-- marco. Antes vivía fija en el medio, en el flujo normal del
-- documento — ahora se puede mover y achicar para dejar espacio
-- a otras cosas (una imagen arriba, por ejemplo).
--
-- A diferencia del marco (que se puede deformar a propósito), acá
-- un solo "tamaño" en vez de ancho/alto separados: las celdas
-- tienen que seguir siendo cuadradas, si no los íconos se ven
-- estirados feo.
-- =========================================================

alter table juegos
  add column if not exists grilla_x       numeric(6,2) not null default 50,
  add column if not exists grilla_y       numeric(6,2) not null default 46,
  add column if not exists grilla_tamano  numeric(6,2) not null default 70;

-- ========== 07_cartel.sql ==========
-- =========================================================
-- Cartel: una tercera capa de imagen, independiente del marco y
-- de la grilla. Pensada como un banner/cartel que puede ir sobre
-- el juego (con el nombre, una promo, lo que sea) — se posiciona
-- y deforma igual que el marco, sin depender de sus proporciones
-- exactas.
-- =========================================================

alter table juegos
  add column if not exists cartel_url   text,
  add column if not exists cartel_x     numeric(6,2) not null default 50,
  add column if not exists cartel_y     numeric(6,2) not null default 15,
  add column if not exists cartel_ancho numeric(6,2) not null default 75,
  add column if not exists cartel_alto  numeric(6,2) not null default 16;

-- ========== 08_portada.sql ==========
-- =========================================================
-- Portada: la miniatura de catálogo, distinta del cartel.
--
-- El cartel es una capa DENTRO del juego, posicionada donde
-- quieras mientras jugás. La portada es la carátula que representa
-- al juego en una lista — antes de entrar a jugar. Son conceptos
-- separados, aunque después uses la misma imagen para las dos cosas
-- si te sirve.
-- =========================================================

alter table juegos
  add column if not exists portada_url text;

-- ========== 09_capas.sql ==========
-- =========================================================
-- Cuarta capa: fondo de pantalla, separado del marco. El marco
-- es la carcasa de la máquina; esto es un telón libre, ajustable
-- igual que el marco (posición + ancho/alto deformable).
--
-- Además, orden de capas: qué va adelante y qué atrás, para las
-- cuatro imágenes juntas. Antes el orden estaba fijo en el código
-- (fondo, marco, grilla, cartel) — ahora se puede elegir.
-- =========================================================

alter table juegos
  add column if not exists fondo_pantalla_url   text,
  add column if not exists fondo_pantalla_x     numeric(6,2) not null default 50,
  add column if not exists fondo_pantalla_y     numeric(6,2) not null default 50,
  add column if not exists fondo_pantalla_ancho numeric(6,2) not null default 100,
  add column if not exists fondo_pantalla_alto  numeric(6,2) not null default 100;

-- Orden de atrás hacia adelante. El último de la lista queda arriba
-- de todos.
alter table juegos
  add column if not exists capas_orden text[] not null
    default array['fondo_pantalla','marco','grilla','cartel'];

-- ========== 10_blur_oscurecer.sql ==========
-- =========================================================
-- Nitidez (blur) y oscurecimiento, por capa. Se suman a los
-- controles de posición que ya existen — mismo patrón: número
-- guardado, aplicado como filtro CSS al renderizar.
-- =========================================================

alter table juegos
  add column if not exists fondo_pantalla_blur      numeric(5,2) not null default 0,
  add column if not exists fondo_pantalla_oscurecer  numeric(5,2) not null default 0,
  add column if not exists marco_blur                numeric(5,2) not null default 0,
  add column if not exists marco_oscurecer            numeric(5,2) not null default 0,
  add column if not exists cartel_blur                numeric(5,2) not null default 0,
  add column if not exists cartel_oscurecer           numeric(5,2) not null default 0,
  add column if not exists fondo_blur                 numeric(5,2) not null default 0,
  add column if not exists fondo_oscurecer            numeric(5,2) not null default 0;

-- ========== 11_premio_popup.sql ==========
-- =========================================================
-- Cuadro de premio: aparece solo cuando ganás, mostrando el monto.
-- Usa una imagen de fondo opcional (elegida por vos) con el mismo
-- sistema de posición/tamaño/blur que las otras capas — pero no
-- participa del orden de capas, porque siempre tiene que quedar
-- arriba de todo para que se lea el número.
-- =========================================================

alter table juegos
  add column if not exists premio_url       text,
  add column if not exists premio_x         numeric(6,2) not null default 50,
  add column if not exists premio_y         numeric(6,2) not null default 50,
  add column if not exists premio_ancho     numeric(6,2) not null default 60,
  add column if not exists premio_alto      numeric(6,2) not null default 30,
  add column if not exists premio_blur      numeric(5,2) not null default 0,
  add column if not exists premio_oscurecer numeric(5,2) not null default 0;

-- ========== 12_premio_por_nivel.sql ==========
-- =========================================================
-- El cuadro de premio pasa a tener una imagen y posición POR
-- NIVEL (dos iguales / tres iguales / premio mayor), igual que ya
-- funciona con los sonidos. Reemplaza las columnas premio_* de
-- juegos que habíamos agregado recién — no llegaste a cargar
-- ninguna, así que no se pierde nada al migrar.
-- =========================================================

alter table juegos
  drop column if exists premio_url,
  drop column if exists premio_x,
  drop column if exists premio_y,
  drop column if exists premio_ancho,
  drop column if exists premio_alto,
  drop column if exists premio_blur,
  drop column if exists premio_oscurecer;

create table if not exists premios_visuales (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,
  nivel_premio text not null check (nivel_premio in ('dos_iguales', 'tres_iguales', 'premio_mayor')),

  imagen_url  text,
  x           numeric(6,2) not null default 50,
  y           numeric(6,2) not null default 50,
  ancho       numeric(6,2) not null default 60,
  alto        numeric(6,2) not null default 30,
  blur        numeric(5,2) not null default 0,
  oscurecer   numeric(5,2) not null default 0,

  created_at  timestamptz not null default now(),
  unique (juego_id, nivel_premio)
);

alter table premios_visuales enable row level security;

drop policy if exists "con sesion, todo" on premios_visuales;
create policy "con sesion, todo" on premios_visuales for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ========== 13_premio_imagen_monto.sql ==========
-- =========================================================
-- La imagen y el monto ganado, dentro del cuadro de premio, pasan
-- a tener posición propia e independiente entre sí (antes la
-- imagen se estiraba para llenar todo el cuadro y el monto quedaba
-- siempre centrado). El cuadro (x/y/ancho/alto/blur/oscurecer) no
-- cambia — esto se suma encima.
-- =========================================================

alter table premios_visuales
  add column if not exists imagen_x      numeric(6,2) not null default 50,
  add column if not exists imagen_y      numeric(6,2) not null default 50,
  add column if not exists imagen_tamano numeric(6,2) not null default 60,
  add column if not exists monto_x       numeric(6,2) not null default 50,
  add column if not exists monto_y       numeric(6,2) not null default 50;

-- ========== 14_digitos_monto.sql ==========
-- =========================================================
-- Monto ganado como íconos: un ícono opcional por carácter (0-9 y
-- el punto separador de miles), reutilizado en los tres niveles de
-- premio. Lo que no tenga ícono subido se sigue mostrando como
-- texto normal (fallback, nunca se rompe la vista).
-- =========================================================

create table if not exists digitos (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,
  caracter    text not null check (caracter in ('0','1','2','3','4','5','6','7','8','9','.')),
  imagen_url  text,
  created_at  timestamptz not null default now(),
  unique (juego_id, caracter)
);

alter table digitos enable row level security;

drop policy if exists "con sesion, todo" on digitos;
create policy "con sesion, todo" on digitos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Alto (px) y espaciado (px) entre dígitos, por nivel de premio —
-- para que el premio mayor se pueda mostrar más grande que el chico.
alter table premios_visuales
  add column if not exists monto_alto      numeric(6,2) not null default 44,
  add column if not exists monto_espaciado numeric(6,2) not null default 4;

-- ========== 15_capas_libres.sql ==========
-- =========================================================
-- Imágenes libres: a diferencia de fondo/marco/cartel (un slot
-- fijo cada uno), acá se pueden agregar tantas como quieras para ir
-- personalizando el juego. Tamaño único (no ancho/alto separado)
-- para no deformar el archivo, igual que la imagen del premio.
-- Se ubican siempre en su propia capa fija (no participan del
-- reordenamiento de fondo/marco/grilla/cartel).
-- =========================================================

create table if not exists capas_libres (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,
  imagen_url  text,
  x           numeric(6,2) not null default 50,
  y           numeric(6,2) not null default 50,
  tamano      numeric(6,2) not null default 40,
  angulo      numeric(6,2) not null default 0,
  blur        numeric(5,2) not null default 0,
  oscurecer   numeric(5,2) not null default 0,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table capas_libres enable row level security;

drop policy if exists "con sesion, todo" on capas_libres;
create policy "con sesion, todo" on capas_libres for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ========== 16_rondas_jugadas.sql ==========
-- =========================================================
-- Registro de jugadas con dinero real (vía Win777 como proveedor,
-- no la plata de mentira de la Vista previa del editor). No vive
-- ningún saldo acá — el saldo real siempre vive en Win777 — esto es
-- solo para que un giro nunca se resuelva ni se cobre dos veces.
--
-- client_id lo genera el navegador del jugador, una vez por giro, y
-- es EL MISMO roundId que se le manda a Win777 en apostar/premiar.
-- Si el pedido se corta y el navegador reintenta con el mismo
-- client_id, se devuelve el resultado ya guardado acá en vez de
-- resolver una jugada nueva — y aunque este guardado fallara por
-- algún motivo, Win777 también es idempotente por su cuenta con el
-- mismo roundId, así que no se duplica el cobro/pago en ningún caso.
-- =========================================================

create table if not exists rondas_jugadas (
  id             uuid primary key default gen_random_uuid(),
  juego_id       uuid not null references juegos(id) on delete cascade,
  client_id      text not null unique,

  apuesta        numeric(14,2) not null,
  premio         numeric(14,2) not null default 0,
  nivel_premio   text,
  grilla         jsonb not null,
  saldo_despues  numeric(14,2),

  created_at     timestamptz not null default now()
);

create index if not exists idx_rondas_juego on rondas_jugadas (juego_id, created_at desc);

-- RLS activado y SIN políticas a propósito: nadie desde el navegador
-- (ni anónimo ni logueado) puede leer ni escribir acá. Solo la
-- Service Role Key del lado servidor la toca, que bypassea RLS.
alter table rondas_jugadas enable row level security;

-- ========== 17_publicar.sql ==========
-- =========================================================
-- Publicación explícita: que un juego esté "listo" (calibrado) no
-- significa que ya tenga que aparecer en el catálogo que consume
-- Win777. "publicado" es un paso aparte, deliberado, para publicar
-- cuando vos decidas — no automático.
--
-- version sube cada vez que tocás "Publicar" — así Win777 detecta
-- que hay algo nuevo para traer la próxima vez que sincronice
-- catálogo (si no cambia el número, Win777 lo deja como "sin
-- cambios" y no reimporta nada).
-- =========================================================

alter table juegos
  add column if not exists publicado boolean not null default false,
  add column if not exists version   integer not null default 1;

-- ========== 18_controles_jugador.sql ==========
-- =========================================================
-- Controles del jugador:
--
-- paso_apuesta — de a cuánto sube/baja la apuesta con los botones
--   +/-. Configurable por juego: uno puede ir de a 500 y otro de a
--   1.000 sin tocar código.
--
-- El botón de girar deja de estar clavado abajo a la derecha: pasa a
-- tener posición y tamaño propios, más una imagen opcional con su
-- propio tamaño (en % del botón) para poder calzarla bien. Si la
-- imagen ya ES el botón entero, girar_sin_fondo saca el círculo de
-- atrás y deja solo la imagen.
-- =========================================================

alter table juegos
  add column if not exists paso_apuesta         numeric(14,2) not null default 500,
  add column if not exists girar_x              numeric(6,2)  not null default 50,
  add column if not exists girar_y              numeric(6,2)  not null default 90,
  add column if not exists girar_tamano         numeric(6,2)  not null default 64,
  add column if not exists girar_imagen_url     text,
  add column if not exists girar_imagen_tamano  numeric(6,2)  not null default 70,
  add column if not exists girar_sin_fondo      boolean       not null default false;

-- ========== 19_botones_controles.sql ==========
-- =========================================================
-- Los controles dejan de estar clavados en la barra de abajo: cada
-- grupo (saldo, apuesta, velocidad) tiene su posición propia, igual
-- que el botón de girar.
--
-- Los botones chicos (−, +, x1, x2, x3) pasan a poder tener imagen
-- propia, con el MISMO criterio que el de girar: el tamaño del
-- botón y el de la imagen se controlan por separado, para poder
-- calzar la imagen adentro sin deformarla.
-- =========================================================

alter table juegos
  add column if not exists saldo_x    numeric(6,2) not null default 14,
  add column if not exists saldo_y    numeric(6,2) not null default 96,
  add column if not exists apuesta_x  numeric(6,2) not null default 50,
  add column if not exists apuesta_y  numeric(6,2) not null default 96,
  add column if not exists turbo_x    numeric(6,2) not null default 86,
  add column if not exists turbo_y    numeric(6,2) not null default 96;

-- Una fila por botón. Sin fila = botón con su aspecto por defecto
-- (el texto), que es como está hoy: no hace falta configurar nada
-- para que siga funcionando igual.
create table if not exists botones (
  id             uuid primary key default gen_random_uuid(),
  juego_id       uuid not null references juegos(id) on delete cascade,
  clave          text not null check (clave in ('menos', 'mas', 'x1', 'x2', 'x3')),
  imagen_url     text,
  tamano         numeric(6,2) not null default 28,
  imagen_tamano  numeric(6,2) not null default 70,
  sin_fondo      boolean      not null default false,
  created_at     timestamptz  not null default now(),
  unique (juego_id, clave)
);

alter table botones enable row level security;

drop policy if exists "con sesion, todo" on botones;
create policy "con sesion, todo" on botones for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ========== 20_modo_apuesta.sql ==========
-- =========================================================
-- Modo de apuesta, elegible por juego desde el ensamblador:
--
--   fichas     — montos fijos, un toque y listo
--   mas_menos  — solo los botones + y − (de a paso_apuesta)
--   mixto      — fichas para saltar rápido, +/− para ajuste fino
--
-- Los tres comparten el mismo motor: lo único que cambia es qué
-- controles se dibujan. El monto siempre se valida contra min_bet y
-- max_bet en el servidor, así que ningún modo permite apostar fuera
-- de rango por más que se toque el navegador.
--
-- Además, los recuadros de Saldo y Apuesta pueden llevar imagen de
-- fondo propia, con su tamaño, igual que el resto de las capas.
-- =========================================================

alter table juegos
  add column if not exists modo_apuesta text not null default 'mixto'
    check (modo_apuesta in ('fichas', 'mas_menos', 'mixto')),

  -- Los montos de las fichas los define Max por juego. Si queda
  -- vacío, la pantalla arma fichas solas a partir del mínimo
  -- (1x, 2x, 5x, 20x, 50x) para que nunca se vea sin opciones.
  add column if not exists fichas numeric(14,2)[] not null default '{}',

  add column if not exists saldo_fondo_url    text,
  add column if not exists saldo_ancho        numeric(6,2) not null default 110,
  add column if not exists saldo_alto         numeric(6,2) not null default 44,
  add column if not exists apuesta_fondo_url  text,
  add column if not exists apuesta_ancho      numeric(6,2) not null default 110,
  add column if not exists apuesta_alto       numeric(6,2) not null default 44,
  add column if not exists fichas_x           numeric(6,2) not null default 50,
  add column if not exists fichas_y           numeric(6,2) not null default 88;

-- ========== 21_duplicar_juego.sql ==========
-- =========================================================
-- Duplicar un juego completo: la fila de juegos más TODO lo que
-- cuelga de ella (símbolos, sonidos, efectos, premios visuales,
-- dígitos, capas libres, botones). Con 300 juegos por delante, armar
-- cada uno desde cero no escala — se clona uno ya ajustado y solo se
-- cambian arte y pagos.
--
-- Va como función SQL y no como una tanda de inserts desde el
-- navegador porque así es atómica: o se copia todo, o no se copia
-- nada. Si se cortara a la mitad quedaría un juego mutilado sin
-- forma obvia de darse cuenta.
--
-- La copia se arma con jsonb, no listando columnas una por una: así
-- sigue funcionando cuando agregues columnas nuevas en el futuro,
-- sin tener que acordarte de actualizar esta función.
--
-- La copia SIEMPRE entra como borrador y sin publicar, aunque el
-- original esté publicado: nada llega al catálogo de Win777 sin que
-- alguien lo revise antes.
--
-- NO se copian las rondas jugadas: son el historial del original.
-- Mezclarlas arruinaría el RTP real de los dos juegos.
-- =========================================================

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

  -- Lo propio de la copia se pisa; todo lo demás (imágenes,
  -- posiciones, capas, modo de apuesta, fichas) se hereda tal cual.
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

  -- Tablas hijas. Mismo criterio: se copia todo menos id y juego_id.
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

  return v_nuevo_id;
end;
$$;

-- ========== 22_cadenas_luces.sql ==========
-- =========================================================
-- Cadenas de luces: igual que las imágenes libres, cantidad
-- ilimitada por juego. Cada una es una fila propia con su modo,
-- cantidad de focos, tamaño, animación, velocidad y colores.
--
-- modo 'marco'  — los focos se distribuyen solos alrededor del
--                 marco actual (si el marco se mueve o cambia de
--                 tamaño, la cadena lo sigue, no queda una copia
--                 vieja de la posición).
-- modo 'libre'  — cada foco tiene su propia posición (x,y en % del
--                 juego), guardada en "puntos". Se arrastran a mano
--                 en la vista previa.
--
-- colores es un arreglo de 1 a 8 colores — no está fijo en dos, cada
-- animación los usa distinto (ver comentarios en el código).
-- =========================================================

create table if not exists cadenas_luces (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,
  modo       text not null default 'marco' check (modo in ('marco', 'libre')),
  cantidad   integer not null default 12 check (cantidad between 2 and 40),
  tamano     numeric(6,2) not null default 11,
  animacion  text not null default 'secuencial' check (animacion in ('secuencial', 'sincronizado', 'ola')),
  velocidad  numeric(6,2) not null default 1,
  colores    text[] not null default '{"#EF9F27","#378ADD"}',
  -- Solo se usa en modo 'libre'. Ej: [{"x":15,"y":50}, {"x":22,"y":50}, ...]
  puntos     jsonb not null default '[]',
  orden      integer not null default 0,
  created_at timestamptz not null default now()
);

alter table cadenas_luces enable row level security;

drop policy if exists "con sesion, todo" on cadenas_luces;
create policy "con sesion, todo" on cadenas_luces for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- duplicar_juego (SQL 21) ya copiaba todas las tablas hijas; se
-- reemplaza para que también copie las cadenas de luces, que son
-- posteriores a esa migración.
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

  insert into cadenas_luces
  select * from jsonb_populate_recordset(null::cadenas_luces, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from cadenas_luces x where x.juego_id = p_juego_id
  ));

  return v_nuevo_id;
end;
$$;

-- ========== 23_formas_luces.sql ==========
-- =========================================================
-- Formas de los focos y tamaño en dos ejes.
--
-- forma  — circulo (como venía), cuadrado, rombo (un cuadrado
--          girado 45°, queda bien en marcos tipo marquesina) y
--          barra (rectángulo con las puntas redondeadas).
--
-- ancho / alto — reemplazan al "tamano" único: un foco cuadrado
--          angosto y alto es una barra vertical, uno ancho y bajo es
--          una barra horizontal. Se migra el valor de tamano a los
--          dos ejes para que las cadenas que ya existen se vean
--          igual que antes.
--
-- Animaciones nuevas:
--   alternado  — pares e impares se turnan (marquesina clásica)
--   aleatorio  — cada foco titila por su cuenta, sin patrón
--   vaiven     — la luz va y vuelve en vez de dar la vuelta entera
-- =========================================================

alter table cadenas_luces
  add column if not exists forma text not null default 'circulo'
    check (forma in ('circulo', 'cuadrado', 'rombo', 'barra')),
  add column if not exists ancho numeric(6,2),
  add column if not exists alto  numeric(6,2);

-- Las cadenas que ya existen heredan su tamaño único en los dos ejes.
update cadenas_luces set ancho = tamano where ancho is null;
update cadenas_luces set alto  = tamano where alto  is null;

alter table cadenas_luces
  alter column ancho set default 11,
  alter column alto  set default 11,
  alter column ancho set not null,
  alter column alto  set not null;

alter table cadenas_luces
  drop constraint if exists cadenas_luces_animacion_check;

alter table cadenas_luces
  add constraint cadenas_luces_animacion_check
  check (animacion in ('secuencial', 'sincronizado', 'ola', 'alternado', 'aleatorio', 'vaiven'));

-- ========== 24_figura_luces.sql ==========
-- =========================================================
-- Modo "figura": la cadena arma su PROPIA forma, sin depender del
-- marco ni de acomodar cada foco a mano.
--
-- Hasta ahora había dos modos: 'marco' (los focos siguen el borde del
-- marco del juego) y 'libre' (cada foco arrastrado uno por uno).
-- Falta el caso más común: querer un rectángulo de luces en algún
-- lugar de la pantalla, con su tamaño y su inclinación.
--
--   figura 'rectangulo' — los focos recorren el perímetro
--   figura 'circulo'    — los focos se reparten en una elipse
--   figura 'linea'      — los focos en fila recta
--
-- La rotación gira la figura entera sobre su centro, así una línea
-- puede quedar vertical o en diagonal sin tocar cada foco.
-- =========================================================

alter table cadenas_luces
  drop constraint if exists cadenas_luces_modo_check;

alter table cadenas_luces
  add constraint cadenas_luces_modo_check
  check (modo in ('marco', 'libre', 'figura'));

alter table cadenas_luces
  add column if not exists figura text not null default 'rectangulo'
    check (figura in ('rectangulo', 'circulo', 'linea')),
  add column if not exists figura_x        numeric(6,2) not null default 50,
  add column if not exists figura_y        numeric(6,2) not null default 50,
  add column if not exists figura_ancho    numeric(6,2) not null default 60,
  add column if not exists figura_alto     numeric(6,2) not null default 30,
  add column if not exists figura_rotacion numeric(6,2) not null default 0;

-- ========== 25_focos_realistas.sql ==========
-- =========================================================
-- Apariencia de los focos: dejan de ser círculos planos que
-- aparecen y desaparecen, y pasan a verse como lamparitas.
--
--   glow    — el resplandor que desborda del foco (px). Es lo que
--             da la sensación de que ilumina alrededor en vez de ser
--             una calcomanía pegada.
--   nucleo  — cuánto del centro va blanco antes de abrirse al color.
--   apagado — brillo del foco cuando está apagado. En 0 desaparece
--             (como antes); en 15-25% queda opaco, como una lámpara
--             real sin corriente.
--   vidrio  — el reflejo claro arriba a la izquierda.
--
-- Aplica a todas las formas (círculo, cuadrado, rombo, barra): el
-- resplandor sigue el contorno de cada una.
-- =========================================================

alter table cadenas_luces
  add column if not exists glow    numeric(6,2) not null default 14,
  add column if not exists nucleo  numeric(6,2) not null default 45,
  add column if not exists apagado numeric(6,2) not null default 18,
  add column if not exists vidrio  boolean      not null default true;

-- ========== 26_imagen_carga.sql ==========
-- =========================================================
-- Imagen de la pantalla de carga, propia y separada de la portada.
--
-- La portada es la carátula del catálogo (la que ve el jugador en
-- Win777 antes de entrar). Esta es la que se muestra mientras el
-- juego termina de cargar. Suelen querer ser distintas: la portada
-- es chica y vertical, esta se ve grande y centrada.
--
-- Si queda vacía, la pantalla de carga usa la portada; y si tampoco
-- hay portada, muestra solo el nombre del juego. Nunca queda en
-- blanco.
-- =========================================================

alter table juegos
  add column if not exists carga_url text;

-- ========== 27_mostrar_nombre.sql ==========
-- =========================================================
-- Mostrar (o no) el nombre del juego arriba de la pantalla.
--
-- Cuando el cartel ya trae el nombre dibujado, la línea de texto de
-- arriba repite la misma información y encima come espacio útil de
-- la pantalla. Pero no todos los juegos van a tener cartel, y ahí el
-- nombre es lo único que identifica dónde está parado el jugador —
-- por eso es una opción por juego y no algo borrado del código.
--
-- Arranca en true para no cambiarle el aspecto a los juegos que ya
-- existen. Al duplicar un juego la opción se copia, así que se
-- desactiva una vez y la heredan todas las copias.
-- =========================================================

alter table juegos
  add column if not exists mostrar_nombre boolean not null default true;

-- ========== 28_contador_premio.sql ==========
-- =========================================================
-- Contador ascendente del premio: el monto sube desde cero hasta el
-- total en vez de aparecer de golpe. Es de lo que más se "siente" al
-- ganar, y no cambia nada del resultado — el número final es el
-- mismo que decidió el servidor, solo se muestra progresivamente.
--
-- contador_ms — cuánto dura la subida. En 0 queda como antes
--   (aparece directo), por si en algún juego no lo querés.
--
-- Se sube más rápido en premios chicos y más lento en los grandes:
-- esa parte se calcula sola, no hace falta configurarla por nivel.
-- =========================================================

alter table juegos
  add column if not exists contador_ms integer not null default 900;

-- ========== 28_rive_simbolos.sql ==========
-- =========================================================
-- Símbolos animados con Rive: opcional, por símbolo.
--
-- riv_url            — el archivo .riv (el ícono ya diseñado adentro,
--                       importado del mismo PNG que ya usás en el
--                       símbolo, con el movimiento agregado en Rive).
-- riv_trigger_chico   — nombre del disparador en Rive para cuando ese
--                       símbolo forma parte de un premio de dos o
--                       tres iguales.
-- riv_trigger_grande  — nombre del disparador para el premio mayor.
--
-- Sin riv_url, el símbolo se sigue mostrando como imagen normal en
-- todo momento — esto es 100% opcional, no cambia nada de lo que ya
-- funciona si no lo usás.
-- =========================================================

alter table simbolos
  add column if not exists riv_url text,
  add column if not exists riv_trigger_chico text,
  add column if not exists riv_trigger_grande text;

-- Para que el reintento de un giro (mismo client_id) devuelva
-- exactamente las mismas columnas ganadoras que la vez original, no
-- solo el monto y el saldo.
alter table rondas_jugadas
  add column if not exists simbolos_ganadores jsonb not null default '[]';

-- ========== 29_animaciones_rive.sql ==========
-- =========================================================
-- Animaciones Rive del juego (aparte de las de cada símbolo).
--
-- Una sola tabla para las dos cosas, porque comparten todo salvo
-- cuándo se prenden:
--
--   evento 'intro'         — corre ANTES de la pantalla de carga,
--                            una sola por juego. La carga de
--                            imágenes y sonidos arranca en paralelo,
--                            así la intro no suma tiempo de espera.
--   evento 'girar'         — al arrancar el giro.
--   evento 'premio_chico'  — dos o tres iguales.
--   evento 'premio_mayor'  — el premio grande.
--
-- Las de premio son el complemento de lo que ya hace el símbolo: el
-- símbolo festeja porque él ganó, esto pone la escena alrededor (el
-- dragón escupiendo fuego, la sandía que revienta en monedas).
--
-- Tope acordado: 2 por evento (salvo intro, que es 1). No es un
-- límite técnico sino de criterio — cada instancia de Rive es un
-- motor de dibujo propio corriendo, y más de eso empieza a competir
-- con la animación de los rodillos, que es la que no puede tironear.
-- =========================================================

create table if not exists animaciones_rive (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,
  evento     text not null default 'premio_mayor'
             check (evento in ('intro', 'girar', 'premio_chico', 'premio_mayor')),
  riv_url    text,
  -- Nombre del disparador dentro del .riv. Si queda vacío, la
  -- animación arranca sola al mostrarse (que es lo normal en una
  -- animación de una sola pasada, como la intro).
  disparador text,
  x          numeric(6,2) not null default 50,
  y          numeric(6,2) not null default 50,
  tamano     numeric(6,2) not null default 60,
  orden      integer      not null default 0,
  created_at timestamptz  not null default now()
);

alter table animaciones_rive enable row level security;

drop policy if exists "con sesion, todo" on animaciones_rive;
create policy "con sesion, todo" on animaciones_rive for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- duplicar_juego tiene que copiar también estas animaciones; si no,
-- un juego duplicado perdería la intro y los complementos.
create or replace function duplicar_juego(p_juego_id uuid, p_nombre text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo_id uuid := gen_random_uuid();
  v_datos    jsonb;
  v_tabla    text;
begin
  if exists (select 1 from juegos where slug = p_slug) then
    raise exception 'Ya existe un juego con el slug "%"', p_slug;
  end if;

  select to_jsonb(j) into v_datos from juegos j where j.id = p_juego_id;
  if v_datos is null then
    raise exception 'No se encontró el juego a duplicar';
  end if;

  v_datos := v_datos || jsonb_build_object(
    'id', v_nuevo_id, 'nombre', p_nombre, 'slug', p_slug,
    'estado', 'borrador', 'publicado', false, 'version', 1,
    'created_at', now(), 'updated_at', now()
  );

  insert into juegos select * from jsonb_populate_record(null::juegos, v_datos);

  -- Todas las tablas hijas se copian igual: se recorren por nombre en
  -- vez de repetir el mismo bloque siete veces. Agregar una tabla
  -- hija nueva en el futuro es sumarla a esta lista y nada más.
  foreach v_tabla in array array[
    'simbolos', 'sonidos', 'efectos', 'premios_visuales',
    'digitos', 'capas_libres', 'botones', 'cadenas_luces', 'animaciones_rive'
  ] loop
    execute format(
      'insert into %I select * from jsonb_populate_recordset(null::%I, (
         select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object(
           ''id'', gen_random_uuid(), ''juego_id'', $1)), ''[]''::jsonb)
         from %I x where x.juego_id = $2))',
      v_tabla, v_tabla, v_tabla
    ) using v_nuevo_id, p_juego_id;
  end loop;

  return v_nuevo_id;
end;
$$;

-- ========== 29_historial_rtp.sql ==========
-- =========================================================
-- Historial de rondas y RTP real por juego.
--
-- Las rondas ya se venían guardando en rondas_jugadas, pero la tabla
-- tiene RLS sin políticas: solo la Service Role Key del servidor la
-- podía tocar. Eso está bien para escribir (el navegador no debe
-- poder inventar rondas), pero impedía mirarlas desde el
-- ensamblador.
--
-- Se agrega SOLO permiso de lectura, y solo con sesión iniciada. El
-- navegador sigue sin poder insertar, modificar ni borrar rondas: el
-- historial es un registro, no algo editable.
-- =========================================================

drop policy if exists "con sesion, leer" on rondas_jugadas;
create policy "con sesion, leer" on rondas_jugadas for select
  using (auth.uid() is not null);

-- Resumen por juego. Se hace en la base y no en el navegador porque
-- con miles de rondas traerlas todas para sumarlas sería absurdo:
-- acá vuelve una sola fila por juego.
--
-- El RTP real es lo pagado sobre lo apostado. Converge al teórico con
-- el tiempo; con pocos giros no significa nada, por eso también se
-- devuelve la cantidad de rondas para poder decir cuándo mirarlo en
-- serio.
create or replace function resumen_juego(p_juego_id uuid)
returns table (
  rondas        bigint,
  apostado      numeric,
  pagado        numeric,
  rtp_real      numeric,
  premio_mayor  numeric,
  ganadas       bigint,
  ultima        timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)                                              as rondas,
    coalesce(sum(apuesta), 0)                             as apostado,
    coalesce(sum(premio), 0)                              as pagado,
    case when coalesce(sum(apuesta), 0) > 0
         then round(sum(premio) / sum(apuesta) * 100, 2)
         else null end                                    as rtp_real,
    coalesce(max(premio), 0)                              as premio_mayor,
    count(*) filter (where premio > 0)                    as ganadas,
    max(created_at)                                       as ultima
  from rondas_jugadas
  where juego_id = p_juego_id;
$$;

-- ========== 30_migrar_a_lottie.sql ==========
-- =========================================================
-- Cambio de proveedor de animaciones: Rive -> Lottie.
--
-- Motivo: Rive dejó de permitir exportar el .riv en el plan
-- gratuito. Lottie sí, y además hay herramientas que ya generan y
-- descargan animaciones Lottie directo, sin curva de aprendizaje.
--
-- Como todavía no existía ningún .riv real cargado, esto es un
-- renombre limpio, no una migración de datos.
--
-- Diferencia de diseño importante: Lottie no tiene "disparadores"
-- con nombre como Rive (máquina de estados). Es un reproductor
-- lineal: carga, reproduce, avisa cuando termina. Por eso:
--
--   - Cada símbolo pasa a tener DOS archivos (uno para premio chico,
--     otro para premio mayor) en vez de un archivo con dos
--     disparadores internos. Es además más práctico: cada reacción
--     es directamente un archivo que descargás ya hecho.
--   - Las animaciones del juego (intro/girar/premio) pierden el
--     campo "disparador" — simplemente se muestran y reproducen
--     solas, no hace falta decirles cuándo arrancar.
-- =========================================================

alter table simbolos
  drop column if exists riv_url,
  drop column if exists riv_trigger_chico,
  drop column if exists riv_trigger_grande,
  add column if not exists lottie_chico_url  text,
  add column if not exists lottie_grande_url text;

-- Renombrar preserva los datos, las políticas RLS y los índices.
-- Si el script se corre de nuevo, animaciones_lottie ya existe y el
-- "create table if not exists" de la planilla anterior vuelve a crear
-- animaciones_rive vacía: esa copia se tira, no se renombra encima.
do $$
begin
  if to_regclass('public.animaciones_rive') is not null
     and to_regclass('public.animaciones_lottie') is null then
    alter table animaciones_rive rename to animaciones_lottie;
  elsif to_regclass('public.animaciones_rive') is not null
        and to_regclass('public.animaciones_lottie') is not null then
    drop table animaciones_rive;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'animaciones_lottie'
      and column_name = 'riv_url'
  ) then
    alter table animaciones_lottie rename column riv_url to lottie_url;
  end if;
end $$;

alter table animaciones_lottie drop column if exists disparador;

-- duplicar_juego apuntaba a la tabla vieja por nombre; se actualiza
-- la lista para que copie la nueva.
create or replace function duplicar_juego(p_juego_id uuid, p_nombre text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo_id uuid := gen_random_uuid();
  v_datos    jsonb;
  v_tabla    text;
begin
  if exists (select 1 from juegos where slug = p_slug) then
    raise exception 'Ya existe un juego con el slug "%"', p_slug;
  end if;

  select to_jsonb(j) into v_datos from juegos j where j.id = p_juego_id;
  if v_datos is null then
    raise exception 'No se encontró el juego a duplicar';
  end if;

  v_datos := v_datos || jsonb_build_object(
    'id', v_nuevo_id, 'nombre', p_nombre, 'slug', p_slug,
    'estado', 'borrador', 'publicado', false, 'version', 1,
    'created_at', now(), 'updated_at', now()
  );

  insert into juegos select * from jsonb_populate_record(null::juegos, v_datos);

  foreach v_tabla in array array[
    'simbolos', 'sonidos', 'efectos', 'premios_visuales',
    'digitos', 'capas_libres', 'botones', 'cadenas_luces', 'animaciones_lottie'
  ] loop
    execute format(
      'insert into %I select * from jsonb_populate_recordset(null::%I, (
         select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object(
           ''id'', gen_random_uuid(), ''juego_id'', $1)), ''[]''::jsonb)
         from %I x where x.juego_id = $2))',
      v_tabla, v_tabla, v_tabla
    ) using v_nuevo_id, p_juego_id;
  end loop;

  return v_nuevo_id;
end;
$$;

-- ========== 31_pagos_5x3.sql ==========
-- =========================================================
-- Pagos para el motor de 5 rodillos. El 3x3 se queda exactamente
-- como está — estas columnas quedan en NULL para esos juegos y el
-- editor no las muestra ahí, así que no hay nada que migrar ni
-- riesgo de romper el motor que ya está calibrado y en producción.
--
-- Regla del 5x3, igual criterio que el 3x3 (estándar de slots, de
-- izquierda a derecha, wild sustituye): paga la cadena de símbolos
-- iguales más larga que arranca en el primer rodillo. Dos iguales ya
-- existía (pago_dos/pago_tres); esto agrega cuatro y cinco.
-- =========================================================

alter table simbolos
  add column if not exists pago_cuatro numeric(10,2) check (pago_cuatro >= 0),
  add column if not exists pago_cinco  numeric(10,2) check (pago_cinco >= 0);

-- ========== 32_demo_rodillos_de_oro.sql ==========
-- =========================================================
-- Juego de demostración: "Rodillos de Oro"
-- Slot 5x3, motor clasico-5x3, con comodín (wild).
-- RTP calibrado a ~93% — para tener un juego real con el que probar
-- toda la cadena (grilla, motor de rodillos, RTP, animaciones) sin
-- tener que armar símbolos y pagos a mano primero.
--
-- Corré esto DESPUÉS de 01_esquema.sql y 31_pagos_5x3.sql. Es seguro
-- correrlo más de una vez: borra el juego anterior con el mismo slug
-- antes de recrearlo.
--
-- Sin ícono cargado en ningún símbolo a propósito — se ven como
-- texto (el nombre) hasta que subas las imágenes que quieras. La
-- mecánica no depende de eso para funcionar.
--
-- Arranca en "en_prueba", no en "listo": no se sincroniza solo al
-- catálogo de Win777. Promovelo a mano cuando lo hayas probado.
-- =========================================================

delete from juegos where slug = 'rodillos-de-oro';

with nuevo as (
  insert into juegos (slug, nombre, descripcion, estado, motor, min_bet, max_bet)
  values (
    'rodillos-de-oro',
    'Rodillos de Oro',
    '5 rodillos, una línea de pago. Paga la cadena de símbolos iguales más larga que arranca en el primer rodillo, de izquierda a derecha. El comodín sustituye a cualquier símbolo.',
    'en_prueba',
    'clasico-5x3',
    1000,
    50000
  )
  returning id
)
-- Símbolos (RTP ~93.0%, volatilidad media, paga 1 de cada 5.4 giros,
-- premio mayor 1500x). El orden es de más común a más raro.
insert into simbolos (juego_id, nombre, peso, pago_dos, pago_tres, pago_cuatro, pago_cinco, orden)
select id, v.nombre, v.peso, v.dos, v.tres, v.cuatro, v.cinco, v.orden
from nuevo, (values
  ('cereza',    26, 1,  9,  21,  52, 0),
  ('limon',     24, 1,  9,  21,  52, 1),
  ('uva',       20, 1, 10,  30,  70, 2),
  ('campana',   14, 0, 15,  45, 118, 3),
  ('herradura',  9, 0, 24,  76, 200, 4),
  ('diamante',   6, 0, 38, 138, 355, 5),
  ('siete',      3, 0, 76, 275, 750, 6),
  ('wild',       2, 0,  0,   0, 1500, 7)
) as v(nombre, peso, dos, tres, cuatro, cinco, orden);

-- Efectos visuales (CSS). Mismo criterio que "Frutas del 777": uno de
-- carcasa siempre visible, tres de premio según el nivel.
insert into efectos (juego_id, nombre, tipo, nivel_premio, posicion, css, duracion_ms)
select id, e.nombre, e.tipo, e.nivel, e.pos, e.css, e.dur
from juegos j, (values

  ('Brillo del marco', 'carcasa', null, null,
   E'@keyframes brillo-marco-oro {\n  0%,100% { box-shadow: inset 0 0 20px rgba(217,164,65,.15); }\n  50% { box-shadow: inset 0 0 35px rgba(217,164,65,.4); }\n}\n.efecto { position:absolute; inset:0; border-radius:20px; pointer-events:none; animation: brillo-marco-oro 3s ease-in-out infinite; }',
   3000),

  ('Destello chico', 'premio', 'dos_iguales', 'linea',
   E'@keyframes destello-chico-oro {\n  0% { opacity:0; transform:scale(.9); }\n  40% { opacity:.7; transform:scale(1.05); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(107,138,253,.5), transparent 70%); animation: destello-chico-oro 700ms ease-out; }',
   700),

  ('Destello grande', 'premio', 'tres_iguales', 'linea',
   E'@keyframes destello-grande-oro {\n  0% { opacity:0; transform:scale(.8); }\n  30% { opacity:1; transform:scale(1.15); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(91,191,136,.6), transparent 65%); animation: destello-grande-oro 900ms ease-out; }',
   900),

  ('Explosión mayor', 'premio', 'premio_mayor', 'pantalla',
   E'@keyframes explosion-mayor-oro {\n  0% { opacity:0; transform:scale(.5); }\n  25% { opacity:1; transform:scale(1.1); }\n  60% { opacity:.8; transform:scale(1); }\n  100% { opacity:0; transform:scale(1.05); }\n}\n.efecto-premio { background: radial-gradient(circle, rgba(217,164,65,.7), rgba(217,164,65,.2) 50%, transparent 75%); animation: explosion-mayor-oro 1300ms ease-out; }',
   1300)

) as e(nombre, tipo, nivel, pos, css, dur)
where j.slug = 'rodillos-de-oro';

-- Confirmación
select
  j.nombre,
  j.motor,
  j.estado,
  (select count(*) from simbolos where juego_id = j.id) as simbolos,
  (select count(*) from efectos where juego_id = j.id) as efectos
from juegos j where j.slug = 'rodillos-de-oro';

-- ========== 33_mines_esquema.sql ==========
-- =========================================================
-- MINES — esquema.
--
-- Diferencia de fondo con los slots: una tirada de tragamonedas es
-- una sola pregunta al servidor. Una partida de Mines dura varios
-- pasos (destapar, destapar, retirar) y el servidor tiene que
-- ACORDARSE de dónde están las minas entre un paso y el siguiente,
-- sin decírselo al navegador hasta que la partida termina. Por eso
-- hace falta una tabla de partidas, no solo un cálculo de una vez.
-- =========================================================

-- Config por juego: el margen de la casa (equivalente al RTP de un
-- slot, pero acá es un solo número en vez de calibrar símbolos) va
-- configurable por juego, igual que ya son la apuesta mín/máx.
alter table juegos
  add column if not exists mines_margen_pct numeric(5,4) not null default 0.0300
    check (mines_margen_pct >= 0 and mines_margen_pct < 1);

-- Imágenes de las tres caras de una casilla — opcional, sin cargar
-- ninguna se ve con un estilo por defecto (no bloquea probar la
-- mecánica antes de tener arte).
alter table juegos
  add column if not exists mines_casilla_oculta_url  text,
  add column if not exists mines_casilla_segura_url  text,
  add column if not exists mines_casilla_mina_url    text;

create table if not exists mines_rondas (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  -- Identifica al jugador dentro del token de Win777, igual que
  -- client_id en rondas_jugadas — no es una cuenta propia de acá.
  jugador_id text not null,

  apuesta    numeric(12,2) not null check (apuesta > 0),
  minas      int not null check (minas >= 1 and minas <= 24),

  -- Las posiciones de las minas viven acá, pero NUNCA se devuelven
  -- al cliente en ninguna respuesta mientras estado='en_curso' — eso
  -- es tan importante como que el servidor calcule el resultado en
  -- los slots. Se puede leer recién cuando la partida ya terminó.
  posiciones_mina jsonb not null,
  reveladas       jsonb not null default '[]',

  estado     text not null default 'en_curso'
             check (estado in ('en_curso', 'retirada', 'perdida')),
  multiplicador_actual numeric(12,4) not null default 1,
  ganancia_final        numeric(12,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mines_rondas_juego on mines_rondas (juego_id, jugador_id);
-- Como mucho una partida en_curso por jugador y juego a la vez — así
-- no puede abrir una segunda ronda mientras la primera sigue viva.
create unique index if not exists idx_mines_rondas_una_en_curso
  on mines_rondas (juego_id, jugador_id)
  where estado = 'en_curso';

alter table mines_rondas enable row level security;

-- Mismo criterio que rondas_jugadas: el navegador nunca escribe acá
-- directo, solo el servidor (Service Role Key). Con sesión del
-- ensamblador se puede LEER, para un futuro historial — nunca
-- insertar, modificar ni borrar.
drop policy if exists "con sesion, leer" on mines_rondas;
create policy "con sesion, leer" on mines_rondas for select
  using (auth.uid() is not null);

-- ========== 34_mines_bloqueo_optimista.sql ==========
-- =========================================================
-- Bloqueo optimista para mines_rondas.
--
-- El problema real: revelar y retirar leían la fila y RECIÉN
-- DESPUÉS la escribían, en dos pasos separados. Si llegan dos
-- pedidos casi al mismo tiempo (dos clicks, o alguien probando a
-- propósito "retirar" dos veces en simultáneo), los dos pueden leer
-- "en_curso" antes de que ninguno haya terminado de escribir, y los
-- dos terminan procesando el mismo paso — en el caso del retiro,
-- eso es plata paga de más.
--
-- La solución: cada fila lleva un número de versión. Cada escritura
-- exige que la versión siga siendo la que se leyó, Y de paso la
-- incrementa. Si dos pedidos parten de la misma versión, solo uno
-- de los dos puede ganar la escritura — el otro se entera de que
-- llegó tarde (cero filas afectadas) y no sigue adelante con el
-- pago ni con el resultado.
-- =========================================================

alter table mines_rondas
  add column if not exists version integer not null default 0;

-- ========== 35_grilla_icono_tamano.sql ==========
-- =========================================================
-- Tamaño del ícono dentro de su celda, independiente del tamaño de
-- la celda misma. Hasta ahora era un 60% fijo escrito en el código
-- — no hacía falta más con 3 columnas, pero con 5 (o más adelante,
-- otros motores) las celdas son más angostas y conviene poder
-- ajustarlo por juego.
-- =========================================================

alter table juegos
  add column if not exists grilla_icono_tamano numeric(5,2) not null default 60;

-- ========== 36_perfiles_rtp.sql ==========
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

-- ========== 37_mines_casillas_lottie.sql ==========
-- =========================================================
-- MINES — animaciones Lottie en las caras de la casilla.
--
-- Hasta ahora cada cara de la casilla (tapada / segura / mina) se
-- cargaba como imagen fija. Se suma la opción de una animación Lottie
-- en su lugar, con el mismo motor que ya usan las reacciones de los
-- símbolos ganadores (@lottiefiles/dotlottie-web, .json o .lottie).
--
-- Es UN asset por cara: subir una animación borra la imagen de esa
-- cara y al revés. Orden de resolución en el frontend:
--   animación  ->  imagen  ->  estilo por defecto.
-- =========================================================

alter table juegos
  add column if not exists mines_casilla_oculta_lottie_url  text,
  add column if not exists mines_casilla_segura_lottie_url  text,
  add column if not exists mines_casilla_mina_lottie_url     text;

-- ========== 38_mines_revelado_al_perder.sql ==========
-- =========================================================
-- MINES — qué se muestra al perder.
--
--   'minas' : se destapan solo las minas, el resto queda tapado.
--   'todo'  : se destapa el tablero entero — el jugador ve las
--             casillas seguras que no llegó a elegir. Más transparente
--             (se ve que las minas no se movieron) y engancha con el
--             "casi la elegía".
--
-- Todo se resuelve en el cliente: las posiciones de las minas ya
-- vienen en la respuesta de mines-revelar al pisar una, y las seguras
-- son "todo lo que no es mina". Sin cambios en la matemática ni en
-- los endpoints.
-- =========================================================

alter table juegos
  add column if not exists mines_revelado_al_perder text not null default 'todo'
    check (mines_revelado_al_perder in ('minas', 'todo'));

-- ========== 39_mines_controles.sql ==========
-- =========================================================
-- MINES — posición y aspecto de los controles del tablero.
--
-- Mines tiene otra pantalla que los slots: saldo, multiplicador,
-- botón de empezar/retirar, selector de minas y recuadro de apuesta.
-- Todo eso se posiciona y se le pone imagen de fondo desde la vista
-- previa, igual que los grupos de un slot.
--
-- Va todo en UNA columna jsonb para no sumar 20 columnas sueltas y
-- para que `duplicar_juego` lo copie solo (es una columna de juegos).
-- Forma:
--   {
--     "saldo":   { "x":26, "y":8,  "ancho":120, "alto":44, "fondo_url":null },
--     "mult":    { "x":74, "y":8,  "ancho":150, "alto":44, "fondo_url":null },
--     "apuesta": { "x":50, "y":78 },
--     "minas":   { "x":50, "y":70 },
--     "boton":   { "x":50, "y":91, "ancho":160, "alto":52, "imagen_url":null }
--   }
-- Lo que falte en el jsonb cae en los valores por defecto del código.
-- =========================================================

alter table juegos
  add column if not exists mines_controles jsonb not null default '{}'::jsonb;

-- ========== 40_ruleta.sql ==========
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

-- ========== 41_ruleta_botones.sql ==========
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

-- ========== 42_rotacion_rtp.sql ==========
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

-- ========== 43_crash.sql ==========
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

-- ========== 44_plinko.sql ==========
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

-- ========== 45_raspadita.sql ==========
-- =========================================================
-- 45 — MOTOR RASPADITA
--
-- Una tarjeta con celdas tapadas que el jugador raspa. Un solo motor
-- cubre muchos juegos: se elige la grilla (6/9/12) y, símbolo por
-- símbolo, sus escalones de premio (cantidad -> multiplicador ->
-- frecuencia). El RTP es exacto: RTP = Σ (multiplicador / cada).
--
-- Igual que Crash y Plinko, toda la config vive en una columna jsonb
-- de `juegos`. No usa la tabla `simbolos`.
-- =========================================================

alter table juegos
  add column if not exists raspa_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.raspa_cfg is
  'Config del motor raspadita: { celdas, simbolos[], tema, fondoUrl, cobertura, celda, animGanar_url, historial, controles }. Ver motor/raspadita.js';

-- ========== 46_instant.sql ==========
-- =========================================================
-- 46 — MOTORES INSTANTÁNEOS: LIMBO + DICE
--
-- Juegos "de una tirada": el servidor tira un número y listo, sin
-- multi-paso ni animación pesada. Los dos comparten el endpoint
-- api/jugar-instant.js (despacha por juego.motor).
--
-- RTP exacto de una sola perilla:
--   Limbo: X = rtp / random(); ganás si X >= objetivo; pago = objetivo.
--   Dice:  roll 0-100; pago = rtp / probabilidad.
--
-- Igual que crash/plinko/raspadita, toda la config vive en jsonb.
-- No usan la tabla `simbolos`.
-- =========================================================

alter table juegos
  add column if not exists limbo_cfg jsonb not null default '{}'::jsonb;

alter table juegos
  add column if not exists dice_cfg jsonb not null default '{}'::jsonb;

comment on column juegos.limbo_cfg is
  'Config del motor limbo: { rtp, tope, objetivoDefecto, tema, fondoUrl }. Ver motor/limbo.js';
comment on column juegos.dice_cfg is
  'Config del motor dice: { rtp, chanceMin, chanceMax, umbralDefecto, direccionDefecto, tema, fondoUrl }. Ver motor/dice.js';

-- ========== 47_fichas.sql ==========
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

-- ========== 48_keno.sql ==========
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

-- ========== 49_torre.sql ==========
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

-- ========== 50_sieteud.sql ==========
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
  'Config del motor sieteud (7 Up 7 Down): { rtp, caras, pagos:{abajo,siete,arriba}, tema, fondoPantallaUrl, fondoUrl, velo, cartelUrl, botonImg, arte:{pantalla,mesa,cartel,boton}, controles }. Ver motor/sieteud.js';

-- ========== 51_mines_tema.sql ==========
-- Tema visual de Mines (paleta / fondo / tipografía). Cosmético:
-- no toca el margen ni el RTP. Default `clasico` = el look de siempre.
alter table juegos
  add column if not exists mines_tema text not null default 'clasico';

-- ========== 52_borde_luz.sql ==========
-- Color del borde que se enciende en los botones con imagen
-- (girar, −, +, x1, x2, x3). Uno por juego, así cada temática
-- tiene el suyo. Vacío = se usa el acento del editor.
alter table juegos
  add column if not exists borde_luz text;

-- ========== 53_planilla_jugabilidad.sql ==========
-- Qué botones muestra el juego y, si Auto tiene imagen propia, cuál.
-- Vacío = se ve todo, como hasta ahora. Apagar uno no toca el RTP.
alter table juegos
  add column if not exists planilla jsonb not null default '{}'::jsonb;

