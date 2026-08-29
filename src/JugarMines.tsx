import { useCallback, useEffect, useRef, useState } from 'react';
import { TableroMines } from './TableroMines.tsx';
import { PantallaCarga } from './PantallaCarga.tsx';
import { crearEscenario } from './juego/escenario.ts';
import { precargarLottie } from './lottie.ts';
import { fetchJson, correrIntro } from './juego/recursos.ts';
import { estadoInicial, puedeRetirar as calcPuedeRetirar, posControlesDe } from './juego/mines.ts';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoPartida } from './juego/mines.ts';
import type { DatosJuego, RondaMines, RevelarMines, RetirarMines } from './types.ts';

interface JugarMinesProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

const MOTOR_STUB = { COLUMNAS: 5, FILAS: 5, FILA_PAGO: 0 };

// Pantalla real de Mines. Cada paso (empezar, destapar, retirar) lo
// resuelve el servidor (api/mines-iniciar|revelar|retirar); acá solo
// se muestra. Las posiciones de las minas nunca llegan al navegador
// hasta que la partida termina.
export function JugarMines({ datos, saldoInicial, slug, token }: JugarMinesProps) {
  const juego = datos.juego;
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const pantallaRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const roundIdRef = useRef<string | null>(null);

  const [estado, setEstado] = useState<EstadoPartida>(() => estadoInicial(3, minBet, saldoInicial));
  const posCtl = useRef(posControlesDe(juego)).current;
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);
  const [listo, setListo] = useState(false);

  // ---------------- Escenario + precarga + intro ----------------
  useEffect(() => {
    let cancelado = false;
    if (!hostRef.current) return;

    const esc = crearEscenario({
      modo: 'jugar', esMines: true, juego, motor: MOTOR_STUB,
      simbolos: [], sonidos: datos.sonidos, efectos: datos.efectos, premios: [], digitos: [], botones: [],
      cadenasLuces: datos.cadenasLuces, capasLibres: datos.capasLibres, animaciones: datos.animaciones,
    });
    escRef.current = esc;
    // Se arma escondido y se revela entero recién cuando todo bajó — así
    // no se ve el escenario armándose de a pedazos.
    esc.el.style.opacity = '0';
    hostRef.current.appendChild(esc.wrap);
    setListo(true);

    (async () => {
      const imgs = [
        juego.fondo_url, juego.fondo_pantalla_url, juego.marco_url, juego.cartel_url,
        juego.mines_casilla_oculta_url, juego.mines_casilla_segura_url, juego.mines_casilla_mina_url,
        juego.portada_url, juego.carga_url,
        ...(datos.capasLibres || []).map((c) => c.imagen_url),
      ].filter(Boolean) as string[];

      const lottieUrls = [
        juego.mines_casilla_oculta_lottie_url, juego.mines_casilla_segura_lottie_url, juego.mines_casilla_mina_lottie_url,
        ...(datos.animaciones || []).map((a) => a.lottie_url),
      ].filter(Boolean) as string[];

      // Bajar imágenes (con decode, así no hay hitch al pintar), los
      // bytes de los Lottie, y compilar el WASM de Lottie si hace falta.
      const tareas: Promise<unknown>[] = [
        ...imgs.map((url) => {
          const img = new Image();
          img.src = url;
          return (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).finally(marcar);
        }),
        ...lottieUrls.map((url) => fetch(url).then((r) => r.blob()).catch(() => {}).finally(marcar)),
        ...(lottieUrls.length ? [precargarLottie().catch(() => {}).finally(marcar)] : []),
      ];
      const total = tareas.length || 1;
      let hechos = 0;
      function marcar() { hechos++; setProgreso({ hechos, total }); }
      if (!tareas.length) setProgreso({ hechos: 1, total: 1 });

      const descarga = Promise.race([
        Promise.all(tareas),
        new Promise((r) => setTimeout(r, 12000)), // tope de seguridad
      ]);

      const intro = (datos.animaciones || []).find((a) => a.evento === 'intro' && a.lottie_url);
      if (intro && pantallaRef.current) await correrIntro(intro, pantallaRef.current);
      await descarga;

      if (cancelado) return;
      // El escenario ya está completo detrás de la pantalla de carga:
      // se muestra de una y recién ahí se disuelve la tapa.
      esc.el.style.opacity = '1';
      requestAnimationFrame(() => { if (!cancelado) setPantallaVisible(false); });
      setTimeout(() => { if (!cancelado) setPantallaMontada(false); }, 450);
    })();

    return () => { cancelado = true; esc.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Partida contra el servidor ----------------
  const conError = useCallback((err: unknown) => {
    setEstado((e) => ({ ...e, cargando: false, pendiente: null, error: (err as Error).message || 'Algo falló. Probá de nuevo.' }));
  }, []);

  const iniciar = async () => {
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await fetchJson<RondaMines>('/api/mines-iniciar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, apuesta: estado.apuesta, minas: estado.minas }),
      });
      roundIdRef.current = r.roundId;
      const reveladas = r.reveladas || [];
      setEstado((e) => ({
        ...e,
        fase: r.estado,
        minas: r.minas,
        reveladas,
        minasPos: null,
        multiplicador: r.multiplicador,
        puedeRetirar: calcPuedeRetirar(r.minas, reveladas.length),
        saldo: r.yaExistia ? e.saldo : (r.saldo ?? e.saldo - e.apuesta),
        ganancia: null,
        cargando: false,
        error: r.yaExistia ? 'Retomaste una partida que ya tenías en curso.' : null,
      }));
    } catch (err) { conError(err); }
  };

  const revelar = async (casilla: number) => {
    if (!roundIdRef.current || estado.fase !== 'en_curso' || estado.pendiente != null) return;
    // Feedback inmediato: la casilla se marca antes de que conteste el servidor.
    setEstado((e) => ({ ...e, pendiente: casilla, error: null }));
    try {
      const r = await fetchJson<RevelarMines>('/api/mines-revelar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, roundId: roundIdRef.current, casilla }),
      });
      if (r.esMina) {
        setEstado((e) => ({ ...e, pendiente: null, fase: 'perdida', minasPos: r.posicionesMina ?? [], clicMina: casilla, ganancia: 0 }));
        return;
      }
      setEstado((e) => ({
        ...e,
        pendiente: null,
        reveladas: [...e.reveladas, r.casilla],
        multiplicador: r.multiplicador ?? e.multiplicador,
        puedeRetirar: !!r.puedeRetirar,
      }));
    } catch (err) { conError(err); }
  };

  const retirar = async () => {
    if (!roundIdRef.current || estado.fase !== 'en_curso') return;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await fetchJson<RetirarMines>('/api/mines-retirar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, roundId: roundIdRef.current }),
      });
      setEstado((e) => ({
        ...e,
        fase: 'retirada',
        minasPos: r.posicionesMina ?? e.minasPos,
        multiplicador: r.multiplicador,
        ganancia: r.ganancia,
        saldo: r.saldo ?? e.saldo,
        cargando: false,
      }));
    } catch (err) { conError(err); }
  };

  const nueva = () => {
    roundIdRef.current = null;
    setEstado((e) => estadoInicial(e.minas, e.apuesta, e.saldo));
  };

  const imagenCarga = (juego.carga_url as string) || (juego.portada_url as string) || null;

  return (
    <>
      <style>{`
        body { overflow: hidden; }
        #app, #app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        #app img { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
        #app button, #app button * { pointer-events: auto; }
      `}</style>

      <div ref={hostRef} />
      {listo && escRef.current && (
        <TableroMines
          escenario={escRef.current}
          pos={posCtl}
          juego={juego}
          estado={estado}
          minBet={minBet}
          maxBet={maxBet}
          pasoApuesta={paso}
          onIniciar={iniciar}
          onRevelar={revelar}
          onRetirar={retirar}
          onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
          onCambiarMinas={(n) => setEstado((e) => ({ ...e, minas: n }))}
          onNueva={nueva}
        />
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
