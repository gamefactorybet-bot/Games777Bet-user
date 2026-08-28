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
