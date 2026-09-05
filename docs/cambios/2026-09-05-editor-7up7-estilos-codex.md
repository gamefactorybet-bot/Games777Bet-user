# Editor visual: 7 Up 7 Down — etapa 2

**Autor:** Codex  
**Fecha:** 5 de septiembre de 2026

## Objetivo

Permitir que las zonas de apuesta y el botón de tirar tengan una identidad propia por juego, independientemente del tema general.

## Implementado

- Nueva pestaña **Estilo** en el editor de 7 Up 7 Down.
- Colores independientes para el fondo, borde, texto y acento de las zonas.
- Estados visuales de zona: normal, seleccionada, ganadora y perdedora.
- Ajustes de redondez, sombra activa y escala tipográfica de zonas.
- Colores del botón de tirar: activo, texto, borde y bloqueado.
- Ajustes de redondez, sombra y escala tipográfica del botón.
- Los estilos se actualizan en vivo y se persisten en `sieteud_cfg.estilos`.

## Compatibilidad

Las configuraciones anteriores reciben un estilo clásico equivalente al diseño previo. Esta configuración es únicamente visual y no modifica RTP, pagos ni el resultado de los dados.

## Validación

`npm run build` terminó sin errores. El aviso de tamaño de bundle de Vite es independiente de este cambio.
