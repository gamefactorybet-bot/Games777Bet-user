-- Color del borde que se enciende en los botones con imagen
-- (girar, −, +, x1, x2, x3). Uno por juego, así cada temática
-- tiene el suyo. Vacío = se usa el acento del editor.
alter table juegos
  add column if not exists borde_luz text;
