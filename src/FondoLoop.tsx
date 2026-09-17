import { useEffect, useRef, type CSSProperties } from 'react';
import { esVideoFondo } from './juego/fondo.ts';

/** Capa full-bleed: imagen o video en loop, mudo, sin interacción. */
export function FondoLoop({ url, style, zIndex = 0 }: {
  url: string | null | undefined;
  style?: CSSProperties;
  zIndex?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
      v.currentTime = 0;
      return;
    }
    const play = () => { v.play().catch(() => {}); };
    play();
    const vis = () => { document.hidden ? v.pause() : play(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      v.pause();
    };
  }, [url]);

  if (!url) return null;
  const base: CSSProperties = {
    position: 'absolute', inset: 0, zIndex, pointerEvents: 'none',
    ...style,
  };
  if (esVideoFondo(url)) {
    return (
      <video
        ref={ref}
        src={url}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        style={{ ...base, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{ ...base, background: `center/cover no-repeat url("${url}")` }}
    />
  );
}
