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
