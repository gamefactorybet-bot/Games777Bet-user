// Fondo de pantalla: imagen o un loop corto de video (sin sonido).
// La URL vive en el mismo campo (`fondo_pantalla_url` / `fondo_url`).

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg)(\?|#|$)/i;

export const ACCEPT_FONDO = 'image/*,video/mp4,video/webm';
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_SEGS = 8;

export function esVideoFondo(url: string | null | undefined): boolean {
  if (!url) return false;
  return VIDEO_EXT.test(url);
}

export function duracionVideo(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(v.src);
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(v.src);
      reject(new Error('No se pudo leer el video.'));
    };
    v.src = URL.createObjectURL(file);
  });
}

/** null = ok. Texto = por qué no se puede usar. */
export async function validarVideoFondo(file: File): Promise<string | null> {
  if (!file.type.startsWith('video/')) return null;
  if (file.size > MAX_VIDEO_BYTES) {
    return `El video pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Comprimilo a 8 MB o menos (6 s en 720p suele alcanzar).`;
  }
  try {
    const dur = await duracionVideo(file);
    if (dur > MAX_VIDEO_SEGS) {
      return `Dura ${dur.toFixed(1)} s. Recortalo a unos 6 segundos (máximo ${MAX_VIDEO_SEGS}) y que loopée.`;
    }
  } catch {
    return 'No se pudo leer el video. Probá MP4 o WebM.';
  }
  return null;
}

/** Markup de la capa de fondo en el escenario 420×860. */
export function htmlCapaFondo(url: string): string {
  const src = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const estilo = 'position:absolute; object-fit:fill; pointer-events:none';
  if (esVideoFondo(url)) {
    return `<video data-capa-img="fondo_pantalla" src="${src}" autoplay muted loop playsinline webkit-playsinline preload="auto" style="${estilo}"></video>`;
  }
  return `<img data-capa-img="fondo_pantalla" src="${src}" style="${estilo}" />`;
}

export function engancharLoopVideo(el: HTMLElement | null): () => void {
  if (!(el instanceof HTMLVideoElement)) return () => {};
  el.muted = true;
  el.playsInline = true;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.pause();
    el.currentTime = 0;
    return () => {};
  }
  const play = () => { el.play().catch(() => {}); };
  play();
  const vis = () => { document.hidden ? el.pause() : play(); };
  document.addEventListener('visibilitychange', vis);
  return () => {
    document.removeEventListener('visibilitychange', vis);
    el.pause();
  };
}
