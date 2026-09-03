// Estado y lógica de una partida de 7 Up 7 Down en el navegador.
// Espejo de `usePartidaKeno` (src/KenoJuego.tsx): el componente sólo
// dibuja; acá vive el estado. El resultado lo decide el servidor (o el
// motor local en la preview); `animar` corre la animación de los dados.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SieteUdCfg, TiradaInstant, ZonaSieteUd } from '../types.ts';

export type JugarSieteUdFn = (zona: ZonaSieteUd, apuesta: number) =>
  Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

export type Fase = 'idle' | 'rolling' | 'gano' | 'perdio';

export interface EstadoSieteUd {
  saldo: number;
  apuesta: number;
  zona: ZonaSieteUd;
  fase: Fase;
  res: TiradaInstant | null;
  cartel: number | null; // monto del premio a mostrar en el cartel, o null
  hist: { n: string; gano: boolean }[];
}

export function useSieteUd(
  _cfg: SieteUdCfg,
  saldoInicial: number,
  apuestaInicial: number,
  onJugar: JugarSieteUdFn,
  animar: (dados: [number, number]) => Promise<void>,
) {
  const [est, setEst] = useState<EstadoSieteUd>({
    saldo: saldoInicial, apuesta: apuestaInicial, zona: 'siete',
    fase: 'idle', res: null, cartel: null, hist: [],
  });
  const ref = useRef(est); ref.current = est;
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const setApuesta = useCallback((n: number) => setEst((e) => (e.fase === 'rolling' ? e : { ...e, apuesta: n })), []);
  const setZona = useCallback((z: ZonaSieteUd) => setEst((e) => (e.fase === 'idle' ? { ...e, zona: z } : e)), []);
  const reset = useCallback(() => setEst((e) => ({ ...e, fase: 'idle', res: null, cartel: null })), []);

  const jugar = useCallback(async () => {
    const cur = ref.current;
    if (cur.fase === 'rolling' || cur.saldo < cur.apuesta) return;
    const { apuesta, zona } = cur;
    setEst((e) => ({ ...e, fase: 'rolling', res: null, cartel: null, saldo: e.saldo - apuesta }));
    try {
      const r = await onJugar(zona, apuesta);
      const dados = (r.resultado.dados || [3, 4]) as [number, number];
      await animar(dados);
      if (!vivo.current) return;
      const gano = !!r.resultado.gano;
      setEst((e) => ({
        ...e,
        fase: gano ? 'gano' : 'perdio',
        res: r.resultado,
        saldo: r.saldo,
        cartel: gano ? r.premio : null,
        hist: [{ n: String(r.resultado.suma ?? dados[0] + dados[1]), gano }, ...e.hist].slice(0, 12),
      }));
    } catch (err) {
      if (!vivo.current) return;
      setEst((e) => ({ ...e, fase: 'idle', saldo: e.saldo + apuesta }));
      console.error(err);
    }
  }, [onJugar, animar]);

  return { est, setApuesta, setZona, jugar, reset };
}
