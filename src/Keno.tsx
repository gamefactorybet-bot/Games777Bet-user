import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from './juego/recursos.ts';
import { InstantShell, ApuestaControl, BotonJugar, Saldo, Historial } from './InstantShell.tsx';
import { FichasStrip } from './Fichas.tsx';
import { fichasDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import { cfgConDefaults as _cfgKeno, tirar as _tirarKeno, tablaDe as _tablaKeno } from '../motor/keno.js';
import type { DatosJuego, Ficha, Juego, KenoCfg, ResultadoInstant, TiradaInstant } from './types.ts';

export const cfgKenoDe = (juego: Juego): KenoCfg => _cfgKeno(juego.keno_cfg) as KenoCfg;

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, reduce ? 0 : ms));
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

type Jugar = (marcados: number[], apuesta: number) =>
  Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

function cols(t: number) { return t === 25 ? 5 : t === 80 ? 10 : 8; }

// UI del Keno. `onJugar` la resuelve el servidor (JugarKeno) o el
// motor local (PreviewKeno).
function KenoJuego({ cfg, fichas, saldoInicial, minBet, maxBet, paso, onJugar }: {
  cfg: KenoCfg; fichas: Ficha[]; saldoInicial: number; minBet: number; maxBet: number; paso: number; onJugar: Jugar;
}) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(
    fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000)),
  );
  const [picked, setPicked] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [fase, setFase] = useState<'idle' | 'rolling' | 'done'>('idle');
  const [res, setRes] = useState<{ aciertos: number; mult: number; amount: number } | null>(null);
  const [hist, setHist] = useState<{ texto: string; gano: boolean }[]>([]);
  const [contador, setContador] = useState(0);
  const rafRef = useRef(0);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; cancelAnimationFrame(rafRef.current); }, []);

  const tabla = useMemo(
    () => (picked.length ? _tablaKeno(cfg, picked.length) as number[] : []),
    [cfg, picked.length],
  );

  const toggle = (n: number) => {
    if (fase !== 'idle') return;
    setPicked((p) => p.includes(n) ? p.filter((x) => x !== n) : p.length >= cfg.maxMarcar ? p : [...p, n]);
  };
  const auto = () => {
    if (fase !== 'idle') return;
    const pool: number[] = []; for (let i = 1; i <= cfg.tablero; i++) pool.push(i);
    setPicked(shuffle(pool).slice(0, cfg.maxMarcar).sort((a, b) => a - b));
  };
  const limpiar = () => { if (fase === 'rolling') return; setPicked([]); setDrawn([]); setRes(null); setFase('idle'); };

  const jugar = async () => {
    if (fase !== 'idle' || !picked.length || saldo < apuesta) return;
    setFase('rolling'); setRes(null); setDrawn([]); setSaldo((s) => s - apuesta);
    try {
      const r = await onJugar(picked, apuesta);
      const sorteados = r.resultado.sorteados || [];
      for (let i = 0; i < sorteados.length; i++) {
        if (!vivo.current) return;
        setDrawn(sorteados.slice(0, i + 1));
        await sleep(150);
      }
      await sleep(280);
      if (!vivo.current) return;
      const aciertos = r.resultado.aciertos ?? 0;
      const mult = Number(r.resultado.mult) || 0;
      const amount = Math.round(apuesta * mult);
      setSaldo(r.saldo);
      setRes({ aciertos, mult, amount });
      setFase('done');
      setHist((h) => [{ texto: aciertos + '/' + picked.length, gano: mult > 0 }, ...h].slice(0, 12));
      if (amount > 0) countUp(amount);
    } catch (err) {
      if (!vivo.current) return;
      setFase('idle'); setSaldo((s) => s + apuesta); setDrawn([]);
      setHist((h) => [{ texto: '—', gano: false }, ...h].slice(0, 12));
      console.error(err);
    }
  };

  const countUp = (to: number) => {
    const t0 = performance.now(), dur = reduce ? 0 : 700;
    const tick = (now: number) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      setContador(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const drawnSet = new Set(drawn);
  const pickedSet = new Set(picked);
  const nota = fase === 'rolling' ? 'Saliendo las bolas…'
    : res ? `${res.aciertos} de ${picked.length} aciertos` + (res.mult > 0 ? ` · paga ×${res.mult}` : ' · sin premio')
    : picked.length ? `${picked.length} marcados` + (picked.length >= cfg.maxMarcar ? ' · máximo' : '')
    : `Marcá entre 1 y ${cfg.maxMarcar} números`;

  return (
    <>
      <style>{`
        @keyframes kn-pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
        .kn-cell{aspect-ratio:1;border:1px solid var(--border);border-radius:9px;background:var(--surface-alt);
          font-family:var(--in-num,monospace);font-size:14px;color:var(--text-dim);cursor:pointer;
          display:grid;place-items:center;position:relative;transition:transform .1s,border-color .15s,background .15s;
          -webkit-tap-highlight-color:transparent;}
        .kn-cell:disabled{cursor:default}
        .kn-cell.pick{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:700}
        .kn-cell.drawn{background:rgba(217,164,65,.16);border-color:var(--warning,#d9a441);color:var(--warning,#d9a441)}
        .kn-cell.hit{background:rgba(63,208,160,.18);border-color:var(--ok);color:var(--ok);font-weight:700;transform:scale(1.05)}
        .kn-cell.miss{border-color:var(--danger);color:var(--danger)}
        .kn-cell.miss::after{content:"";position:absolute;inset:2px;border-radius:7px;
          background:linear-gradient(135deg,transparent 45%,var(--danger) 46%,var(--danger) 54%,transparent 55%);opacity:.45}
        .kn-ball{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;
          font-family:var(--in-num,monospace);font-size:12px;font-weight:600;color:#1a1206;
          background:radial-gradient(circle at 34% 30%,#f4d488,var(--warning,#d9a441));
          box-shadow:0 2px 7px -1px rgba(0,0,0,.5);animation:kn-pop .28s cubic-bezier(.2,1.3,.4,1)}
      `}</style>

      <Historial items={hist} />

      <div style={{
        display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', minHeight: 34, width: '100%',
        padding: '7px 9px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 11,
      }}>
        {drawn.length
          ? drawn.map((n, i) => <span key={i} className="kn-ball">{n}</span>)
          : <span className="hint" style={{ margin: 0, alignSelf: 'center', fontSize: 11 }}>las bolas salen acá</span>}
      </div>

      <div style={{ display: 'grid', gap: 5, gridTemplateColumns: `repeat(${cols(cfg.tablero)},1fr)`, width: '100%' }}>
        {Array.from({ length: cfg.tablero }, (_, i) => i + 1).map((n) => {
          let cls = 'kn-cell';
          if (res) {
            if (pickedSet.has(n) && drawnSet.has(n)) cls += ' hit';
            else if (pickedSet.has(n)) cls += ' miss';
            else if (drawnSet.has(n)) cls += ' drawn';
          } else {
            if (pickedSet.has(n)) cls += ' pick';
            if (drawnSet.has(n)) cls += ' drawn';
          }
          return (
            <button key={n} className={cls} disabled={fase !== 'idle'} onClick={() => toggle(n)}>{n}</button>
          );
        })}
      </div>

      <div className="hint" style={{ margin: '-4px 0 0' }}>{nota}</div>

      {res && res.mult > 0 && (
        <div style={{
          fontFamily: 'var(--in-num,monospace)', fontWeight: 600, fontSize: 30, color: 'var(--ok)',
          fontVariantNumeric: 'tabular-nums',
        }}>+{fmt(contador)}</div>
      )}

      {fichas.length > 0 ? (
        <FichasStrip fichas={fichas} apuesta={apuesta} bloqueado={fase === 'rolling'} onElegir={setApuesta} />
      ) : (
        <ApuestaControl apuesta={apuesta} minBet={minBet} maxBet={maxBet} paso={paso}
          ocupado={fase === 'rolling'} onApuesta={setApuesta} />
      )}

      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}>
        <button onClick={auto} disabled={fase !== 'idle'} style={secBtn}>Automático</button>
        <button onClick={limpiar} disabled={fase === 'rolling'} style={secBtn}>Limpiar</button>
      </div>

      <BotonJugar
        texto={fase === 'rolling' ? '…' : res ? 'Otra ronda' : 'Jugar'}
        disabled={fase === 'rolling' || (!res && (!picked.length || saldo < apuesta))}
        onClick={res ? limpiar : jugar}
      />

      {picked.length > 0 && !res && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
          {tabla.map((m, h) => (m > 0
            ? <span key={h} style={{
                fontFamily: 'var(--in-num,monospace)', padding: '2px 7px', borderRadius: 6,
                background: 'var(--surface-alt)', border: '1px solid var(--border)',
              }}>{h} → ×{m}</span>
            : null))}
        </div>
      )}

      <Saldo valor={saldo} />
    </>
  );
}

