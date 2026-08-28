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
