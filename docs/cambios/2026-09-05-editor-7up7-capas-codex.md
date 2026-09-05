# Editor de escena: 7 Up 7 Down — etapa 1

**Autor:** Codex  
**Fecha:** 5 de septiembre de 2026

## Alcance

Se incorporaron herramientas base de composición para que el editor visual de 7 Up 7 Down sea más preciso y seguro al construir una pantalla.

## Implementado

- Panel de capas para las nueve piezas de la escena.
- Selección directa de cada capa desde el panel o desde el teléfono.
- Mostrar u ocultar una pieza; la visibilidad se respeta también al jugar.
- Bloquear piezas para impedir que se arrastren o redimensionen accidentalmente.
- Guías centrales y cuadrícula visible durante la edición.
- Ajuste magnético opcional a una cuadrícula de 2,5 % al arrastrar.
- Acciones para centrar horizontal o verticalmente la pieza seleccionada.
- Historial local de posición con deshacer y rehacer.

## Compatibilidad

Las preferencias se guardan en `sieteud_cfg.editor`. Las configuraciones existentes reciben valores seguros por defecto: ninguna pieza oculta o bloqueada y ajuste a grilla activado.

## Validación

`npm run build` finalizó correctamente. El aviso de tamaño de bundle de Vite no corresponde a esta modificación.
