// Pastilla de volumen dentro del escenario (420×860) o de otro marco.
// El nivel del sonido es de la pestaña. La posición y el tamaño son del juego.

import { alCambiarVolumen, alternarMute, fijarVolumen, volumenActual } from './volumen.ts';

export interface VolumenWidget {
  aplicar(x: number, y: number, tam: number): void;
  destruir(): void;
}

const clamp = (n: number, a: number, b: number) => Math.round(Math.max(a, Math.min(b, n)));

function icono(nivel: number): string {
  const mute = nivel <= 0;
  const bajo = nivel < 0.45;
  const onda = mute
    ? '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 9.5l5 5M21 9.5l-5 5"/>'
    : `<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="${bajo ? 'M16 9.2a4 4 0 0 1 0 5.6' : 'M16 8a6 6 0 0 1 0 8M18.8 5.6a9 9 0 0 1 0 12.8'}"/>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h3.2L12 5.2v13.6L7.2 15H4V9z"/>${onda}</svg>`;
}

export function montarVolumen(host: HTMLElement, opts: {
  x: number;
  y: number;
  tam: number;
  /** Vista previa: se arrastra y la esquina cambia el tamaño. */
  editable: boolean;
  onMover?: (x: number, y: number) => void;
  onTam?: (tam: number) => void;
}): VolumenWidget {
  const raiz = document.createElement('div');
  raiz.className = 'vol vol-esc' + (opts.editable ? ' vol-edit' : '');
  raiz.dataset.volumen = '';
  const rango = document.createElement('input');
  rango.type = 'range';
  rango.min = '0';
  rango.max = '100';
  rango.step = '1';
  rango.setAttribute('aria-label', 'Volumen del juego');
  const btn = document.createElement('button');
  btn.type = 'button';
  raiz.append(rango, btn);
  let asa: HTMLSpanElement | null = null;
  if (opts.editable) {
    asa = document.createElement('span');
    asa.className = 'vol-tam';
    asa.title = 'Tamaño';
    raiz.append(asa);
  }
  host.appendChild(raiz);

  let x = opts.x;
  let y = opts.y;
  let tam = opts.tam;

  const pintarIcono = () => {
    const n = volumenActual();
    btn.innerHTML = icono(n);
    btn.setAttribute('aria-label', n <= 0 ? 'Activar el sonido' : 'Silenciar');
    btn.setAttribute('aria-pressed', n <= 0 ? 'true' : 'false');
    rango.value = String(Math.round(n * 100));
    rango.setAttribute('aria-valuenow', rango.value);
    rango.setAttribute('aria-valuemin', '0');
    rango.setAttribute('aria-valuemax', '100');
  };
  pintarIcono();
  const soltarOyente = alCambiarVolumen(pintarIcono);
  rango.addEventListener('input', () => fijarVolumen(Number(rango.value) / 100));
  btn.addEventListener('click', (e) => { e.stopPropagation(); alternarMute(); });

  const aplicar = (nx: number, ny: number, nt: number) => {
    x = nx;
    y = ny;
    tam = nt;
    raiz.style.left = nx + '%';
    raiz.style.top = ny + '%';
    raiz.style.setProperty('--vol-s', String(nt / 100));
  };
  aplicar(x, y, tam);

  const esUi = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, button');
  const esAsa = (t: EventTarget | null) => !!asa && t instanceof Node && asa.contains(t);

  if (opts.editable && opts.onMover) {
    let drag: { sx: number; sy: number; movio: boolean } | null = null;
    raiz.addEventListener('pointerdown', (e) => {
      if (esUi(e.target) || esAsa(e.target)) return;
      drag = { sx: e.clientX, sy: e.clientY, movio: false };
      raiz.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    raiz.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.movio && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.movio = true;
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const nx = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
      const ny = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
      aplicar(nx, ny, tam);
      opts.onMover!(nx, ny);
    });
    const soltar = () => { drag = null; };
    raiz.addEventListener('pointerup', soltar);
    raiz.addEventListener('pointercancel', soltar);
  }

  if (opts.editable && opts.onTam && asa) {
    let rz: { sx: number; base: number } | null = null;
    asa.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      rz = { sx: e.clientX, base: tam };
      asa!.setPointerCapture(e.pointerId);
    });
    asa.addEventListener('pointermove', (e) => {
      if (!rz) return;
      const nt = clamp(rz.base + (e.clientX - rz.sx) * 0.7, 50, 180);
      aplicar(x, y, nt);
      opts.onTam!(nt);
    });
    const soltar = () => { rz = null; };
    asa.addEventListener('pointerup', soltar);
    asa.addEventListener('pointercancel', soltar);
  }

  return {
    aplicar,
    destruir() {
      soltarOyente();
      raiz.remove();
    },
  };
}
