import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AUTO_CANTIDADES } from './juego/autoplay.ts';
import { alphaEn, encajarImagen } from './juego/silueta.ts';

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
  /** Lado más largo de la imagen, en px. */
  tam?: number;
  /** Vista previa: arrastrar fija la posición. */
  onMover?: (x: number, y: number) => void;
}

export function BotonAuto({
  host, x = 50, y = 88, offsetPx = 0, restantes, activo, disabled, onStart, onStop, enFlujo, imagenUrl,
  tam = 64, onMover,
}: BotonAutoProps) {
  const [abierto, setAbierto] = useState(false);
  const [leerPixel, setLeerPixel] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ movido: boolean; sx: number; sy: number } | null>(null);
  const saltoRef = useRef(false);
  useEffect(() => { if (activo) setAbierto(false); }, [activo]);
  useEffect(() => { setLeerPixel(true); }, [imagenUrl]);
  useEffect(() => {
    const img = imgRef.current;
    if (img && imagenUrl) encajarImagen(img, tam);
  }, [imagenUrl, tam, leerPixel]);

  const filtrarHueco = (e: RPointerEvent) => {
    const img = imgRef.current;
    if (!img || !leerPixel) return;
    if (alphaEn(img, e.clientX, e.clientY) === false) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const mover = onMover && host && !enFlujo ? {
    onPointerDown: (e: RPointerEvent) => {
      dragRef.current = { movido: false, sx: e.clientX, sy: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: RPointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.movido && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      d.movido = true;
      const r = host.getBoundingClientRect();
      const nx = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
      const ny = Math.round(Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)));
      onMover(nx, ny);
    },
    onPointerUp: () => {
      if (dragRef.current?.movido) saltoRef.current = true;
      dragRef.current = null;
    },
    onPointerCancel: () => { dragRef.current = null; },
  } : {};

  const tocar = (accion: () => void) => (e: ReactMouseEvent) => {
    if (saltoRef.current) { saltoRef.current = false; e.preventDefault(); return; }
    accion();
  };

  const cara = imagenUrl ? (
    <button
      type="button"
      className={`jg-con-img jg-auto-img${activo ? ' jg-on' : ''}`}
      disabled={disabled && !activo}
      onPointerDownCapture={filtrarHueco}
      onClick={tocar(activo ? onStop : () => setAbierto((v) => !v))}
      {...mover}
    >
      <img
        key={leerPixel ? 'cors' : 'plain'}
        ref={imgRef}
        className="jg-silueta"
        alt=""
        draggable={false}
        src={imagenUrl}
        crossOrigin={leerPixel ? 'anonymous' : undefined}
        onError={() => { if (leerPixel) setLeerPixel(false); }}
      />
      {activo && <span className="jg-auto-cuenta">{restantes}</span>}
    </button>
  ) : activo ? (
    <button type="button" className="jg-auto jg-auto-on" onClick={tocar(onStop)} {...mover}>
      Stop · {restantes}
    </button>
  ) : (
    <button type="button" className="jg-auto" disabled={disabled} onClick={tocar(() => setAbierto((v) => !v))} {...mover}>
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
      left: offsetPx ? `calc(${x}% + ${offsetPx}px)` : `${x}%`,
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
