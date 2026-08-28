import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { TableroMines } from './TableroMines.tsx';
import { PantallaCarga } from './PantallaCarga.tsx';
import { conDefaults, filtroCss } from './juego/defaults.ts';
import { fetchJson, correrIntro } from './juego/recursos.ts';
import { estadoInicial, puedeRetirar as calcPuedeRetirar } from './juego/mines.ts';
import type { EstadoPartida } from './juego/mines.ts';
import type { DatosJuego, RondaMines, RevelarMines, RetirarMines } from './types.ts';

interface JugarMinesProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

// Pantalla real de Mines. Cada paso (empezar, destapar, retirar) lo
// resuelve el servidor (api/mines-iniciar|revelar|retirar); acá solo
// se muestra. Las posiciones de las minas nunca llegan al navegador
// hasta que la partida termina.
export function JugarMines({ datos, saldoInicial, slug, token }: JugarMinesProps) {
  const juego = datos.juego;
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const capRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const roundIdRef = useRef<string | null>(null);

  const [estado, setEstado] = useState<EstadoPartida>(() => estadoInicial(3, minBet, saldoInicial));
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);

  // ---------------- Marco 420×860 escalado ----------------
  const pos = conDefaults(juego);
  const posImg = (capa: 'fondo_pantalla' | 'marco' | 'cartel'): CSSProperties => ({
    position: 'absolute',
    left: `${pos[`${capa}_x`]}%`, top: `${pos[`${capa}_y`]}%`,
    width: `${pos[`${capa}_ancho`]}%`, height: `${pos[`${capa}_alto`]}%`,
    objectFit: 'fill', transform: 'translate(-50%,-50%)',
    filter: filtroCss(pos[`${capa}_blur`], pos[`${capa}_oscurecer`]),
  });

  useEffect(() => {
    const escalar = () => {
      if (!capRef.current) return;
      const s = Math.min(window.innerWidth / 420, window.innerHeight / 860);
      capRef.current.style.transform = `scale(${s})`;
      capRef.current.style.margin = `${(860 * s - 860) / 2}px ${(420 * s - 420) / 2}px`;
    };
    escalar();
    window.addEventListener('resize', escalar);
    window.addEventListener('orientationchange', escalar);
    return () => {
      window.removeEventListener('resize', escalar);
      window.removeEventListener('orientationchange', escalar);
    };
  }, []);

  // ---------------- Precarga + intro ----------------
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const urls = [
        juego.fondo_url, juego.fondo_pantalla_url, juego.marco_url, juego.cartel_url,
        juego.mines_casilla_oculta_url, juego.mines_casilla_segura_url, juego.mines_casilla_mina_url,
      ].filter(Boolean) as string[];

      const total = urls.length || 1;
      let hechos = 0;
      const descarga = Promise.all(urls.map((url) => new Promise<void>((listo) => {
        const img = new Image();
        img.onload = img.onerror = () => { hechos++; setProgreso({ hechos, total }); listo(); };
        img.src = url;
      })));
      if (!urls.length) setProgreso({ hechos: 1, total: 1 });

      const intro = (datos.animaciones || []).find((a) => a.evento === 'intro' && a.lottie_url);
      if (intro && pantallaRef.current) await correrIntro(intro, pantallaRef.current);
      await descarga;

      if (cancelado) return;
      setPantallaVisible(false);
      setTimeout(() => { if (!cancelado) setPantallaMontada(false); }, 400);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Partida contra el servidor ----------------
  const conError = useCallback((err: unknown) => {
    setEstado((e) => ({ ...e, cargando: false, error: (err as Error).message || 'Algo falló. Probá de nuevo.' }));
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
    if (!roundIdRef.current || estado.fase !== 'en_curso') return;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await fetchJson<RevelarMines>('/api/mines-revelar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, roundId: roundIdRef.current, casilla }),
      });
      if (r.esMina) {
        setEstado((e) => ({ ...e, fase: 'perdida', minasPos: r.posicionesMina ?? [], clicMina: casilla, ganancia: 0, cargando: false }));
        return;
      }
      setEstado((e) => ({
        ...e,
        reveladas: [...e.reveladas, r.casilla],
        multiplicador: r.multiplicador ?? e.multiplicador,
        puedeRetirar: !!r.puedeRetirar,
        cargando: false,
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
  const mostrarNombre = (juego.mostrar_nombre ?? true) as boolean;

  return (
    <>
      <style>{`
        body { overflow: hidden; }
        #app, #app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        #app img { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
        #app button, #app button * { pointer-events: auto; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div
          ref={capRef}
          style={{
            width: 420, height: 860, flexShrink: 0, position: 'relative',
            background: 'var(--surface)', borderRadius: 20, padding: 22, overflow: 'hidden',
            transformOrigin: 'center center',
            backgroundImage: juego.fondo_url ? `url('${juego.fondo_url}')` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        >
          {juego.fondo_pantalla_url && <img src={juego.fondo_pantalla_url} style={posImg('fondo_pantalla')} />}
          {juego.marco_url && <img src={juego.marco_url} style={posImg('marco')} />}

          <div style={{ position: 'relative', zIndex: 5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {mostrarNombre && (
              <p style={{ fontWeight: 600, letterSpacing: '.04em', margin: 0 }}>{juego.nombre.toUpperCase()}</p>
            )}
            <TableroMines
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
          </div>

          {juego.cartel_url && <img src={juego.cartel_url} style={posImg('cartel')} />}
        </div>
      </div>

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
