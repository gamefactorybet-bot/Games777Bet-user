import { useEffect, useRef, useState } from 'react';
import { crearEscenario } from './juego/escenario.ts';
import { RuletaBotones } from './RuletaBotones.tsx';
import { PantallaCarga } from './PantallaCarga.tsx';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { cfgDe, posControlesRuletaDe } from './juego/ruleta-botones.ts';
import type { Escenario } from './juego/escenario.ts';
import type { GiroBotones } from './RuletaBotones.tsx';
import type { DatosJuego, ResultadoRuletaBotones } from './types.ts';

interface JugarRuletaBotonesProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Pantalla real de la Ruleta de botones. Cada giro lo resuelve el
// servidor (/api/ruleta-botones-girar, endpoint propio porque la
// apuesta es estructurada); acá solo se muestra.
export function JugarRuletaBotones({ datos, saldoInicial, slug, token }: JugarRuletaBotonesProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);

  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);

  const cfg = cfgDe(datos.juego);
  const pos = posControlesRuletaDe(cfg);

  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;

    const esc = crearEscenario({
      modo: 'jugar', esRuletaBotones: true, motor: MOTOR_STUB,
      juego: datos.juego, simbolos: [], sonidos: datos.sonidos, efectos: datos.efectos,
      premios: datos.premios, digitos: datos.digitos, capasLibres: datos.capasLibres,
      animaciones: datos.animaciones, cadenasLuces: datos.cadenasLuces, botones: datos.botones,
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

  const resolver = async (apuestas: Record<number, number>): Promise<GiroBotones> => {
    const r = await fetchJson<ResultadoRuletaBotones>('/api/ruleta-botones-girar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuestas, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, saldo: Number(r.saldo) };
  };

  const imagenCarga = (datos.juego.carga_url as string) || (datos.juego.portada_url as string) || null;

  return (
    <>
      <style>{`
        body { overflow: hidden; }
        #app, #app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
      `}</style>
      <div ref={hostRef} />
      {listo && escRef.current && (
        <RuletaBotones escenario={escRef.current} cfg={cfg} pos={pos} saldoInicial={Number(saldoInicial)} resolver={resolver} />
      )}
      {pantallaMontada && (
        <PantallaCarga
          ref={pantallaRef}
          imagen={imagenCarga}
          nombre={datos.juego.nombre}
          hechos={progreso.hechos}
          total={progreso.total}
          visible={pantallaVisible}
        />
      )}
    </>
  );
}
