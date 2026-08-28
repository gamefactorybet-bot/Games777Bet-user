import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { conDefaults, filtroCss } from './juego/defaults.ts';
import type { Juego } from './types.ts';

// El marco 420×860 escalado de la pantalla de Mines, con el arte del
// juego (fondo de pantalla, marco, cartel) posicionado como en los
// slots. Lo comparten la vista previa y la pantalla real.

export function MarcoMines({ juego, children }: { juego: Juego; children: ReactNode }) {
  const capRef = useRef<HTMLDivElement>(null);
  const pos = conDefaults(juego);

  const posImg = (capa: 'fondo_pantalla' | 'marco' | 'cartel'): CSSProperties => ({
    position: 'absolute',
    left: `${pos[`${capa}_x`]}%`, top: `${pos[`${capa}_y`]}%`,
    width: `${pos[`${capa}_ancho`]}%`, height: `${pos[`${capa}_alto`]}%`,
    objectFit: 'fill', transform: 'translate(-50%,-50%)',
    filter: filtroCss(pos[`${capa}_blur`], pos[`${capa}_oscurecer`]),
  });

  useEffect(() => {
    const escalar = () => {
      if (!capRef.current) return;
      const s = Math.min(window.innerWidth / 420, window.innerHeight / 860);
      capRef.current.style.transform = `scale(${s})`;
      capRef.current.style.margin = `${(860 * s - 860) / 2}px ${(420 * s - 420) / 2}px`;
    };
    escalar();
    window.addEventListener('resize', escalar);
    window.addEventListener('orientationchange', escalar);
    return () => {
      window.removeEventListener('resize', escalar);
      window.removeEventListener('orientationchange', escalar);
    };
  }, []);

  const mostrarNombre = (juego.mostrar_nombre ?? true) as boolean;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div
        ref={capRef}
        style={{
          width: 420, height: 860, flexShrink: 0, position: 'relative',
          background: 'var(--surface)', borderRadius: 20, padding: 22, overflow: 'hidden',
          transformOrigin: 'center center',
        }}
      >
        {juego.fondo_pantalla_url && <img src={juego.fondo_pantalla_url} style={posImg('fondo_pantalla')} />}
        {juego.marco_url && <img src={juego.marco_url} style={posImg('marco')} />}

        <div style={{ position: 'relative', zIndex: 5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          {mostrarNombre && <p style={{ fontWeight: 600, letterSpacing: '.04em', margin: 0 }}>{juego.nombre.toUpperCase()}</p>}
          {children}
        </div>

        {juego.cartel_url && <img src={juego.cartel_url} style={posImg('cartel')} />}
      </div>
    </div>
  );
}