const secBtn: React.CSSProperties = {
  flex: 1, fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text-dim)',
  background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px', cursor: 'pointer',
};

// ---- Pantalla real ----
export function JugarKeno({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgKenoDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const url = cfg.fondoUrl;
    if (!url) { setCargando(false); return; }
    const im = new Image();
    im.onload = im.onerror = () => { if (vivo) setCargando(false); };
    im.src = url;
    const tope = setTimeout(() => { if (vivo) setCargando(false); }, 6000);
    return () => { vivo = false; clearTimeout(tope); };
  }, [cfg.fondoUrl]);

  const jugar: Jugar = async (marcados, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, marcados, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <InstantShell
      nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || cfg.fondoUrl || null} tema={tema}
      mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
      cargando={cargando} cargaImagen={(juego.carga_url as string) || (juego.portada_url as string) || null}
    >
      <KenoJuego cfg={cfg} fichas={fichas} saldoInicial={Number(saldoInicial)}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
    </InstantShell>
  );
}

// ---- Vista previa (plata de mentira) ----
export function PreviewKeno({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const cfg = useMemo(() => cfgKenoDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const saldoRef = useRef(50000);

  const jugar: Jugar = async (marcados, apuesta) => {
    const r = _tirarKeno(juego.keno_cfg, marcados) as TiradaInstant & { mult: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'keno' as const }, premio, saldo: saldoRef.current };
  };

  return (
    <InstantShell nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || cfg.fondoUrl || null} tema={tema} demo onCerrar={onClose}>
      <KenoJuego cfg={cfg} fichas={fichas} saldoInicial={50000}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
    </InstantShell>
  );
}
