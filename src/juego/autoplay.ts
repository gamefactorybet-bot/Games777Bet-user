import { useCallback, useEffect, useRef, useState } from 'react';

export const AUTO_CANTIDADES = [10, 25, 50, 100] as const;
export const AUTO_PAUSA_MS = 560;

/**
 * Jugadas automáticas: el motor llama `continuar(jugar, puede)` cuando
 * la ronda ya se ve completa. Si no alcanza el saldo o el usuario toca
 * Stop, se corta.
 */
export function useAutoplay() {
  const [restantes, setRestantes] = useState(0);
  const vivos = useRef(0);
  const stopRef = useRef(false);
  const timer = useRef(0);

  useEffect(() => () => { stopRef.current = true; window.clearTimeout(timer.current); }, []);

  const stop = useCallback(() => {
    stopRef.current = true;
    vivos.current = 0;
    window.clearTimeout(timer.current);
    setRestantes(0);
  }, []);

  const start = useCallback((n: number, jugar: () => void) => {
    stopRef.current = false;
    vivos.current = Math.max(1, Math.round(n));
    setRestantes(vivos.current);
    jugar();
  }, []);

  const continuar = useCallback((jugar: () => void, puede: boolean) => {
    if (stopRef.current || vivos.current <= 0) return;
    if (vivos.current <= 1 || !puede) {
      vivos.current = 0;
      setRestantes(0);
      return;
    }
    vivos.current -= 1;
    setRestantes(vivos.current);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!stopRef.current && vivos.current > 0) jugar();
    }, AUTO_PAUSA_MS);
  }, []);

  return { restantes, activo: restantes > 0, start, stop, continuar };
}
