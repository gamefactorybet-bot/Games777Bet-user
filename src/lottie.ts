// =========================================================
// ANIMACIONES CON LOTTIE
//
// Compartido entre el ensamblador (Preview) y la pantalla real del
// jugador (Jugar) — misma decisión que el motor unificado y las
// luces: una sola copia, para que no se desincronicen.
//
// Reemplaza a Rive (que dejó de permitir exportar el .riv en el plan
// gratuito). Diferencia clave de diseño: Lottie no tiene disparadores
// con nombre — es un reproductor lineal que avisa con un evento
// "complete" cuando termina. Eso simplifica bastante todo esto.
//
// Alcance, igual que antes:
//   - Símbolos: solo sobre celdas YA FRENADAS que ganaron, nunca
//     durante el relleno del giro. Dos archivos por símbolo (uno
//     para premio chico, otro para premio mayor).
//   - Animaciones del juego: intro (antes de la carga), y las que
//     acompañan girar/premio chico/premio mayor, posicionables
//     libremente en la pantalla.
// =========================================================

import type { DotLottie } from '@lottiefiles/dotlottie-web';
import type { AnimacionLottie, Simbolo } from './types.ts';

type ModuloLottie = typeof import('@lottiefiles/dotlottie-web');

let dotLottiePromise: Promise<ModuloLottie> | null = null;
// La librería se carga recién la primera vez que hace falta: un
// juego sin animaciones no paga el costo de bajarla.
function cargarLottie(): Promise<ModuloLottie> {
  if (!dotLottiePromise) dotLottiePromise = import('@lottiefiles/dotlottie-web');
  return dotLottiePromise;
}

/**
 * Prepara el motor de Lottie (baja y compila el WASM que dibuja las
 * animaciones) ANTES de que haga falta reproducir la primera. Se usa
 * durante la pantalla de carga del jugador, igual que las imágenes y
 * los sonidos — así el primer símbolo que gana no se queda esperando
 * a que el motor termine de prepararse en ese instante.
 */
export async function precargarLottie(): Promise<void> {
  const { DotLottie } = await cargarLottie();
  await DotLottie.preload?.();
}

// =========================================================
// Símbolos ganadores
// =========================================================

// celda del DOM -> { revertir }
const instanciasSimbolo = new Map<Element, { revertir: () => void }>();

/**
 * Muestra la animación Lottie del símbolo ENCIMA de lo que ya hay en
 * la celda (sin borrarlo) y la reproduce una vez. Al terminar, saca
 * la animación y destapa exactamente lo que había — nunca reconstruye
 * ni le exige a quien llama que le pase el HTML de vuelta.
 *
 * Si el símbolo no tiene animación para ese nivel, no hace nada — la
 * celda se queda como estaba, como si esto no existiera.
 */
export async function animarSimboloGanador(
  celdaEl: HTMLElement,
  simbolo: Simbolo | null | undefined,
  nivel: string,
): Promise<void> {
  const url = nivel === 'premio_mayor' ? simbolo?.lottie_grande_url : simbolo?.lottie_chico_url;
  if (!url) return;

  // Si esta celda ya tenía una animación corriendo (giro nuevo antes
  // de que termine la anterior), se corta primero — revertir() deja
  // todo destapado antes de tapar de nuevo.
  const previa = instanciasSimbolo.get(celdaEl);
  if (previa) previa.revertir();

  let DotLottie: ModuloLottie['DotLottie'];
  try {
    ({ DotLottie } = await cargarLottie());
  } catch {
    return; // sin internet para bajar la librería: se queda como estaba
  }

  // Se tapa (display:none), nunca se borra — así lo que sea que haya
  // adentro (imágenes fijas o reconstruidas) sigue intacto debajo.
  const hijosPrevios = Array.from(celdaEl.children) as HTMLElement[];
  hijosPrevios.forEach((el) => {
    el.dataset.lottieDisplayPrevio = el.style.display;
    el.style.display = 'none';
  });

  const canvas = document.createElement('canvas');
  canvas.width = celdaEl.clientWidth || 64;
  canvas.height = celdaEl.clientHeight || 64;
  canvas.style.cssText = 'width:100%; height:100%; display:block';
  celdaEl.appendChild(canvas);

  let instancia: DotLottie;
  let tope: ReturnType<typeof setTimeout>;

  const revertir = () => {
    clearTimeout(tope);
    instancia.destroy();
    canvas.remove();
    hijosPrevios.forEach((el) => {
      el.style.display = el.dataset.lottieDisplayPrevio || '';
      delete el.dataset.lottieDisplayPrevio;
    });
    instanciasSimbolo.delete(celdaEl);
  };

  instancia = new DotLottie({
    canvas, src: url, autoplay: true, loop: false,
    layout: { fit: 'contain' },
  });
  // El evento real de finalización manda; el setTimeout de abajo es
  // solo el respaldo de seguridad si por lo que sea nunca llega.
  instancia.addEventListener('complete', revertir);
  instancia.addEventListener('loadError', revertir);

  tope = setTimeout(revertir, 4000);
  instanciasSimbolo.set(celdaEl, { revertir });
}

