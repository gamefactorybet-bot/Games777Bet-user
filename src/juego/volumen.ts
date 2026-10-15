// Volumen de todos los juegos de esta pestaña. 0 es silencio.
// Se guarda en el navegador para que el siguiente juego arranque igual.

const CLAVE = 'gf-volumen';

type Oyente = (nivel: number) => void;

const audios = new Set<HTMLAudioElement>();
const propio = new WeakMap<HTMLAudioElement, number>();
const oyentes = new Set<Oyente>();

function guardar(nivel: number) {
  try { localStorage.setItem(CLAVE, String(nivel)); } catch { /* modo privado */ }
}

function leer(): number {
  try {
    const n = Number(localStorage.getItem(CLAVE));
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  } catch { /* modo privado */ }
  return 1;
}

let nivel = typeof localStorage === 'undefined' ? 1 : leer();
let antesDeMute = nivel > 0 ? nivel : 1;

function aplicar() {
  for (const a of audios) a.volume = (propio.get(a) ?? 1) * nivel;
  for (const fn of oyentes) fn(nivel);
  guardar(nivel);
}

export function volumenActual(): number {
  return nivel;
}

export function fijarVolumen(v: number): void {
  const n = Math.min(1, Math.max(0, v));
  if (n > 0) antesDeMute = n;
  nivel = n;
  aplicar();
}

export function alternarMute(): void {
  if (nivel > 0) {
    antesDeMute = nivel;
    nivel = 0;
  } else {
    nivel = antesDeMute > 0 ? antesDeMute : 1;
  }
  aplicar();
}

export function alCambiarVolumen(fn: Oyente): () => void {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

/** `base` es el volumen propio del clip (la música de fondo usa 0.45). */
export function registrarAudio(a: HTMLAudioElement, base = 1): void {
  propio.set(a, base);
  a.volume = base * nivel;
  audios.add(a);
}
