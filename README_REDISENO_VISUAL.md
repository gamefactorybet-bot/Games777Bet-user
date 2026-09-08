# Gameswin777 — rediseño visual v2

Se adaptó el ensamblador existente a una interfaz más moderna, sin reemplazar la arquitectura ni quitar las funciones principales.

## Cambios
- Nueva jerarquía visual para la pantalla **Juegos**.
- Resumen superior con KPIs: Total, Publicados, En prueba y Borradores.
- Barra de búsqueda/filtros con tratamiento visual tipo toolbar.
- Tabla y tarjetas conservan sus acciones existentes.
- Nuevo panel lateral de **Detalle del juego** para consulta rápida, duplicado y acceso al editor.
- Tarjetas con mejor jerarquía, portada, estado y acción rápida de información.
- Sidebar, botones, bordes, sombras, vidrio y responsive refinados.
- No se cambiaron tablas SQL, motores, APIs ni lógica de publicación.
- Se mantiene el editor actual y todas las pantallas existentes.

## Verificación
- `tsc --noEmit` OK
- `vite build` OK
- Build generado en `dist/`

## Instalación
```bash
npm ci
npm run dev
```

Para producción:
```bash
npm run build
npm run preview
```
