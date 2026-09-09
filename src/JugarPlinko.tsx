import { useEffect, useMemo, useRef, useState } from 'react';
import { crearEscenario } from './juego/escenario.ts';
import { Plinko } from './Plinko.tsx';
import { PlinkoMesa } from './PlinkoMesa.tsx';
import { Fichas } from './Fichas.tsx';
import { fichasDe, fichasSinCajaDe, fichasVistaDe } from '../motor/fichas.js';
import { PantallaCarga } from './PantallaCarga.tsx';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { cfgDe, estadoInicial, posControlesPlinkoDe } from './juego/plinko.ts';
import { temaPlinkoDe } from './juego/plinko-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { DatosJuego, EstadoPlinko, ResultadoPlinko, TiradaResuelta } from './types.ts';

interface JugarPlinkoProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Pantalla real del Plinko. Cada tirada la resuelve el servidor
// (api/plinko-tirar): decide a qué cubeta cae y por qué camino. El
// navegador solo anima la bolita.
export function JugarPlinko({ datos, saldoInicial, slug, token }: JugarPlinkoProps) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaPlinkoDe(cfg.tema), [cfg.tema]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const sinCaja = useMemo(() => fichasSinCajaDe(juego), [juego]);
  const vistaFichas = useMemo(() => fichasVistaDe(juego), [juego]);
  const pos = useRef(posControlesPlinkoDe(cfg)).current;
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const pendRef = useRef<{ saldoFinal: number } | null>(null);

  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);
  const [estado, setEstado] = useState<EstadoPlinko>(() => estadoInicial(minBet, Number(saldoInicial), cfg));
  const [tirada, setTirada] = useState<TiradaResuelta | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;
    const esc = crearEscenario({
      modo: 'jugar', esPlinko: true, motor: MOTOR_STUB, juego,
      simbolos: [], sonidos: datos.sonidos, efectos: datos.efectos, premios: [], digitos: [],
      capasLibres: datos.capasLibres, animaciones: datos.animaciones, cadenasLuces: datos.cadenasLuces, botones: datos.botones,
    });
    escRef.current = esc;
    esc.el.style.opacity = '0';
    esc.el.style.transition = 'opacity .45s';
    hostRef.current.appendChild(esc.wrap);
    setListo(true);

    (async () => {
      const descarga = esperarRecursos(datos, (hechos, total) => setProgreso({ hechos, total }));
      const intro = (datos.animaciones || []).find((a) => a.evento === 'intro' && a.lottie_url);
      if (intro && pantallaRef.current) await correrIntro(intro, pantallaRef.current);
      await descarga;
      if (cancelado) return;
      esc.el.style.opacity = '1';
      setPantallaVisible(false);
      setTimeout(() => { if (!cancelado) setPantallaMontada(false); }, 400);
    })();

    return () => { cancelado = true; esc.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soltar = async () => {
    if (tirada || estado.cargando || estado.saldo < estado.apuesta) return;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await fetchJson<ResultadoPlinko>('/api/plinko-tirar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, apuesta: estado.apuesta, filas: estado.filas, riesgo: estado.riesgo, clientId: crypto.randomUUID() }),
      });
      pendRef.current = { saldoFinal: Number(r.saldo) };
      // se aplica el débito ahora; el premio "cae" con la bolita
      setEstado((e) => ({ ...e, cargando: false, saldo: Number(r.saldo) - Number(r.premio) }));
      setTirada(r.resultado);
    } catch (err) {
      setEstado((e) => ({ ...e, cargando: false, error: (err as Error).message || 'No se pudo resolver la tirada.' }));
    }
  };

  const alCaer = (mult: number) => {
    const p = pendRef.current;
    pendRef.current = null;
    setEstado((e) => ({
      ...e,
      saldo: p ? p.saldoFinal : e.saldo,
      historial: [mult, ...e.historial].slice(0, 30),
    }));
    setTirada(null);
  };

  const imagenCarga = (juego.carga_url as string) || (juego.portada_url as string) || null;

  return (
    <>
      <style>{`
        body { overflow: hidden; }
        #app, #app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
      `}</style>
      <div ref={hostRef} />
      {listo && escRef.current && (
        <>
          <Plinko
            escenario={escRef.current} cfg={cfg} tema={tema}
            filas={estado.filas} riesgo={estado.riesgo}
            tirada={tirada} onLand={alCaer}
          />
          <PlinkoMesa
            escenario={escRef.current} cfg={cfg} pos={pos} estado={estado}
            minBet={minBet} maxBet={maxBet} pasoApuesta={paso} cayendo={!!tirada}
            ocultarApuesta={fichas.length > 0}
            ocultarCaja={sinCaja}
            onSoltar={soltar}
            onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
            onCambiarFilas={(n) => setEstado((e) => ({ ...e, filas: n }))}
            onCambiarRiesgo={(r) => setEstado((e) => ({ ...e, riesgo: r }))}
          />
          {fichas.length > 0 && (
            <Fichas
              host={escRef.current.el} fichas={fichas} apuesta={estado.apuesta}
              bloqueado={!!tirada || estado.cargando}
              onElegir={(v) => setEstado((e) => ({ ...e, apuesta: v }))}
              {...vistaFichas}
            />
          )}
        </>
      )}
      {pantallaMontada && (
        <PantallaCarga
          ref={pantallaRef}
          imagen={imagenCarga}
          nombre={juego.nombre}
          hechos={progreso.hechos}
          total={progreso.total}
          visible={pantallaVisible}
        />
      )}
    </>
  );
}
