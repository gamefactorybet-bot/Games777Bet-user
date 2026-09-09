# Plan de optimización — fábrica gameswin777

Fecha: 2026-09-09. Este proyecto es **solo la fábrica/proveedor**.
El panel de administración y el portal del jugador son otras páginas.
El portal abre `launch_url` (`/jugar.html?slug=…&token=…`). El admin
sincroniza con `GET /api/catalogo`.

## Techo de Vercel Hobby

No son las variables de entorno (acá hay 5). El techo real:

> Vite: cada archivo en `/api` = 1 Vercel Function.
> Hobby: **12 funciones por deploy**.

Hoy hay **11**. Un endpoint más por motor rompe el deploy.

Env que se reutilizan en todas las funciones:

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WIN777_PROVEEDOR_SECRETO` / `WIN777_API_BASE`

No partir esto en 3 proyectos Vercel.

## Qué sí (no gasta funciones)

1. `import()` / `React.lazy` por motor en `Jugar.tsx` — el iframe del portal
   no baja Crash+Plinko+dados para abrir un Mines.
2. `lazy` del ensamblador: Editor, Catálogo, Clientes, Apariencia, cada Preview.
3. Comprimir portadas/fondos al subir (WebP). Mismo bucket.
4. El 12º juego de un tiro entra en `jugar-instant.js` (ya despacha limbo/dice/keno/7up7).

## Qué no

- Un Vercel para fábrica, otro para `/jugar`, otro para APIs.
- `/api/keno.js`, `/api/dice.js`, etc.
- Next.js solo para bundlear funciones.

## Backend más adelante (libera cupo, no ahora)

De 11 funciones a 5, copiando el patrón de `jugar-instant.js`:

| Función | Cubre |
|---|---|
| `catalogo` | sync del admin |
| `jugar-datos` | arte del iframe |
| `jugar-balance` | saldo |
| `jugar` | un tiro: slots, ruletas, plinko, raspadita, instant |
| `partida` | varios pasos: mines, crash, torre |

El `launch_url` no cambia. El portal no se entera.

## Orden

1. Code-split de `Jugar.tsx` y del ensamblador (este paso).
2. No sumar archivos en `/api`.
3. Fusionar a `jugar` + `partida` cuando haga falta un motor de varios pasos.
4. WebP al subir y partir `Editor.tsx` (confort del ensamblador).
