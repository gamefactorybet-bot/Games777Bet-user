import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from './juego/recursos.ts';
import { InstantShell, ApuestaControl, BotonJugar, Saldo, Historial } from './InstantShell.tsx';
import { audiosDe, tocar } from './juego/sfx.ts';
import { FichasStrip } from './Fichas.tsx';
import { fichasDe, fichasVistaDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import { cfgConDefaults as _cfgLimbo, tirar as _tirarLimbo } from '../motor/limbo.js';
import type { DatosJuego, Ficha, Juego, LimboCfg, ResultadoInstant, TiradaInstant } from './types.ts';

export const cfgLimboDe = (juego: Juego): LimboCfg => _cfgLimbo(juego.limbo_cfg) as LimboCfg;

type Jugar = (objetivo: number, apuesta: number) => Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

// UI del Limbo. `onJugar` la resuelve el servidor (JugarLimbo) o el
// motor local (PreviewLimbo).
function LimboJuego({ cfg, fichas, modoFichas, abanicoApertura, abanicoArco, saldoInicial, minBet, maxBet, paso, onJugar, sonidos, motor }: {
  cfg: LimboCfg; fichas: Ficha[]; modoFichas: 'fila' | 'abanico'; abanicoApertura?: number; abanicoArco?: number; saldoInicial: number; minBet: number; maxBet: number; paso: number; onJugar: Jugar;
  sonidos?: { tipo: string; archivo_url?: string | null }[]; motor?: string;
}) {
  const audios = useMemo(() => audiosDe(sonidos, motor || 'limbo'), [sonidos, motor]);
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(
    fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000)),
  );
  const [objetivo, setObjetivo] = useState(cfg.objetivoDefecto);
  const [texto, setTexto] = useState(objetivo.toFixed(2));
  const [num, setNum] = useState('1.00');
  const [fase, setFase] = useState<'idle' | 'rolling' | 'gano' | 'perdio'>('idle');
  const [hist, setHist] = useState<{ texto: string; gano: boolean }[]>([]);
  const [nota, setNota] = useState('Ganás si el número llega a tu objetivo');
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const jugar = async () => {
    if (fase === 'rolling' || saldo < apuesta) return;
    const obj = clamp(parseFloat(texto.replace(',', '.')) || cfg.objetivoDefecto, 1.01, cfg.tope);
    setObjetivo(obj); setTexto(obj.toFixed(2));
    setFase('rolling'); setSaldo((s) => s - apuesta);
    tocar(audios, 'giro');
    try {
      const r = await onJugar(obj, apuesta);
      const X = Number(r.resultado.resultado ?? 1);
      const gano = !!r.resultado.gano;
      const dur = Math.min(1500, 500 + Math.log2(X + 1) * 220);
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setNum((1 + (X - 1) * e).toFixed(2));
        if (p < 1) { rafRef.current = requestAnimationFrame(tick); return; }
        setNum(X.toFixed(2));
        setFase(gano ? 'gano' : 'perdio');
        tocar(audios, gano ? 'premio_chico' : 'perder');
        setSaldo(r.saldo);
        setNota(gano ? `¡Ganaste! ×${r.resultado.objetivo?.toFixed(2)}` : `Cayó en ${X.toFixed(2)}× · objetivo ×${obj.toFixed(2)}`);
        setHist((h) => [{ texto: X.toFixed(2) + '×', gano }, ...h].slice(0, 12));
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setFase('idle'); setSaldo((s) => s + apuesta);
      setNota((err as Error).message || 'No se pudo resolver la jugada.');
    }
  };

  const color = fase === 'gano' ? 'var(--ok)' : fase === 'perdio' ? 'var(--danger)' : fase === 'rolling' ? 'var(--text)' : 'var(--text-dim)';

  return (
    <>
      <Historial items={hist} />

      <div style={{
        fontFamily: 'var(--in-num, monospace)', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        fontSize: 'clamp(46px, 15vw, 82px)', lineHeight: 1, letterSpacing: '-.02em', color,
        transition: 'color .2s',
      }}>{num}×</div>
      <div className="hint" style={{ marginTop: -6 }}>{nota}</div>

      <label style={{ textAlign: 'center' }}>
        <span className="hint" style={{ display: 'block', fontSize: 9, textTransform: 'uppercase' }}>Objetivo ×</span>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => setTexto(clamp(parseFloat(texto.replace(',', '.')) || cfg.objetivoDefecto, 1.01, cfg.tope).toFixed(2))}
          disabled={fase === 'rolling'}
          inputMode="decimal"
          style={{
            width: 110, textAlign: 'center', fontFamily: 'var(--in-num, monospace)', fontSize: 16,
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
            borderRadius: 8, padding: '8px 4px',
          }}
        />
      </label>

      {fichas.length > 0 ? (
        <FichasStrip fichas={fichas} apuesta={apuesta} bloqueado={fase === 'rolling'} onElegir={setApuesta} modo={modoFichas} abanicoApertura={abanicoApertura} abanicoArco={abanicoArco} />
      ) : (
        <ApuestaControl apuesta={apuesta} minBet={minBet} maxBet={maxBet} paso={paso}
          ocupado={fase === 'rolling'} onApuesta={setApuesta} />
      )}
      <BotonJugar texto={fase === 'rolling' ? '…' : 'Apostar'} disabled={fase === 'rolling' || saldo < apuesta} onClick={jugar} />
      <Saldo valor={saldo} />
    </>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---- Pantalla real ----
export function JugarLimbo({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgLimboDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const vistaFichas = useMemo(() => fichasVistaDe(juego), [juego]);
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

  const jugar: Jugar = async (objetivo, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, objetivo, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <InstantShell
      nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || cfg.fondoUrl || null} tema={tema}
      mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
      cargando={cargando} cargaImagen={(juego.carga_url as string) || (juego.portada_url as string) || null}
    >
      <LimboJuego cfg={cfg} fichas={fichas} modoFichas={vistaFichas.modo} abanicoApertura={vistaFichas.abanicoApertura} abanicoArco={vistaFichas.abanicoArco} saldoInicial={Number(saldoInicial)}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} sonidos={datos.sonidos} motor={juego.motor} />
    </InstantShell>
  );
}

// ---- Vista previa (plata de mentira) ----
export function PreviewLimbo({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const cfg = useMemo(() => cfgLimboDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const vistaFichas = useMemo(() => fichasVistaDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const saldoRef = useRef(10000);

  const jugar: Jugar = async (objetivo, apuesta) => {
    const r = _tirarLimbo(juego.limbo_cfg, objetivo) as TiradaInstant & { resultado: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'limbo' as const }, premio, saldo: saldoRef.current };
  };

  return (
    <InstantShell nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || cfg.fondoUrl || null} tema={tema} demo onCerrar={onClose}>
      <LimboJuego cfg={cfg} fichas={fichas} modoFichas={vistaFichas.modo} abanicoApertura={vistaFichas.abanicoApertura} abanicoArco={vistaFichas.abanicoArco} saldoInicial={10000}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} motor={juego.motor} />
    </InstantShell>
  );
}
