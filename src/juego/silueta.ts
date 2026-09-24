// El clic sigue el dibujo, no el rectángulo del botón. Si no se puede
// leer el píxel (el archivo no deja), el clic vale en todo el botón.

const UMBRAL = 28;

type Cache = { url: string; canvas: HTMLCanvasElement | null };
const caches = new WeakMap<HTMLImageElement, Cache>();

function lienzoDe(img: HTMLImageElement): HTMLCanvasElement | null {
  if (!img.naturalWidth) return null;
  const previa = caches.get(img);
  if (previa && previa.url === img.currentSrc) return previa.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let usable: HTMLCanvasElement | null = null;
  if (ctx) {
    try {
      ctx.drawImage(img, 0, 0);
      ctx.getImageData(0, 0, 1, 1);
      usable = canvas;
    } catch { /* origen cruzado: no hay silueta, queda el rectángulo */ }
  }
  caches.set(img, { url: img.currentSrc, canvas: usable });
  return usable;
}

/** true = píxel opaco, false = hueco, null = no se pudo leer. */
export function alphaEn(img: HTMLImageElement, clientX: number, clientY: number): boolean | null {
  const canvas = lienzoDe(img);
  if (!canvas) return null;
  const r = img.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  const x = Math.floor(((clientX - r.left) / r.width) * canvas.width);
  const y = Math.floor(((clientY - r.top) / r.height) * canvas.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return ctx.getImageData(x, y, 1, 1).data[3] >= UMBRAL;
}

/** Carga la imagen pidiendo permiso para leer sus píxeles. Si el
 *  servidor no lo da, se reintenta sin eso para que al menos se vea. */
/** El lado más largo queda en `lado` px. La otra medida sigue el archivo. */
export function medidaImagen(ancho: number, alto: number, lado: number): { w: number; h: number } {
  const w0 = Math.max(1, ancho);
  const h0 = Math.max(1, alto);
  const esc = lado / Math.max(w0, h0);
  return { w: Math.max(8, Math.round(w0 * esc)), h: Math.max(8, Math.round(h0 * esc)) };
}

/** Ajusta el <img> a su proporción. Si todavía no cargó, lo hace al cargar. */
export function encajarImagen(img: HTMLImageElement, lado: number) {
  const aplicar = () => {
    if (!img.naturalWidth) {
      img.style.width = lado + 'px';
      img.style.height = 'auto';
      return;
    }
    const { w, h } = medidaImagen(img.naturalWidth, img.naturalHeight, lado);
    img.style.width = w + 'px';
    img.style.height = h + 'px';
  };
  img.onload = () => aplicar();
  aplicar();
}

export function asignarImagen(img: HTMLImageElement, url: string) {
  if (img.dataset.url === url && img.getAttribute('src')) return;
  img.dataset.url = url;
  img.crossOrigin = 'anonymous';
  img.onerror = () => {
    if (img.crossOrigin) {
      img.removeAttribute('crossorigin');
      img.src = url;
    }
  };
  img.src = url;
}

export function engancharSilueta(btn: HTMLElement, img: HTMLImageElement) {
  if (btn.dataset.siluetaOn) return;
  btn.dataset.siluetaOn = '1';
  const filtrar = (e: Event) => {
    if (btn.dataset.forma !== '1') return;
    const pe = e as PointerEvent;
    if (!Number.isFinite(pe.clientX)) return;
    if (alphaEn(img, pe.clientX, pe.clientY) === false) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  btn.addEventListener('pointerdown', filtrar, true);
  btn.addEventListener('click', filtrar, true);
}
