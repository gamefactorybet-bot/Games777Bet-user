import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KenoTablero } from './KenoTablero.tsx';
import { KenoMesa } from './KenoMesa.tsx';
import { Fichas } from './Fichas.tsx';
import { estadoInicial, tablaDe } from './juego/keno.ts';
import type { TemaKeno } from './juego/keno-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoKeno, Ficha, Juego, KenoCfg, PosControlesKeno, TiradaInstant } from './types.ts';

const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, reduce ? 0 : ms));
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export type JugarKenoFn = (marcados: number[], apuesta: number) =>
  Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

// Partida de Keno en el navegador: marca de números, tirada contra el
// servidor (o el motor local en la preview) y animación de las bolas.
export function usePartidaKeno(cfg: KenoCfg, saldoInicial: number, apuestaInicial: number, onJugar: JugarKenoFn) {
  const [estado, setEstado] = useState<EstadoKeno>(() => estadoInicial(apuestaInicial, saldoInicial));
  const estadoRef = useRef(estado); estadoRef.current = estado;
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const setApuesta = useCallback((n: number) => setEstado((e) => ({ ...e, apuesta: n })), []);

  const onToggle = useCallback((n: number) => setEstado((e) => {
    if (e.fase !== 'idle') return e;
    const has = e.picked.includes(n);
    if (!has && e.picked.length >= cfg.maxMarcar) return e;
    return { ...e, picked: has ? e.picked.filter((x) => x !== n) : [...e.picked, n].sort((a, b) => a - b) };
  }), [cfg.maxMarcar]);

  const onAuto = useCallback(() => setEstado((e) => {
    if (e.fase !== 'idle') return e;
    const pool: number[] = []; for (let i = 1; i <= cfg.tablero; i++) pool.push(i);
    return { ...e, picked: shuffle(pool).slice(0, cfg.maxMarcar).sort((a, b) => a - b) };
  }), [cfg.tablero, cfg.maxMarcar]);

  const onLimpiar = useCallback(() => setEstado((e) => (
    e.fase === 'rolling' ? e : { ...e, picked: [], drawn: [], res: null, fase: 'idle', error: null }
  )), []);

  const jugar = useCallback(async () => {
    const cur = estadoRef.current;
    if (cur.fase !== 'idle' || !cur.picked.length || cur.saldo < cur.apuesta) return;
    const picked = cur.picked.slice();
    const apuesta = cur.apuesta;
    setEstado((e) => ({ ...e, fase: 'rolling', res: null, drawn: [], error: null, saldo: e.saldo - e.apuesta }));
    try {
      const r = await onJugar(picked, apuesta);
      const sorteados = r.resultado.sorteados || [];
      for (let i = 0; i < sorteados.length; i++) {
        if (!vivo.current) return;
        setEstado((e) => ({ ...e, drawn: sorteados.slice(0, i + 1) }));
        await sleep(150);
      }
      await sleep(280);
      if (!vivo.current) return;
      const aciertos = r.resultado.aciertos ?? 0;
      const mult = Number(r.resultado.mult) || 0;
      setEstado((e) => ({
        ...e, fase: 'done', saldo: Number(r.saldo),
        res: { aciertos, mult, amount: Math.round(apuesta * mult) },
        historial: [mult, ...e.historial].slice(0, 20),
      }));
    } catch (err) {
      if (!vivo.current) return;
      setEstado((e) => ({ ...e, fase: 'idle', drawn: [], saldo: e.saldo + apuesta, error: (err as Error).message || 'No se pudo resolver la jugada.' }));
    }
  }, [onJugar]);

  return { estado, setApuesta, onToggle, onAuto, onLimpiar, jugar };
}

interface KenoJuegoProps {
  escenario: Escenario;
  juego: Juego;
  cfg: KenoCfg;
  tema: TemaKeno;
  pos: PosControlesKeno;
  fichas: Ficha[];
  sinCaja: boolean;
  modoFichas?: 'fila' | 'abanico';
  saldoInicial: number;
  minBet: number;
  maxBet: number;
  paso: number;
  onJugar: JugarKenoFn;
  /** Preview: la ficha se puede arrastrar. */
  fichasEditables?: boolean;
  onMoverFicha?: (i: number, x: number, y: number) => void;
  premioDemo?: number | null;
}

// El juego completo montado sobre el escenario: tablero + mesa + fichas.
export function KenoJuego({
  escenario, juego, cfg, tema, pos, fichas, sinCaja, modoFichas, saldoInicial, minBet, maxBet, paso, onJugar,
  fichasEditables, onMoverFicha, premioDemo,
}: KenoJuegoProps) {
  const inicial = fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000));
  const p = usePartidaKeno(cfg, saldoInicial, inicial, onJugar);
  const tabla = useMemo(
    () => (p.estado.picked.length ? tablaDe(cfg, p.estado.picked.length) : []),
    [cfg, p.estado.picked.length],
  );

  return (
    <>
      <KenoTablero escenario={escenario} juego={juego} cfg={cfg} tema={tema} pos={pos}
        estado={p.estado} onToggle={p.onToggle} premioDemo={premioDemo} />
      <KenoMesa escenario={escenario} cfg={cfg} pos={pos} estado={p.estado} tabla={tabla}
        minBet={minBet} maxBet={maxBet} pasoApuesta={paso}
        ocultarApuesta={fichas.length > 0} ocultarCaja={sinCaja}
        onCambiarApuesta={p.setApuesta} onAuto={p.onAuto} onLimpiar={p.onLimpiar} onJugar={p.jugar} />
      {fichas.length > 0 && (
        <Fichas host={escenario.el} fichas={fichas} apuesta={p.estado.apuesta}
          bloqueado={p.estado.fase === 'rolling'}
          editable={fichasEditables}
          onElegir={p.setApuesta}
          onMover={onMoverFicha}
          modo={modoFichas} />
      )}
    </>
  );
}
