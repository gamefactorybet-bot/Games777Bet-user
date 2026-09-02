import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { crearEscenario } from './juego/escenario.ts';
import { KenoJuego, type JugarKenoFn } from './KenoJuego.tsx';
import { fichasDe, fichasConDefaults } from '../motor/fichas.js';
import { PantallaCarga } from './PantallaCarga.tsx';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { cfgDe, posControlesKenoDe } from './juego/keno.ts';
import { temaKenoDe } from './juego/keno-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { DatosJuego, ResultadoInstant } from './types.ts';

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Pantalla real del Keno. Cada tirada la resuelve el servidor
// (api/jugar-instant): saca las bolas y paga por la tabla. El
// navegador solo anima las bolas saliendo.
export function JugarKeno({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaKenoDe(cfg.tema), [cfg.tema]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const sinCaja = fichas.length > 0 && !!fichasConDefaults(juego.fichas_cfg).sinCaja;
  const pos = useRef(posControlesKenoDe(cfg)).current;
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);

  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);

  const jugar: JugarKenoFn = useCallback(async (marcados, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, marcados, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  }, [token, slug]);

  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;
    const esc = crearEscenario({
      modo: 'jugar', esKeno: true, motor: MOTOR_STUB, juego,
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

  const imagenCarga = (juego.carga_url as string) || (juego.portada_url as string) || null;

  return (
    <>
      <style>{`
        body { overflow: hidden; }
        #app, #app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
      `}</style>
      <div ref={hostRef} />
      {listo && escRef.current && (
        <KenoJuego
          escenario={escRef.current} juego={juego} cfg={cfg} tema={tema} pos={pos}
          fichas={fichas} sinCaja={sinCaja} saldoInicial={Number(saldoInicial)}
          minBet={minBet} maxBet={maxBet} paso={paso} onJugar={jugar}
        />
      )}
      {pantallaMontada && (
        <PantallaCarga ref={pantallaRef} imagen={imagenCarga} nombre={juego.nombre}
          hechos={progreso.hechos} total={progreso.total} visible={pantallaVisible} />
      )}
    </>
  );
}
