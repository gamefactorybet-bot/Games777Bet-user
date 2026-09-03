import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchJson } from './juego/recursos.ts';
import { fichasDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import { crearDados3D, type Dados3D } from './juego/dados3d.ts';
import { SieteUdShell } from './SieteUdShell.tsx';
import { SieteUdMesa, type EdicionMesa } from './SieteUdMesa.tsx';
import { SieteUdEditor } from './SieteUdEditor.tsx';
import { useSieteUd, type JugarSieteUdFn } from './juego/useSieteUd.ts';
import { cfgConDefaults as _cfg, tirar as _tirarLocal } from '../motor/sieteud.js';
import { posControlesSieteUdDe, paletaDadosDe } from './juego/sieteud.ts';
import type {
  DatosJuego, Juego, PosControlesSieteUd, ResultadoInstant, SieteUdCfg, TiradaInstant,
} from './types.ts';

type ElemId = keyof PosControlesSieteUd;

export const cfgSieteUdDe = (juego: Juego): SieteUdCfg => _cfg(juego.sieteud_cfg) as SieteUdCfg;

// ---- Núcleo: motor de dados 3D + hook de partida + shell + mesa ----

function SieteUdGame({ juego, cfg, pos, saldoInicial, minBet, maxBet, paso, onJugar, edicion }: {
  juego: Juego; cfg: SieteUdCfg; pos: PosControlesSieteUd;
  saldoInicial: number; minBet: number; maxBet: number; paso: number;
  onJugar: JugarSieteUdFn;
  edicion?: EdicionMesa | null;
}) {
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<Dados3D | null>(null);

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

  const arteMesaKey = JSON.stringify(cfg.arte.mesa);
  useEffect(() => {
    const m = motorRef.current; if (!m) return;
    if (!cfg.fondoUrl) { m.setFondo(null, null, cfg.velo); return; }
    const img = new Image();
    img.src = cfg.fondoUrl;
    m.setFondo(img, cfg.arte.mesa, cfg.velo);
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
        cfg={cfg} pos={pos} est={g.est} fichas={fichas}
        minBet={minBet} maxBet={maxBet} paso={paso} canvasRef={canvasRef}
        onApuesta={g.setApuesta} onZona={g.setZona} onJugar={g.jugar} onOtra={g.reset}
        edicion={edicion}
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

  const jugar: JugarSieteUdFn = async (zona, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, zona, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <SieteUdGame juego={juego} cfg={cfg} pos={pos} saldoInicial={Number(saldoInicial)}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
    </div>
  );
}

// ---- Vista previa: marco de teléfono + panel de edición al costado ----

export function PreviewSieteUd({ juego, onClose, onGuardarCfg }: {
  juego: Juego; onClose: () => void;
  onGuardarCfg?: (patch: Partial<SieteUdCfg>) => Promise<void>;
}) {
  const [cfg, setCfg] = useState<SieteUdCfg>(() => cfgSieteUdDe(juego));
  const [pos, setPos] = useState<PosControlesSieteUd>(() => posControlesSieteUdDe(cfgSieteUdDe(juego)));
  const [ajustar, setAjustar] = useState(false);
  const [sel, setSel] = useState<ElemId>('mesa');
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
  const onPos = useCallback((next: PosControlesSieteUd) => {
    setPos(next);
    bump((c) => ({ ...c, controles: next }));
    guardar({ controles: next });
  }, [bump, guardar]);

  const jugar: JugarSieteUdFn = async (zona, apuesta) => {
    const r = _tirarLocal(cfg, zona) as TiradaInstant & { mult: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'sieteud' as const }, premio, saldo: saldoRef.current };
  };

  const edicion: EdicionMesa | null = ajustar
    ? { seleccion: sel, onSelect: setSel, onPatch: (id, patch) => onPos({ ...pos, [id]: { ...pos[id], ...patch } }) }
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
        <SieteUdEditor juego={juego} cfg={cfg} pos={pos} seleccion={sel}
          onSelPieza={setSel} onCfg={onCfg} onArte={onArte} onPos={onPos} />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
