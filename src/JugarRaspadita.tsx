import { useEffect, useMemo, useRef, useState } from 'react';
import { crearEscenario } from './juego/escenario.ts';
import { Raspadita } from './Raspadita.tsx';
import { RaspaditaMesa } from './RaspaditaMesa.tsx';
import { PantallaCarga } from './PantallaCarga.tsx';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { cfgDe, estadoInicial, posControlesRaspaDe } from './juego/raspadita.ts';
import { temaRaspaDe } from './juego/raspadita-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { DatosJuego, EstadoRaspa, ResultadoRaspa, TiradaRaspa } from './types.ts';

interface JugarRaspaditaProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Pantalla real de la raspadita. Cada tarjeta la resuelve el servidor
// (api/raspadita-jugar): decide el premio y cómo queda la grilla. El
// navegador solo anima el raspado.
export function JugarRaspadita({ datos, saldoInicial, slug, token }: JugarRaspaditaProps) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaRaspaDe(cfg.tema), [cfg.tema]);
  const pos = useRef(posControlesRaspaDe(cfg)).current;
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
  const [estado, setEstado] = useState<EstadoRaspa>(() => estadoInicial(minBet, Number(saldoInicial)));
  const [tirada, setTirada] = useState<TiradaRaspa | null>(null);
  const [revelado, setRevelado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;
    const esc = crearEscenario({
      modo: 'jugar', esRaspadita: true, motor: MOTOR_STUB, juego,
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

  const comprar = async () => {
    if ((tirada && !revelado) || estado.cargando || estado.saldo < estado.apuesta) return;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await fetchJson<ResultadoRaspa>('/api/raspadita-jugar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, apuesta: estado.apuesta, clientId: crypto.randomUUID() }),
      });
      pendRef.current = { saldoFinal: Number(r.saldo) };
      // se aplica el débito ahora; el premio se acredita al revelar
      setEstado((e) => ({ ...e, cargando: false, saldo: Number(r.saldo) - Number(r.premio) }));
      setRevelado(false);
      setTirada(r.resultado);
    } catch (err) {
      setEstado((e) => ({ ...e, cargando: false, error: (err as Error).message || 'No se pudo comprar la tarjeta.' }));
    }
  };

  const revelar = (mult: number) => {
    const p = pendRef.current;
    pendRef.current = null;
    setEstado((e) => ({
      ...e,
      saldo: p ? p.saldoFinal : e.saldo,
      historial: [mult, ...e.historial].slice(0, 30),
    }));
    setRevelado(true); // la tarjeta descubierta queda a la vista hasta la próxima compra
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
          <Raspadita
            escenario={escRef.current} juego={juego} cfg={cfg} tema={tema} pos={pos}
            tirada={tirada} onRevelar={revelar}
          />
          <RaspaditaMesa
            escenario={escRef.current} cfg={cfg} pos={pos} estado={estado}
            minBet={minBet} maxBet={maxBet} pasoApuesta={paso} raspando={!!tirada && !revelado}
            onComprar={comprar}
            onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
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
