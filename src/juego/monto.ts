// Dibuja el monto ganado carácter por carácter: si el carácter tiene
// un ícono subido lo muestra como imagen (sin deformar, alto fijo,
// ancho automático); si no, cae en texto normal — así nunca falta un
// carácter aunque todavía no se hayan subido todos los íconos.
//
// Reutiliza los elementos que ya están en pantalla en vez de borrarlos
// y crearlos de nuevo: con el contador del premio corriendo esto se
// llama muchas veces por segundo, y recrear imágenes en cada paso
// trababa la pantalla justo en el momento de ganar.
//
// Compartido entre Preview y Jugar (antes estaba copiado en los dos).

export function pintarMonto(
  elemento: HTMLElement,
  texto: string,
  alto: number,
  espaciado: number,
  mapaDigitos: Record<string, string>,
): void {
  elemento.style.display = 'flex';
  elemento.style.alignItems = 'flex-end';
  elemento.style.flexWrap = 'nowrap';
  elemento.style.gap = espaciado + 'px';

  const caracteres = [...texto];
  const hijos = elemento.children;

  caracteres.forEach((c, i) => {
    const url = mapaDigitos[c];
    const tipo = url ? 'IMG' : 'SPAN';
    let el = hijos[i] as HTMLElement | undefined;

    // Solo se crea un elemento nuevo si no había uno, o si cambió de
    // tipo (de imagen a texto o al revés).
    if (!el || el.tagName !== tipo) {
      const nuevoEl = document.createElement(url ? 'img' : 'span');
      if (el) elemento.replaceChild(nuevoEl, el);
      else elemento.appendChild(nuevoEl);
      el = nuevoEl;
    }

    if (url) {
      if (el.getAttribute('src') !== url) el.setAttribute('src', url);
      el.style.cssText = `height:${alto}px; width:auto; display:block`;
    } else {
      if (el.textContent !== c) el.textContent = c;
      el.style.cssText = 'font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5)';
    }
  });

  // Si el número se acortó (por ejemplo de 1.000 a 999), sobran
  // elementos al final: se quitan.
  while (hijos.length > caracteres.length) elemento.removeChild(elemento.lastChild!);
}
