# Propuesta: ensamblador = motor + piel

Fecha: 2026-09-09.

La idea del producto: **elegís un motor que ya funciona, le das una
temática y publicás**. Hoy eso solo se siente en el slot 3×3, y aun ahí
arrancás de un lienzo en blanco. El resto de motores arrastra el editor
del slot (herramientas de más, de menos, o rotas).

## Qué está bien (el 3×3)

El clásico 3 rodillos es el único flujo completo:

- Arte: fondo de rodillo, pantalla, marco, cartel, portada, carga.
- Vista previa a tamaño celular con **⚙ Ajustar** de verdad: capas,
  extras (libres, luces, Lottie), controles (girar, saldo, apuesta,
  fichas, turbo), popup de premio y dígitos.
- Jugabilidad: símbolos con ícono + Lottie de premio, tabla de pagos,
  RTP en vivo, simulación de 1M giros, perfiles de RTP y rotación.
- Sonido: música, giro, premio chico, premio grande.
- Efectos CSS de carcasa / premio por nivel (`dos_iguales`, `tres_iguales`).
- Publicar con checklist (íconos, RTP, apuestas, portada).

El 5×3 reutiliza todo eso. Bug: los tiles de RTP del editor analizan
siempre 3 columnas (el publicar sí usa 5).

## Matriz actual (qué sobra / qué falta)

Leyenda: ● completo · ◐ a medias · ○ no aplica o está mal · — no existe

| Motor | Matemática | Arte propio | Layout en vivo | Temas | Presets | Sonido/efectos | RTP en editor |
|---|---|---|---|---|---|---|---|
| Slot 3×3 | ● | ● capas reales | ● AjustePanel completo | — (todo a mano) | — | ● del slot | ● perfiles + rotación |
| Slot 5×3 | ● | ● igual | ● igual | — | — | ● | ◐ tiles usan 3 cols |
| Ruleta | ● | ◐ capas, sin “girar” de slot | ◐ capas+extras | ● 13 paletas | — | ○ labels de slot | ● tajadas |
| Ruleta botones | ● | ◐ | ◐ capas + controles | ● paletas | — | ○ | ● calibrar sorpresa |
| Mines | ● | ◐ textura casilla + capas | ◐ AjusteMines | — **sin temas** | — | ○ giro / dos_iguales | ○ RTP muestra `--` |
| Crash | ● | ◐ objeto/Lottie + capas | ◐ | ● 6 paletas | — | ○ | ● |
| Plinko | ● | ◐ | ◐ | ● 5 paletas | — | ○ | ● |
| Raspadita | ● | ◐ | ◐ | ● 4 paletas | — | ○ | ● |
| Keno | ● | ◐ | ◐ | ● 4 paletas | — | ○ | ● |
| Torre | ● | ● casillas + Lottie | ◐ | ● 4 paletas | — | ○ | ● escalera |
| Limbo | ● | ○ InstantShell, **sin capas** | — no hay ⚙ posición | ● 10 paletas | — | ○ | ● slider |
| Dice | ● | ○ igual que Limbo | — | ● mismas 10 | — | ○ | ● |
| 7 Up 7 Down | ● | ● piezas + imágenes + estilo | ● **el mejor** | ● + estilos | ● **único con presets** | ◐ | ● en la preview |

### Fallos que se arrastran

1. **Crear juego = vacío.** Nombre + motor. Cero piel, cero layout, cero
   símbolos de ejemplo. El 3×3 “completo” igual te obliga a subir 6
   imágenes y colocar cada capa a mano antes de verse como un juego.
2. **Temas tiesos.** En Crash/Plinko/etc. un tema es paleta CSS + fuente
   de Google + un `deco` HTML. No trae arte, no mueve controles, no
   guarda un diseño tuyo. Clásico / Neón / Océano se copian de un juego
   a otro. Mines ni siquiera tiene selector.
3. **Herramientas de slot en juegos que no son slot.** Pestaña Sonido
   siempre pide “Sonido de giro”. Efectos disparan por `dos_iguales` /
   `tres_iguales`. El checklist de publicar avisa si el botón Girar
   quedó fuera… en Torre/Crash/Limbo. `AjustePanel` se llama con
   `esMines` en Crash, Plinko, Keno, Torre, raspadita (un flag que miente).
4. **Dos cerebros.** Ficha General/Arte/Jugabilidad a la izquierda;
   la piel de verdad vive en ⚙ de la preview. En 7up7 lo dijeron
   explícito: “se configura en la Vista previa”. En Limbo/Dice no hay
   preview de layout: no podés mover el número ni el botón.
5. **Catálogo incompleto.** Keno, Torre y 7up7 al tocarlos caen en la
   preview de slot (piden símbolos que no tienen).
6. **Nombres cortos.** La tabla de juegos no etiqueta raspadita, limbo,
   dice, keno, torre, 7up7.
7. **Ajuste\*Controles copiados 7 veces** (Mines, Crash, Plinko, Raspa,
   Keno, Torre, Ruleta): mismo slider de x/y/tamaño, misma subida de
   imagen de botón. Cada motor nuevo copia 80 líneas.
8. **7up7 es el norte y está aislado.** Piezas, retoque de imagen,
   estilo, presets visuales que **no tocan el RTP**. Ningún otro motor
   heredó ese modelo.

## Modelo que queremos: Motor + Piel

