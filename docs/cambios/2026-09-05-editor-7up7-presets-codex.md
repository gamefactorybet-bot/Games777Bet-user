# Editor visual: 7 Up 7 Down — etapa 3

**Autor:** Codex  
**Fecha:** 5 de septiembre de 2026

## Objetivo

Reutilizar la identidad visual de 7 Up 7 Down sin volver a configurar cada
pieza, imagen y color manualmente.

## Implementado

- Pestaña **Presets** dentro del editor visual.
- Cuatro diseños base: Clásico, Neón, Casino y Minimalista.
- Guardado de presets propios con nombre.
- Actualización, renombrado y eliminación de presets propios.
- Cada preset propio conserva composición, visibilidad, imágenes, retoques,
  tema y estilos de controles.
- Muestra compacta de la paleta de cada preset y aplicación confirmada.
- Restablecimiento independiente de piezas, imágenes o estilo al diseño
  clásico.

## Garantías

Los presets se almacenan en `sieteud_cfg.presets`. Sólo contienen datos
visuales: aplicar uno no cambia RTP, caras por dado, pagos ni resultados.
Las configuraciones existentes reciben una lista vacía de presets de forma
compatible.

## Validación

Se ejecutaron correctamente `npm run typecheck` y `npm run build`. Vite sólo
informó el aviso existente de tamaño de bundle.
