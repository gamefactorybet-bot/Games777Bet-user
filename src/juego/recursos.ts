// Carga de datos y precarga de recursos de la pantalla del jugador.
// Extraído de `jugar.js` — lógica pura, sin DOM salvo `Image`/`Audio`.

import { precargarLottie, mostrarAnimacionJuego, detenerAnimacionesJuego } from '../lottie.ts';
import { esVideoFondo } from './fondo.ts';
import type { AnimacionLottie, DatosJuego } from '../types.ts';

export async function fetchJson<T = unknown>(url: string, opciones?: RequestInit): Promise<T> {
  const res = await fetch(url, opciones);

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const detalle =
      (data?.error as string) ||
      (data?.message as string) ||
      `El servidor respondió con HTTP ${res.status}`;
    throw new Error(`Error ${res.status}: ${detalle}`);
  }

  return data as T;
}

/**
 * Espera a que bajen imágenes Y sonidos Y animaciones Lottie. El
 * progreso es real: cuenta archivos terminados, no un temporizador.
 *
 * TOPE DE SEGURIDAD: pasados los 15 segundos entra igual. Un archivo
 * roto o un audio que nunca termina no puede dejar al jugador mirando
 * una pantalla de carga para siempre.
 */
export function esperarRecursos(
  datos: DatosJuego,
  avance: (hechos: number, total: number) => void,
): Promise<unknown> {
  const { juego, simbolos, sonidos, digitos, capasLibres, botones, animaciones } = datos;

  const medios = [
    juego.fondo_url, juego.fondo_pantalla_url, juego.marco_url, juego.cartel_url,
    juego.girar_imagen_url, juego.saldo_fondo_url, juego.apuesta_fondo_url,
    ...simbolos.map((s) => s.icono_url),
    ...(digitos || []).map((d) => d.imagen_url),
    ...(capasLibres || []).map((c) => c.imagen_url),
    ...(botones || []).map((b) => b.imagen_url),
  ].filter(Boolean) as string[];
  const imagenes = medios.filter((u) => !esVideoFondo(u));
  const videos = medios.filter((u) => esVideoFondo(u));

  const audios = (sonidos || []).map((s) => s.archivo_url).filter(Boolean) as string[];

  // Los .json/.lottie de cada símbolo y los de las animaciones del
  // juego se bajan ACÁ, no recién cuando hay que reproducirlos (que
  // sería justo en medio del festejo de un premio). Se dedupean
  // porque el mismo archivo puede repetirse en varios símbolos.
  const lottieUrls = [...new Set([
    ...simbolos.flatMap((s) => [s.lottie_chico_url, s.lottie_grande_url]),
    ...(animaciones || []).map((a) => a.lottie_url),
  ].filter(Boolean) as string[])];

  const total = imagenes.length + videos.length + audios.length + lottieUrls.length + (lottieUrls.length ? 1 : 0);
  if (!total) { avance(1, 1); return Promise.resolve(); }

  let hechos = 0;
  const marcar = () => { hechos++; avance(hechos, total); };

  const tareas: Promise<unknown>[] = [
    ...imagenes.map((url) => new Promise<void>((listo) => {
      const img = new Image();
      // onerror también resuelve: una imagen rota no debe trabar todo.
      img.onload = img.onerror = () => { marcar(); listo(); };
      img.src = url;
    })),
    ...videos.map((url) => new Promise<void>((listo) => {
      const v = document.createElement('video');
      const fin = () => { marcar(); listo(); };
      v.addEventListener('canplaythrough', fin, { once: true });
      v.addEventListener('error', fin, { once: true });
      v.muted = true;
      v.preload = 'auto';
      v.src = url;
    })),
    ...audios.map((url) => new Promise<void>((listo) => {
      const a = new Audio();
      const fin = () => { marcar(); listo(); };
      a.addEventListener('canplaythrough', fin, { once: true });
      a.addEventListener('error', fin, { once: true });
      a.preload = 'auto';
      a.src = url;
    })),
    ...lottieUrls.map((url) => new Promise<void>((listo) => {
      // Alcanza con bajar los bytes al caché del navegador.
      fetch(url).then((r) => r.blob()).catch(() => {}).finally(() => { marcar(); listo(); });
    })),
    // El motor de Lottie (el WASM que dibuja) se prepara acá solo si el
    // juego realmente tiene alguna animación.
    ...(lottieUrls.length ? [
      precargarLottie().catch(() => {}).finally(marcar),
    ] : []),
  ];

  return Promise.race([
    Promise.all(tareas),
    new Promise((listo) => setTimeout(listo, 15000)),
  ]);
}

/**
 * Corre la animación de intro por encima de la pantalla de carga, y
 * devuelve el control cuando la animación terminó su pasada.
 *
 * TOPE DE 2,5 SEGUNDOS: si alguien sube por error una animación larga,
 * o el archivo nunca avisa que terminó, la entrada al juego no puede
 * quedar trabada esperándola.
 */
export function correrIntro(cfg: AnimacionLottie, pantallaEl: HTMLElement): Promise<void> {
  return new Promise((listo) => {
    // La animación se posiciona en % de la pantalla del juego (420x860),
    // así que la capa que la contiene tiene que tener esa forma y
    // escalarse igual.
    const escala = Math.min(window.innerWidth / 420, window.innerHeight / 860);
    const capa = document.createElement('div');
    capa.style.cssText = 'position:absolute; left:50%; top:50%; width:420px; height:860px;'
      + `transform:translate(-50%,-50%) scale(${escala}); z-index:2; pointer-events:none;`;
    pantallaEl.appendChild(capa);

    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(tope);
      capa.style.transition = 'opacity .3s';
      capa.style.opacity = '0';
      setTimeout(() => { detenerAnimacionesJuego(); capa.remove(); }, 320);
      listo();
    };

    const tope = setTimeout(cerrar, 2500);
    mostrarAnimacionJuego(capa, cfg, cerrar);
  });
}
