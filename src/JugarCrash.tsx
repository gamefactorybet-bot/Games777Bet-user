import { useEffect, useMemo, useRef, useState } from 'react';
import { crearEscenario } from './juego/escenario.ts';
import { Crash } from './Crash.tsx';
import { CrashMesa } from './CrashMesa.tsx';
import { PantallaCarga } from './PantallaCarga.tsx';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { cfgDe, estadoInicial, posControlesCrashDe } from './juego/crash.ts';
import { temaCrashDe } from './juego/crash-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { DatosJuego, EstadoCrash, RetiroCrash, RondaCrash } from './types.ts';

interface JugarCrashProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Pantalla real del Crash. Cada paso (iniciar / retirar / cerrar) lo
// resuelve el servidor; el punto de reventón nunca llega al navegador
// hasta que la ronda termina.
export function JugarCrash({ datos, saldoInicial, slug, token }: JugarCrashProps) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaCrashDe(cfg.tema), [cfg.tema]);
  const pos = useRef(posControlesCrashDe(cfg)).current;
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const roundRef = useRef<string | null>(null);
  const cerrandoRef = useRef(false);
  const multVivoRef = useRef(1);
  const resetTimer = useRef<number | undefined>(undefined);

  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);
  const [estado, setEstado] = useState<EstadoCrash>(() => estadoInicial(minBet, Number(saldoInicial), cfg));

  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;
    const esc = crearEscenario({
      modo: 'jugar', esCrash: true, motor: MOTOR_STUB, juego,
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

    return () => { cancelado = true; window.clearTimeout(resetTimer.current); esc.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conError = (err: unknown) =>
    setEstado((e) => ({ ...e, fase: e.fase === 'en_curso' ? e.fase : 'inactiva', cargando: false, error: (err as Error).message || 'Algo falló. Probá de nuevo.' }));

  const apostar = async () => {
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const t0 = Date.now();
      const r = await fetchJson<RondaCrash>('/api/crash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'iniciar', token, slug, apuesta: estado.apuesta }),
      });
      roundRef.current = r.roundId;
      cerrandoRef.current = false;
      multVivoRef.current = 1;
      // `inicioTs` y `servidorTs` están en el reloj del servidor; se
      // pasa el arranque al reloj local. El +150 hace que el número
      // que ve el jugador vaya un pelo por DEBAJO del que calcula el
      // servidor: al retirar cobra igual o un poquito más, nunca menos.
      const localInicio = t0 - (r.servidorTs - r.inicioTs) + 150;
      setEstado((e) => ({
        ...e, fase: 'en_curso', roundId: r.roundId, inicioTs: localInicio,
        multiplicador: 1, reventadoEn: null, ganancia: null, cargando: false,
        saldo: r.yaExistia ? e.saldo : (r.saldo ?? e.saldo - e.apuesta),
        error: r.yaExistia ? 'Retomaste una ronda que ya tenías en curso.' : null,
      }));
    } catch (err) { conError(err); }
  };

  const retirar = async (objetivoAuto?: number) => {
    if (!roundRef.current || cerrandoRef.current) return;
    cerrandoRef.current = true;
    try {
      const r = await fetchJson<RetiroCrash>('/api/crash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'retirar', token, slug, roundId: roundRef.current, objetivoAuto }),
      });
      aplicarCierre(r);
    } catch (err) { cerrandoRef.current = false; conError(err); }
  };

  const cerrar = async () => {
    if (!roundRef.current || cerrandoRef.current) return;
    cerrandoRef.current = true;
    try {
      const r = await fetchJson<RetiroCrash>('/api/crash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cerrar', token, slug, roundId: roundRef.current }),
      });
      aplicarCierre(r);
    } catch (err) { cerrandoRef.current = false; conError(err); }
  };

  const aplicarCierre = (r: RetiroCrash) => {
    setEstado((e) => {
      const gano = r.ganancia > 0;
      const hist = [r.reventadoEn, ...e.historial].slice(0, 30);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(nueva, gano ? 1800 : 2100);
      return {
        ...e,
        fase: gano ? 'retirada' : 'reventada',
        multiplicador: r.multiplicador,
        reventadoEn: r.reventadoEn,
        ganancia: gano ? r.ganancia : 0,
        saldo: r.saldo ?? e.saldo,
        historial: hist,
      };
    });
  };

  const nueva = () => {
    roundRef.current = null;
    cerrandoRef.current = false;
    setEstado((e) => (e.fase === 'en_curso' ? e : { ...e, fase: 'inactiva', roundId: null, multiplicador: 1, inicioTs: null, reventadoEn: null, ganancia: null, error: null }));
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
          <Crash
            escenario={escRef.current} cfg={cfg} tema={tema} pos={pos} estado={estado}
            multVivoRef={multVivoRef}
            onAuto={(obj) => retirar(obj)}
            onTope={() => cerrar()}
          />
          <CrashMesa
            escenario={escRef.current} cfg={cfg} pos={pos} estado={estado}
            minBet={minBet} maxBet={maxBet} pasoApuesta={paso}
            onApostar={apostar}
            onRetirar={() => retirar()}
            onNueva={nueva}
            onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
            onCambiarAuto={(activo, objetivo) => setEstado((e) => ({ ...e, autoActivo: activo, autoObjetivo: objetivo }))}
          />
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
