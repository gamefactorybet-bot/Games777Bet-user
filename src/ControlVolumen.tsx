import { useEffect, useRef } from 'react';
import { montarVolumen } from './juego/volumenWidget.ts';

/** Mute y volumen, colocado en el marco del juego. */
export function ControlVolumen({
  host, x, y, tam, editable, onMover, onTam,
}: {
  host: HTMLElement | null;
  x: number;
  y: number;
  tam: number;
  editable?: boolean;
  onMover?: (x: number, y: number) => void;
  onTam?: (tam: number) => void;
}) {
  const moverRef = useRef(onMover);
  const tamRef = useRef(onTam);
  moverRef.current = onMover;
  tamRef.current = onTam;
  const api = useRef<ReturnType<typeof montarVolumen> | null>(null);

  useEffect(() => {
    if (!host) return;
    const w = montarVolumen(host, {
      x, y, tam, editable: !!editable,
      onMover: (nx, ny) => moverRef.current?.(nx, ny),
      onTam: (n) => tamRef.current?.(n),
    });
    api.current = w;
    return () => { w.destruir(); api.current = null; };
    // La posición se aplica en el efecto de abajo. Acá solo nace el nodo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, editable]);

  useEffect(() => { api.current?.aplicar(x, y, tam); }, [x, y, tam]);
  return null;
}
