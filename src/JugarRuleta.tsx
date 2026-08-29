import { useEffect, useRef, useState } from 'react';
import { crearEscenario } from './juego/escenario.ts';
import { RuletaJuego } from './RuletaJuego.tsx';
import { PantallaCarga } from './PantallaCarga.tsx';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import type { Escenario } from './juego/escenario.ts';
import type { ResueltoRuleta } from './RuletaJuego.tsx';
import type { DatosJuego, ResultadoRuleta } from './types.ts';

interface JugarRuletaProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Pantalla real de la Ruleta. El giro lo resuelve el servidor
// (/api/jugar-girar, mismo endpoint que los slots); acá solo se muestra.
export function JugarRuleta({ datos, saldoInicial, slug, token }: JugarRuletaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);

  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);

  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;

    const esc = crearEscenario({
      modo: 'jugar', esRuleta: true, motor: MOTOR_STUB,
      juego: datos.juego, simbolos: [], sonidos: datos.sonidos, efectos: datos.efectos,
      premios: datos.premios, digitos: datos.digitos, capasLibres: datos.capasLibres,
      animaciones: datos.animaciones, cadenasLuces: datos.cadenasLuces, botones: datos.botones,
    });
    escRef.current = esc;
    esc.saldo = Number(saldoInicial);
    esc.saldoEl.textContent = esc.saldo.toLocaleString('es-PY');
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

  const resolver = async (apuesta: number): Promise<ResueltoRuleta> => {
    const r = await fetchJson<ResultadoRuleta>('/api/jugar-girar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, clientId: crypto.randomUUID() }),
    });
    return {
      slots: r.grilla.slots,
      ganadora: r.grilla.ganadora,
      premio: r.premio,
      nivel: r.nivel,
      saldo: Number(r.saldo),
    };
  };

  const imagenCarga = (datos.juego.carga_url as string) || (datos.juego.portada_url as string) || null;

  return (
    <>
      <div ref={hostRef} />
      {listo && escRef.current && (
        <RuletaJuego escenario={escRef.current} simbolos={datos.simbolos} resolver={resolver} />
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
