import { forwardRef } from 'react';

// Pantalla de carga: imagen propia del juego si tiene, si no la
// portada, y si tampoco hay, solo el nombre. La barra de progreso es
// real: cuenta archivos terminados, no un temporizador. Se le pasa un
// `ref` para que la intro (Lottie) pueda montar su capa encima.

interface PantallaCargaProps {
  imagen: string | null;
  nombre: string;
  hechos: number;
  total: number;
  visible: boolean;
}

export const PantallaCarga = forwardRef<HTMLDivElement, PantallaCargaProps>(
  function PantallaCarga({ imagen, nombre, hechos, total, visible }, ref) {
    const p = total ? Math.round((hechos / total) * 100) : 100;
    return (
      <div
        ref={ref}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: '#0b0e14',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, transition: 'opacity .35s', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {imagen && <img src={imagen} style={{ width: 140, height: 140, objectFit: 'contain', borderRadius: 12 }} />}
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0, letterSpacing: '.08em' }}>{(nombre || '').toUpperCase()}</p>
        <div style={{ width: 160, height: 4, borderRadius: 2, background: '#1c2433', overflow: 'hidden' }}>
          <div style={{ width: `${p}%`, height: '100%', background: 'var(--accent)', transition: 'width .25s' }} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>{p}%</p>
      </div>
    );
  },
);
