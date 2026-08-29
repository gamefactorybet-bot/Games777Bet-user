// Reparto determinístico de las tajadas de la Ruleta de
// multiplicadores. Aislado en su propio archivo para que lo puedan
// importar tanto el motor (`ruleta.js`, que carga api/jugar-girar de
// forma dinámica) como el frontend (`src/juego/ruleta.ts`, que lo usa
// para dibujar), sin que el motor entero termine en el bundle del
// cliente.
//
// Primero el multiplicador con más tajadas (repartido parejo sobre
// todos los huecos), después el siguiente sobre los que quedan, y así.
// Mismo input => misma rueda.

const cantDe = (s) => Math.max(0, Math.round(Number(s.peso) || 0));

export function construirRueda(simbolos) {
  const items = (simbolos || [])
    .map((s) => ({ s, cant: cantDe(s) }))
    .filter((it) => it.cant > 0);

  const total = items.reduce((a, it) => a + it.cant, 0);
  const slots = new Array(total).fill(null);

  [...items].sort((a, b) => b.cant - a.cant).forEach((it) => {
    const libres = [];
    for (let k = 0; k < total; k++) if (slots[k] === null) libres.push(k);
    for (let j = 0; j < it.cant; j++) {
      slots[libres[Math.floor(((j + 0.5) * libres.length) / it.cant)]] = it.s;
    }
  });

  return slots;
}
