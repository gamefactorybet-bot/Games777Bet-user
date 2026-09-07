import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchJson } from './juego/recursos.ts';
import { fichasDe, fichasModoDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import { crearDados3D, type Dados3D } from './juego/dados3d.ts';
import { SieteUdShell } from './SieteUdShell.tsx';
import { SieteUdMesa, type EdicionMesa } from './SieteUdMesa.tsx';
import { SieteUdEditor } from './SieteUdEditor.tsx';
import { useSieteUd, type JugarSieteUdFn } from './juego/useSieteUd.ts';
import { cfgConDefaults as _cfg, tirar as _tirarLocal } from '../motor/sieteud.js';
import { posControlesSieteUdDe, paletaDadosDe, ESCENA_W, ESCENA_H } from './juego/sieteud.ts';
import type {
  DatosJuego, Juego, PosControlesSieteUd, ResultadoInstant, SieteUdCfg, SieteUdVisualCfg, TiradaInstant,
} from './types.ts';

type ElemId = keyof PosControlesSieteUd;

export const cfgSieteUdDe = (juego: Juego): SieteUdCfg => _cfg(juego.sieteud_cfg) as SieteUdCfg;

// Todas las posiciones (y tamaños en px: fuentes, bordes, radios) están
// pensadas para una escena fija de 420×860. En la pantalla real del
// jugador el celular casi nunca tiene esa proporción exacta, así que se
// escala la escena entera de forma uniforme (como una "letterbox") en vez
// de estirarla — si no, lo que se ubica en el editor queda corrido en
// cada celular. Es la misma técnica que ya usa `crearEscenario()` para
// Keno/Torre/Crash/etc., adaptada a un componente React puro.
function useEscalaEscena(): number {
  const calcular = () => (typeof window === 'undefined' ? 1
    : Math.min(window.innerWidth / ESCENA_W, window.innerHeight / ESCENA_H));
  const [escala, setEscala] = useState(calcular);
  useEffect(() => {
    const recalcular = () => setEscala(calcular());
    recalcular();
    window.addEventListener('resize', recalcular);
    window.addEventListener('orientationchange', recalcular);
    return () => {
      window.removeEventListener('resize', recalcular);
      window.removeEventListener('orientationchange', recalcular);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return escala;
}

// ---- Núcleo: motor de dados 3D + hook de partida + shell + mesa ----

function SieteUdGame({ juego, cfg, pos, saldoInicial, minBet, maxBet, paso, onJugar, edicion }: {
  juego: Juego; cfg: SieteUdCfg; pos: PosControlesSieteUd;
  saldoInicial: number; minBet: number; maxBet: number; paso: number;
  onJugar: JugarSieteUdFn;
  edicion?: EdicionMesa | null;
}) {
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const modoFichas = useMemo(() => fichasModoDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<Dados3D | null>(null);
  // Al editar, se puede ubicar el cartel de premio sin haber ganado.
  const cartelDemo = edicion?.seleccion === 'cartel';

  useEffect(() => {
    if (!canvasRef.current) return;
    const m = crearDados3D(canvasRef.current, {
      paleta: paletaDadosDe(cfg.tema), fondo: null, velo: cfg.velo, fondoAjuste: cfg.arte.mesa,
    });
    motorRef.current = m;
    return () => { m.destruir(); motorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { motorRef.current?.setPaleta(paletaDadosDe(cfg.tema)); }, [cfg.tema]);

  // Se cachea la imagen por URL: retocar (posición/zoom/blur/oscurecer) no
  // debe recrearla ni recargarla, o parpadea un frame sin fondo hasta que
  // vuelve a cargar.
  const fondoImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const arteMesaKey = JSON.stringify(cfg.arte.mesa);
  useEffect(() => {
    const m = motorRef.current; if (!m) return;
    if (!cfg.fondoUrl) { fondoImgRef.current = null; m.setFondo(null, null, cfg.velo); return; }
    let entry = fondoImgRef.current;
    if (!entry || entry.url !== cfg.fondoUrl) {
      const img = new Image();
      img.src = cfg.fondoUrl;
      entry = { url: cfg.fondoUrl, img };
      fondoImgRef.current = entry;
    }
    m.setFondo(entry.img, cfg.arte.mesa, cfg.velo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.fondoUrl, cfg.velo, arteMesaKey]);

  const animar = useCallback(
    (d: [number, number]): Promise<void> => motorRef.current?.tirar(d) ?? new Promise((r) => setTimeout(r, 200)),
    [],
  );
  const apuestaIni = fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000));
  const g = useSieteUd(cfg, saldoInicial, apuestaIni, onJugar, animar);

  return (
    <SieteUdShell
      nombre={juego.nombre} mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
      tema={tema} fondoUrl={cfg.fondoPantallaUrl || (juego.fondo_url as string) || null} fondoAjuste={cfg.arte.pantalla}
    >
      <SieteUdMesa
        cfg={cfg} pos={pos} est={g.est} fichas={fichas} modoFichas={modoFichas}
        minBet={minBet} maxBet={maxBet} paso={paso} canvasRef={canvasRef}
        onApuesta={g.setApuesta} onZona={g.setZona} onJugar={g.jugar} onOtra={g.reset}
        edicion={edicion} cartelDemo={cartelDemo}
      />
    </SieteUdShell>
  );
}

// ---- Pantalla real (llena el celular) ----

export function JugarSieteUd({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgSieteUdDe(juego), [juego]);
  const pos = useRef(posControlesSieteUdDe(cfg)).current;
  const escala = useEscalaEscena();

  const jugar: JugarSieteUdFn = async (zona, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, zona, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative', flexShrink: 0, width: ESCENA_W, height: ESCENA_H, transform: `scale(${escala})` }}>
        <SieteUdGame juego={juego} cfg={cfg} pos={pos} saldoInicial={Number(saldoInicial)}
          minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
          paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
      </div>
    </div>
  );
}

// ---- Vista previa: marco de teléfono + panel de edición al costado ----

export function PreviewSieteUd({ juego: juegoProp, onClose, onGuardarCfg, onGuardarJuego }: {
  juego: Juego; onClose: () => void;
  onGuardarCfg?: (patch: Partial<SieteUdCfg>) => Promise<void>;
  onGuardarJuego?: (patch: Record<string, unknown>) => Promise<void>;
}) {
  // Estado propio para que un toggle acá (ej. "mostrar el nombre") se
  // refleje al instante en la mesa, sin depender de que el padre re-renderice.
  const [juego, setJuego] = useState(juegoProp);
  useEffect(() => setJuego(juegoProp), [juegoProp]);
  const onJuego = useCallback(async (patch: Record<string, unknown>) => {
    setJuego((j) => ({ ...j, ...patch }));
    if (onGuardarJuego) await onGuardarJuego(patch);
  }, [onGuardarJuego]);

  const [cfg, setCfg] = useState<SieteUdCfg>(() => cfgSieteUdDe(juego));
  const [pos, setPos] = useState<PosControlesSieteUd>(() => posControlesSieteUdDe(cfgSieteUdDe(juego)));
  const [ajustar, setAjustar] = useState(false);
  const [sel, setSel] = useState<ElemId>('mesa');
  const historialRef = useRef<PosControlesSieteUd[]>([pos]);
  const indiceHistorial = useRef(0);
  const [estadoHistorial, setEstadoHistorial] = useState({ atras: false, adelante: false });
  const saldoRef = useRef(10000);

  // Fuente de verdad síncrona: evita que dos ediciones seguidas se pisen
  // (React re-renderiza después). `setCfg` es sólo para dibujar.
  const cfgRef = useRef(cfg);
  const bump = useCallback((mut: (c: SieteUdCfg) => SieteUdCfg) => {
    cfgRef.current = mut(cfgRef.current);
    setCfg(cfgRef.current);
  }, []);

  // guardado único con debounce + merge-sobre-DB (via Editor.guardarSieteUdCfg)
  const tRef = useRef<number | undefined>(undefined);
  const pendRef = useRef<Partial<SieteUdCfg>>({});
  const flush = useCallback(() => {
    const p = pendRef.current; pendRef.current = {};
    if (Object.keys(p).length && onGuardarCfg) void onGuardarCfg(p);
  }, [onGuardarCfg]);
  const guardar = useCallback((patch: Partial<SieteUdCfg>) => {
    pendRef.current = { ...pendRef.current, ...patch };
    window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(flush, 500);
  }, [flush]);
  useEffect(() => () => { window.clearTimeout(tRef.current); flush(); }, [flush]);

  const onCfg = useCallback((patch: Partial<SieteUdCfg>) => {
    bump((c) => _cfg({ ...c, ...patch }) as SieteUdCfg);
    guardar(patch);
  }, [bump, guardar]);
  const onArte = useCallback((k: 'pantalla' | 'mesa' | 'cartel' | 'boton', patch: Record<string, unknown>) => {
    const arte = { ...cfgRef.current.arte, [k]: { ...cfgRef.current.arte[k], ...patch } };
    bump((c) => _cfg({ ...c, arte }) as SieteUdCfg);
    guardar({ arte });
  }, [bump, guardar]);
  const actualizarEstadoHistorial = useCallback(() => {
    setEstadoHistorial({ atras: indiceHistorial.current > 0, adelante: indiceHistorial.current < historialRef.current.length - 1 });
  }, []);
  const aplicarPos = useCallback((next: PosControlesSieteUd, registrar = true) => {
    setPos(next);
    bump((c) => ({ ...c, controles: next }));
    guardar({ controles: next });
    if (registrar) {
      const anterior = historialRef.current[indiceHistorial.current];
      if (JSON.stringify(anterior) !== JSON.stringify(next)) {
        historialRef.current = [...historialRef.current.slice(0, indiceHistorial.current + 1), next];
        indiceHistorial.current = historialRef.current.length - 1;
        actualizarEstadoHistorial();
      }
    }
  }, [actualizarEstadoHistorial, bump, guardar]);
  const onPos = useCallback((next: PosControlesSieteUd) => aplicarPos(next), [aplicarPos]);
  const aplicarVisual = useCallback((visual: SieteUdVisualCfg) => {
    // Los presets nunca incluyen parámetros matemáticos. Se normaliza el
    // resultado, se actualiza la mesa al instante y se guarda en un solo patch.
    const siguiente = _cfg({ ...cfgRef.current, ...visual }) as SieteUdCfg;
    const siguientePos = posControlesSieteUdDe(siguiente);
    cfgRef.current = siguiente;
    setCfg(siguiente);
    setPos(siguientePos);
    guardar({ ...visual, controles: siguientePos });
    const anterior = historialRef.current[indiceHistorial.current];
    if (JSON.stringify(anterior) !== JSON.stringify(siguientePos)) {
      historialRef.current = [...historialRef.current.slice(0, indiceHistorial.current + 1), siguientePos];
      indiceHistorial.current = historialRef.current.length - 1;
      actualizarEstadoHistorial();
    }
  }, [actualizarEstadoHistorial, guardar]);
  const deshacer = useCallback(() => {
    if (indiceHistorial.current === 0) return;
    indiceHistorial.current -= 1;
    aplicarPos(historialRef.current[indiceHistorial.current], false);
    actualizarEstadoHistorial();
  }, [actualizarEstadoHistorial, aplicarPos]);
  const rehacer = useCallback(() => {
    if (indiceHistorial.current >= historialRef.current.length - 1) return;
    indiceHistorial.current += 1;
    aplicarPos(historialRef.current[indiceHistorial.current], false);
    actualizarEstadoHistorial();
  }, [actualizarEstadoHistorial, aplicarPos]);

  const jugar: JugarSieteUdFn = async (zona, apuesta) => {
    const r = _tirarLocal(cfg, zona) as TiradaInstant & { mult: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'sieteud' as const }, premio, saldo: saldoRef.current };
  };

  const cfgActual = useCallback(() => cfgRef.current, []);

  const edicion: EdicionMesa | null = ajustar
    ? {
        seleccion: sel, onSelect: setSel,
        // Mientras se arrastra: actualiza y guarda, sin anotar el historial
        // (si no, cada pointermove del arrastre sería un paso de deshacer).
        onPatch: (id, patch) => aplicarPos({ ...pos, [id]: { ...pos[id], ...patch } }, false),
        // Al soltar: un solo paso de deshacer con la posición final.
        onPatchFin: (id, patch) => onPos({ ...pos, [id]: { ...pos[id], ...patch } }),
        bloqueadas: cfg.editor.bloqueadas as ElemId[], snap: cfg.editor.snap,
      }
    : null;

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.86)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
      padding: '56px 16px 16px', overflow: 'auto',
    }}>
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 110, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="hint">plata de mentira</span>
        <button onClick={() => setAjustar((v) => !v)}>{ajustar ? '✓ Listo' : '⚙ Ajustar'}</button>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>

      <div style={{
        position: 'relative', flexShrink: 0,
        width: 'min(94vw, calc((100vh - 96px) * 420 / 860))',
        aspectRatio: '420 / 860', borderRadius: 26, overflow: 'hidden',
        border: '1px solid var(--border)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)',
      }}>
        <SieteUdGame juego={juego} cfg={cfg} pos={pos} saldoInicial={10000}
          minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
          paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} edicion={edicion} />
      </div>

      {ajustar && (
        <SieteUdEditor juego={juego} cfg={cfg} pos={pos} seleccion={sel} cfgActual={cfgActual}
          onSelPieza={setSel} onCfg={onCfg} onArte={onArte} onPos={onPos}
          mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
          onToggleNombre={(v) => onJuego({ mostrar_nombre: v })}
          puedeDeshacer={estadoHistorial.atras} puedeRehacer={estadoHistorial.adelante} onDeshacer={deshacer} onRehacer={rehacer}
          onAplicarVisual={aplicarVisual} />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