// Corta todas las animaciones de símbolo activas ya mismo — se usa
// al arrancar un giro nuevo o al cerrar la vista previa.
export function detenerAnimacionesSimbolos(): void {
  Array.from(instanciasSimbolo.values()).forEach(({ revertir }) => revertir());
  instanciasSimbolo.clear();
}

// =========================================================
// Lottie genérico dentro de un contenedor (caras de casilla de Mines)
// =========================================================

const prefiereMenosMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Monta una animación Lottie que ocupa todo `contenedor` (un `<canvas>`
 * al 100%). Devuelve una función para desmontarla. Con `loop` corre
 * indefinidamente; si no, una vez y se queda en el último cuadro.
 * Respeta `prefers-reduced-motion` (no reproduce, muestra el final).
 */
export async function montarLottieEn(
  contenedor: HTMLElement,
  url: string,
  opciones: { loop?: boolean } = {},
): Promise<() => void> {
  let DotLottie: ModuloLottie['DotLottie'];
  try {
    ({ DotLottie } = await cargarLottie());
  } catch {
    return () => {};
  }

  const canvas = document.createElement('canvas');
  const rect = contenedor.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(2, Math.round((rect.width || 64) * dpr));
  canvas.height = Math.max(2, Math.round((rect.height || 64) * dpr));
  canvas.style.cssText = 'width:100%; height:100%; display:block';
  contenedor.appendChild(canvas);

  const quieto = prefiereMenosMovimiento();
  const instancia = new DotLottie({
    canvas, src: url,
    autoplay: !quieto,
    loop: !quieto && !!opciones.loop,
    layout: { fit: 'contain' },
  });
  if (quieto) {
    instancia.addEventListener('load', () => {
      try { instancia.setFrame(instancia.totalFrames - 1); } catch { /* noop */ }
    });
  }

  return () => {
    try { instancia.destroy(); } catch { /* noop */ }
    canvas.remove();
  };
}

// =========================================================
// Animaciones del juego (intro / girar / premio)
// =========================================================

const ANCHO_ESC = 420;
const activasJuego = new Set<() => void>(); // funciones "cortar" de cada una

/**
 * Muestra una animación del juego dentro de "contenedor", en la
 * posición y tamaño configurados, y la reproduce una vez.
 *
 * Si "alTerminar" viene dado, se llama cuando la animación termina —
 * así la intro puede encadenar con la pantalla de carga sin inventar
 * un tiempo fijo. Se limpia sola (canvas + instancia) apenas termina,
 * con un tope de seguridad por si el archivo nunca avisa.
 */
export async function mostrarAnimacionJuego(
  contenedor: HTMLElement,
  cfg: Partial<AnimacionLottie> | null | undefined,
  alTerminar?: () => void,
): Promise<() => void> {
  if (!cfg?.lottie_url) { alTerminar?.(); return () => {}; }

  let DotLottie: ModuloLottie['DotLottie'];
  try {
    ({ DotLottie } = await cargarLottie());
  } catch {
    alTerminar?.(); // sin la librería, se sigue de largo
    return () => {};
  }

  const caja = document.createElement('div');
  const ancho = (cfg.tamano ?? 60) / 100 * ANCHO_ESC;
  caja.style.cssText = `position:absolute; left:${cfg.x ?? 50}%; top:${cfg.y ?? 50}%;`
    + `width:${ancho}px; height:${ancho}px; transform:translate(-50%,-50%);`
    + 'pointer-events:none; z-index:14;';

  const canvas = document.createElement('canvas');
  canvas.width = ancho; canvas.height = ancho;
  canvas.style.cssText = 'width:100%; height:100%; display:block';
  caja.appendChild(canvas);
  contenedor.appendChild(caja);

  let avisado = false;
  const avisarFin = () => { if (!avisado) { avisado = true; alTerminar?.(); } };

  let instancia: DotLottie;
  let topeSeguridad: ReturnType<typeof setTimeout>;

  const cortar = () => {
    clearTimeout(topeSeguridad);
    instancia.destroy();
    caja.remove();
    activasJuego.delete(cortar);
  };

  instancia = new DotLottie({
    canvas, src: cfg.lottie_url, autoplay: true, loop: false,
    layout: { fit: 'contain' },
  });
  instancia.addEventListener('complete', () => { cortar(); avisarFin(); });
  instancia.addEventListener('loadError', () => { cortar(); avisarFin(); });

  // Respaldo: si el evento real nunca llega, esto no puede dejar a
  // quien esperaba (sobre todo la intro) colgado para siempre.
  topeSeguridad = setTimeout(() => { cortar(); avisarFin(); }, 6000);

  activasJuego.add(cortar);
  return cortar;
}

export function detenerAnimacionesJuego(): void {
  activasJuego.forEach((cortar) => cortar());
  activasJuego.clear();
}
