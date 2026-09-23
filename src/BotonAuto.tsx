import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AUTO_CANTIDADES } from './juego/autoplay.ts';
import { alphaEn } from './juego/silueta.ts';

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
  /** Si hay imagen, el PNG es el botón. Lo transparente no se aprieta. */
  imagenUrl?: string | null;
}

export function BotonAuto({
  host, x = 50, y = 88, offsetPx = 0, restantes, activo, disabled, onStart, onStop, enFlujo, imagenUrl,
}: BotonAutoProps) {
  const [abierto, setAbierto] = useState(false);
  const [leerPixel, setLeerPixel] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => { if (activo) setAbierto(false); }, [activo]);
  useEffect(() => { setLeerPixel(true); }, [imagenUrl]);

  const filtrarHueco = (e: RPointerEvent) => {
    const img = imgRef.current;
    if (!img || !leerPixel) return;
    if (alphaEn(img, e.clientX, e.clientY) === false) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const cara = imagenUrl ? (
    <button
      type="button"
      className={`jg-con-img jg-auto-img${activo ? ' jg-on' : ''}`}
      disabled={disabled && !activo}
      onPointerDownCapture={filtrarHueco}
      onClick={activo ? onStop : () => setAbierto((v) => !v)}
    >
      <img
        key={leerPixel ? 'cors' : 'plain'}
        ref={imgRef}
        className="jg-silueta"
        alt=""
        src={imagenUrl}
        crossOrigin={leerPixel ? 'anonymous' : undefined}
        onError={() => { if (leerPixel) setLeerPixel(false); }}
      />
      {activo && <span className="jg-auto-cuenta">{restantes}</span>}
    </button>
  ) : activo ? (
    <button type="button" className="jg-auto jg-auto-on" onClick={onStop}>
      Stop · {restantes}
    </button>
  ) : (
    <button type="button" className="jg-auto" disabled={disabled} onClick={() => setAbierto((v) => !v)}>
      Auto
    </button>
  );

  const cuerpo = (
    <div style={{ position: 'relative' }}>
      {cara}
      {abierto && !activo && (
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
