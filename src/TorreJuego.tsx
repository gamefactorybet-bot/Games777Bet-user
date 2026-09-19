import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TorreEscalera } from './TorreEscalera.tsx';
import { TorreMesa } from './TorreMesa.tsx';
import { Fichas } from './Fichas.tsx';
import { fichasVistaDe } from '../motor/fichas.js';
import { estadoInicial } from './juego/torre.ts';
import { tocar, tocarPremio } from './juego/sfx.ts';
import type { TemaTorre } from './juego/torre-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type {
  EstadoTorre, Ficha, Juego, PosControlesTorre, RetirarTorre, SubirTorre, TorreCfg,
} from './types.ts';

export interface TorreApi {
  /** Arranca la ronda (debita). Devuelve el saldo tras apostar (o null en la preview). */
  iniciar: (apuesta: number) => Promise<{ saldo: number | null }>;
  subir: (piso: number, casilla: number) => Promise<SubirTorre>;
  retirar: () => Promise<RetirarTorre>;
}

// Partida de Torre en el navegador: primer toque arranca la ronda,
// cada piso que zafás sube el multiplicador, retirás cuando querés.
export function usePartidaTorre(cfg: TorreCfg, saldoInicial: number, apuestaInicial: number, api: TorreApi) {
  const [estado, setEstado] = useState<EstadoTorre>(() => estadoInicial(apuestaInicial, saldoInicial));
  const ref = useRef(estado); ref.current = estado;
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const setApuesta = useCallback((n: number) => setEstado((e) => (e.fase === 'idle' ? { ...e, apuesta: n } : e)), []);

  const nueva = useCallback(() => setEstado((e) => (
    e.fase === 'cargando' || e.fase === 'jugando' ? e
      : { ...e, piso: 1, picks: [], trampas: null, fase: 'idle', mult: 1, res: null, error: null }
  )), []);

  const aplicarSubida = useCallback((r: SubirTorre, apuesta: number) => {
    if (!vivo.current) return;
    if (r.trampa) {
      setEstado((e) => ({
        ...e, fase: 'perdida', trampas: r.trampasReveladas ?? null, mult: 0,
        picks: [...e.picks, { piso: r.piso, casilla: r.casilla }],
        historial: [0, ...e.historial].slice(0, 20),
      }));
      return;
    }
    const m = Number(r.multiplicador) || 1;
    if (r.top) {
      setEstado((e) => ({
        ...e, fase: 'retirada', trampas: r.trampasReveladas ?? null, mult: m,
        picks: [...e.picks, { piso: r.piso - 1, casilla: r.casilla }],
        res: { mult: m, amount: Math.round(apuesta * m), top: true },
        saldo: r.saldo != null ? Number(r.saldo) : e.saldo,
        historial: [m, ...e.historial].slice(0, 20),
      }));
      return;
    }
    setEstado((e) => ({
      ...e, fase: 'jugando', piso: r.piso, mult: m,
      picks: [...e.picks, { piso: r.piso - 1, casilla: r.casilla }],
    }));
  }, []);

  const elegir = useCallback(async (piso: number, casilla: number) => {
    const cur = ref.current;
    if (cur.fase === 'cargando' || cur.fase === 'perdida' || cur.fase === 'retirada') return;
    const apuesta = cur.apuesta;

    if (cur.fase === 'idle') {
      if (piso !== 1 || cur.saldo < apuesta) return;
      setEstado((e) => ({ ...e, fase: 'cargando', error: null }));
      try {
        const { saldo } = await api.iniciar(apuesta);
        if (!vivo.current) return;
        setEstado((e) => ({ ...e, fase: 'jugando', piso: 1, mult: 1, picks: [], trampas: null, res: null, saldo: saldo != null ? Number(saldo) : e.saldo - apuesta }));
        const r = await api.subir(1, casilla);
        aplicarSubida(r, apuesta);
      } catch (err) {
        if (!vivo.current) return;
        setEstado((e) => ({ ...e, fase: 'idle', error: (err as Error).message || 'No se pudo iniciar la partida.' }));
      }
      return;
    }

    // jugando
    if (piso !== cur.piso) return;
    setEstado((e) => ({ ...e, fase: 'cargando', error: null }));
    try {
      const r = await api.subir(piso, casilla);
      if (!vivo.current) return;
      setEstado((e) => ({ ...e, fase: 'jugando' }));
      aplicarSubida(r, apuesta);
    } catch (err) {
      if (!vivo.current) return;
      setEstado((e) => ({ ...e, fase: 'jugando', error: (err as Error).message || 'No se pudo subir.' }));
    }
  }, [api, aplicarSubida]);

  const retirar = useCallback(async () => {
    const cur = ref.current;
    if (cur.fase !== 'jugando' || cur.piso <= 1) return;
    setEstado((e) => ({ ...e, fase: 'cargando', error: null }));
    try {
      const r = await api.retirar();
      if (!vivo.current) return;
      const m = Number(r.multiplicador) || cur.mult;
      setEstado((e) => ({
        ...e, fase: 'retirada', trampas: r.trampasReveladas ?? null, mult: m,
        res: { mult: m, amount: Math.round(cur.apuesta * m), top: false },
        saldo: r.saldo != null ? Number(r.saldo) : e.saldo,
        historial: [m, ...e.historial].slice(0, 20),
      }));
    } catch (err) {
      if (!vivo.current) return;
      setEstado((e) => ({ ...e, fase: 'jugando', error: (err as Error).message || 'No se pudo retirar.' }));
    }
  }, [api]);

  return { estado, setApuesta, elegir, retirar, nueva };
}

