import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AUTO_CANTIDADES } from './juego/autoplay.ts';

interface BotonAutoProps {
  /** Si hay host, se monta por portal (slots / ruleta). Si no, va en el flujo. */
  host?: HTMLElement | null;
  x?: number;
  y?: number;
  /** Desplaza en px desde el ancla (negativo = a la izquierda del girar). */
  offsetPx?: number;
  restantes: number;
  activo: boolean;
  disabled?: boolean;
  onStart: (n: number) => void;
  onStop: () => void;
  /** true = no se posiciona absoluto (Limbo / Dice). */
  enFlujo?: boolean;
}

export function BotonAuto({
  host, x = 50, y = 88, offsetPx = 0, restantes, activo, disabled, onStart, onStop, enFlujo,
}: BotonAutoProps) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { if (activo) setAbierto(false); }, [activo]);

  const cuerpo = activo ? (
    <button type="button" className="jg-auto jg-auto-on" onClick={onStop}>
      Stop · {restantes}
    </button>
  ) : (
    <div style={{ position: 'relative' }}>
      <button type="button" className="jg-auto" disabled={disabled} onClick={() => setAbierto((v) => !v)}>
        Auto
      </button>
      {abierto && (
        <div className="jg-auto-menu">
          {AUTO_CANTIDADES.map((n) => (
            <button key={n} type="button" onClick={() => { onStart(n); setAbierto(false); }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );

  if (enFlujo) return <div style={{ pointerEvents: 'auto' }}>{cuerpo}</div>;

  const wrap = (
    <div style={{
      position: 'absolute',
      left: `calc(${x}% + ${offsetPx}px)`,
      top: `${y}%`,
      transform: 'translate(-50%,-50%)',
      zIndex: 14,
      pointerEvents: 'auto',
    }}>
      {cuerpo}
    </div>
  );
  if (host) return createPortal(wrap, host);
  return wrap;
}
