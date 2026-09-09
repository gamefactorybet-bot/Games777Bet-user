-- Tema visual de Mines (paleta / fondo / tipografía). Cosmético:
-- no toca el margen ni el RTP. Default `clasico` = el look de siempre.
alter table juegos
  add column if not exists mines_tema text not null default 'clasico';