interface TorreJuegoProps {
  escenario: Escenario;
  juego: Juego;
  cfg: TorreCfg;
  tema: TemaTorre;
  pos: PosControlesTorre;
  fichas: Ficha[];
  sinCaja: boolean;
  modoFichas?: 'fila' | 'abanico';
  saldoInicial: number;
  minBet: number;
  maxBet: number;
  paso: number;
  contadorMs: number;
  api: TorreApi;
  fichasEditables?: boolean;
  onMoverFicha?: (i: number, x: number, y: number) => void;
  premioDemo?: number | null;
}

export function TorreJuego({
  escenario, juego, cfg, tema, pos, fichas, sinCaja, modoFichas, saldoInicial, minBet, maxBet, paso, contadorMs,
  api, fichasEditables, onMoverFicha, premioDemo,
}: TorreJuegoProps) {
  const inicial = useMemo(
    () => (fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000))),
    [fichas, minBet, maxBet],
  );
  const p = usePartidaTorre(cfg, saldoInicial, inicial, api);
  const fasePrev = useRef(p.estado.fase);
  const picksPrev = useRef(p.estado.picks.length);
  useEffect(() => {
    const antes = fasePrev.current;
    fasePrev.current = p.estado.fase;
    if (p.estado.picks.length > picksPrev.current) tocar(escenario.audios, 'giro');
    picksPrev.current = p.estado.picks.length;
    if (antes === p.estado.fase) return;
    if (p.estado.fase === 'perdida') tocar(escenario.audios, 'perder');
    if (p.estado.fase === 'retirada') tocarPremio(escenario.audios, p.estado.res?.amount ?? 0, p.estado.apuesta);
  }, [p.estado.fase, p.estado.picks.length, p.estado.res, p.estado.apuesta, escenario.audios]);

  return (
    <>
      <TorreEscalera escenario={escenario} juego={juego} cfg={cfg} tema={tema} pos={pos}
        estado={p.estado} onElegir={p.elegir} />
      <TorreMesa escenario={escenario} cfg={cfg} pos={pos} estado={p.estado}
        minBet={minBet} maxBet={maxBet} pasoApuesta={paso} contadorMs={contadorMs}
        ocultarApuesta={fichas.length > 0} ocultarCaja={sinCaja}
        onCambiarApuesta={p.setApuesta} onRetirar={p.retirar} onNueva={p.nueva}
        premioDemo={premioDemo} />
      {fichas.length > 0 && p.estado.fase === 'idle' && (
        <Fichas host={escenario.el} fichas={fichas} apuesta={p.estado.apuesta}
          editable={fichasEditables} onElegir={p.setApuesta} onMover={onMoverFicha} {...fichasVistaDe(juego)} />
      )}
    </>
  );
}