Dos capas, nunca mezcladas:

```
MOTOR  →  reglas, RTP, qué controles existen
PIEL   →  tema de fábrica + tus overrides (arte, layout, sonido)
```

Aplicar una piel **nunca** cambia pagos, pesos ni RTP. Ya es la garantía
de los presets de 7up7; hay que generalizarla.

### Familias (no 13 editores)

Tres familias, no un `if` por motor:

| Familia | Motores | Qué se edita en la preview |
|---|---|---|
| **Rodillos** | 3×3, 5×3, ruleta | capas + grilla/rueda + símbolos + premio + luces |
| **Mesa** | mines, crash, plinko, raspadita, keno, torre, ruleta-botones | escenario + arrastrar controles propios + casillas/objeto |
| **Instant** | limbo, dice, 7up7 | escena React (como 7up7): piezas, estilo, presets |

Limbo y Dice entran a Instant de verdad: hoy son un número gigante en
un shell rígido. Deberían poder moverse, cambiar tipografía y fondo
como 7up7.

### Al crear un juego

Hoy: nombre + motor → editor vacío.

Propuesto:

1. Elegís **familia / motor** (Slot 3×3, Mines, Crash…).
2. Elegís **piel de fábrica** con miniatura: Frutas, Oro, Neón, Vegas,
   Mazmorra… según el motor. “En blanco” sigue existiendo.
3. El juego nace **jugable en la preview**: layout default, paleta,
   y en slots un set de símbolos placeholder (o el pack de frutas si
   esa es la piel).
4. Entras directo a la preview a tamaño celular. El formulario de
   General (nombre, apuestas, publicar) queda como ficha, no como el
   lugar donde se diseña.

### Piel de fábrica vs preset propio

- **Piel de fábrica:** código, versionada con el repo. Paleta + layout
  default + (opcional) URLs de arte de ejemplo. No es un PNG de 4 MB
  por tema: es un mapa de posiciones + colores. El arte de ejemplo
  puede vivir en el bucket `assets/pieles/<id>/`.
- **Preset propio:** lo que ya hace 7up7. Guardás la composición
  actual con nombre. Aplicar reemplaza la piel, no la matemática.
  Llevar esto a rodillos y mesas.

Selector único, no un grid de botones distinto en cada `Seccion*`.

### Qué se ve según el motor (y qué se esconde)

Una tabla de capacidades, no flags sueltos en `Editor.tsx`:

```
sonidos:  slot → musica, giro, premio_chico, premio_mayor
          mesa → musica, tap, win, lose
          instant → musica, win, lose

efectos:  slot → carcasa + premio por cadena
          mesa/instant → carcasa + win/lose (sin dos_iguales)

capas:    rodillos/mesa → fondo, marco, cartel, libres, luces
          instant → no (la escena React es la capa)

controles: los que declara el motor (girar vs retirar vs raspar)
```

El checklist de publicar usa la misma tabla. Adiós al aviso del botón
Girar en un Limbo.

### Un solo lugar para diseñar: la preview

El editor de ficha se achica:

- **General** — nombre, estado, apuestas, clientes, publicar.
- **Juego** — RTP, símbolos / minas / escalera / pool. Números, no pixels.
- **▶ Vista previa** — acá vive Arte + Piel + Layout + Sonido, en vivo.

Es el modelo 7up7, para todos. Las pestañas Arte/Sonido/Efectos del
Editor actual se mueven al panel ⚙ de la preview, con categorías que
el motor declara.

### Packs para el 3×3 (lo que más falta ahí)

El 3×3 no necesita otro motor. Necesita **empezar vestido**:

- Piel “Frutas”: 8 símbolos con íconos, pagos coherentes a RTP ~94%,
  marco y cartel de ejemplo, luces básicas.
- Piel “Oro / Egipto / Neón”: misma matemática, otro set de íconos y
  paleta.
- “En blanco” para quien quiere 100% custom.

Sin eso, fabricar un slot sigue siendo un trabajo de arte, no de
ensamblado. Con eso, el motor 3×3 se vuelve la herramienta que ya es
en matemática.

## Orden de trabajo (cuando se implemente)

No es este paso. El code-split va primero. Después, en PRs chicos:

1. **Capacidades por familia** — esconder sonido/efectos/girar que no
   aplican. Barato, saca ruido ya.
2. **Catálogo + nombres cortos** — Keno/Torre/7up7 abren su preview.
3. **Selector de piel único** + temas para Mines. Limbo/Dice no ganan
   layout todavía, pero el selector deja de estar copiado 8 veces.
4. **Kits al crear** para 3×3 (pack frutas) y un default de mesa.
5. **Presets propios** (copiar el de 7up7) a Crash/Torre/Mines.
6. **Limbo/Dice como Instant de verdad** — piezas movibles, no el shell
   rígido.
7. **Un `AjusteControles` genérico** — se acaba la copia de 7 archivos.

Hobby no se toca: cero funciones nuevas, cero env nuevas. Las pieles
son JSON + archivos en Storage.

## Qué no hacer

- Un editor visual tipo Figma. Sobran sliders sobre la preview.
- Temas que cambien el RTP.
- Un skin distinto (código React) por cada temática. La temática es
  datos; el motor es el código.
- Esperar a “terminar todos los motores” para unificar. El 3×3 ya es
  el molde; el resto se acerca a él, no al revés.
