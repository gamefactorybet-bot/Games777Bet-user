import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from './juego/recursos.ts';
import { InstantShell, ApuestaControl, BotonJugar, Saldo, Historial } from './InstantShell.tsx';
import { BotonAuto } from './BotonAuto.tsx';
import { useAutoplay } from './juego/autoplay.ts';
import { audiosDe, tocar } from './juego/sfx.ts';
import { FichasStrip } from './Fichas.tsx';
import { fichasDe, fichasVistaDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import {
  cfgConDefaults as _cfgDice, tirar as _tirarDice, umbralPermitido as _umbralOk, chanceDe as _chance,
} from '../motor/dice.js';
import type { DatosJuego, DiceCfg, Ficha, Juego, ResultadoInstant, TiradaInstant } from './types.ts';

export const cfgDiceDe = (juego: Juego): DiceCfg => _cfgDice(juego.dice_cfg) as DiceCfg;

type Dir = 'mayor' | 'menor';
type Jugar = (umbral: number, direccion: Dir, apuesta: number) =>
  Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

function DiceJuego({ cfg, fichas, modoFichas, abanicoApertura, abanicoArco, saldoInicial, minBet, maxBet, paso, onJugar, sonidos, motor }: {
  cfg: DiceCfg; fichas: Ficha[]; modoFichas: 'fila' | 'abanico'; abanicoApertura?: number; abanicoArco?: number; saldoInicial: number; minBet: number; maxBet: number; paso: number; onJugar: Jugar;
  sonidos?: { tipo: string; archivo_url?: string | null }[]; motor?: string;
}) {
  const audios = useMemo(() => audiosDe(sonidos, motor || 'dice'), [sonidos, motor]);
  const auto = useAutoplay();
  const jugarRef = useRef<() => void>(() => {});
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(
    fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000)),
  );
  const [dir, setDir] = useState<Dir>(cfg.direccionDefecto);
  const [umbral, setUmbralRaw] = useState(cfg.umbralDefecto);
  const [roll, setRoll] = useState<number | null>(null);
  const [fase, setFase] = useState<'idle' | 'rolling' | 'gano' | 'perdio'>('idle');
  const [hist, setHist] = useState<{ texto: string; gano: boolean }[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  const ok = (u: number, d: Dir) => (_umbralOk(cfg, u, d) as { umbral: number }).umbral;
  const setUmbral = (u: number, d: Dir = dir) => setUmbralRaw(ok(u, d));

  useEffect(() => { setUmbralRaw(ok(umbral, dir)); /* re-clamp al cambiar dir */ // eslint-disable-next-line
  }, [dir]);

  const prob = _chance(umbral, dir) as number;
  const mult = prob > 0 ? cfg.rtp / prob : 0;

  const mover = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const t = ((clientX - r.left) / r.width) * 100;
    setUmbral(Math.round(Math.max(0, Math.min(100, t)) * 100) / 100);
  };

  const jugar = async () => {
    if (fase === 'rolling' || saldo < apuesta) return;
    setFase('rolling'); setSaldo((s) => s - apuesta);
    tocar(audios, 'giro');
    try {
      const r = await onJugar(umbral, dir, apuesta);
      const v = Number(r.resultado.roll ?? 0);
      const gano = !!r.resultado.gano;
      setRoll(v);
      setTimeout(() => {
        setFase(gano ? 'gano' : 'perdio');
        tocar(audios, gano ? 'premio_chico' : 'perder');
        setSaldo(r.saldo);
        setHist((h) => [{ texto: v.toFixed(2), gano }, ...h].slice(0, 12));
        auto.continuar(() => jugarRef.current(), r.saldo >= apuesta);
      }, 560);
    } catch (err) {
      setFase('idle'); setSaldo((s) => s + apuesta);
      setHist((h) => [{ texto: '—', gano: false }, ...h].slice(0, 12));
      auto.stop();
      console.error(err);
    }
  };
  jugarRef.current = () => { void jugar(); };

  const resultColor = fase === 'gano' ? 'var(--ok)' : fase === 'perdio' ? 'var(--danger)' : 'var(--text-dim)';
  const zona: React.CSSProperties = dir === 'mayor'
    ? { left: `${umbral}%`, right: 0 }
    : { left: 0, width: `${umbral}%` };

  return (
    <>
      <Historial items={hist} />

      <div style={{
        fontFamily: 'var(--in-num, monospace)', fontWeight: 600, fontSize: 38, fontVariantNumeric: 'tabular-nums',
        color: resultColor, transition: 'color .2s', minHeight: 44,
      }}>{roll == null ? '—' : roll.toFixed(2)}</div>

      <div
        ref={trackRef}
        onPointerDown={(e) => { if ((e.target as HTMLElement).dataset.h !== '1') mover(e.clientX); }}
        style={{ position: 'relative', width: '100%', maxWidth: 440, height: 54, touchAction: 'none', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--in-num, monospace)', fontSize: 10, color: 'var(--text-dim)' }}>
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 22, height: 12, borderRadius: 999, background: 'var(--danger-soft, rgba(229,104,107,.14))', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, background: 'var(--accent-soft)', ...zona }} />
        </div>
        <div
          data-h="1"
          onPointerDown={() => { dragRef.current = true; }}
          onPointerMove={(e) => { if (dragRef.current) mover(e.clientX); }}
          onPointerUp={() => { dragRef.current = false; }}
          onPointerCancel={() => { dragRef.current = false; }}
          style={{
            position: 'absolute', top: 15, left: `${umbral}%`, width: 24, height: 24, borderRadius: 7,
            background: 'var(--accent)', border: '2px solid var(--surface)', transform: 'translateX(-50%)',
            cursor: 'grab', touchAction: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.4)',
          }}
        />
        {roll != null && (
          <div style={{
            position: 'absolute', top: 16, left: `${roll}%`, transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderTop: '11px solid var(--warning, #d9a441)', transition: 'left .5s cubic-bezier(.2,.8,.2,1)',
          }} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div>{dir === 'mayor' ? 'Mayor a' : 'Menor a'} <b style={{ color: 'var(--text)', fontFamily: 'var(--in-num, monospace)' }}>{umbral.toFixed(2)}</b></div>
        <div>Probabilidad <b style={{ color: 'var(--text)', fontFamily: 'var(--in-num, monospace)' }}>{(prob * 100).toFixed(2)}%</b></div>
        <div>Paga <b style={{ color: 'var(--text)', fontFamily: 'var(--in-num, monospace)' }}>{mult.toFixed(2)}×</b></div>
      </div>

      <div style={{ display: 'inline-flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
        {(['mayor', 'menor'] as Dir[]).map((d) => (
          <button key={d} onClick={() => setDir(d)} disabled={fase === 'rolling'} style={{
            border: 0, background: d === dir ? 'var(--surface-alt)' : 'transparent',
            color: d === dir ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'inherit', fontSize: 12.5,
            padding: '6px 16px', borderRadius: 5, cursor: 'pointer',
          }}>{d === 'mayor' ? 'Mayor' : 'Menor'}</button>
        ))}
      </div>

      {fichas.length > 0 ? (
        <FichasStrip fichas={fichas} apuesta={apuesta} bloqueado={fase === 'rolling'} onElegir={setApuesta} modo={modoFichas} abanicoApertura={abanicoApertura} abanicoArco={abanicoArco} />
      ) : (
        <ApuestaControl apuesta={apuesta} minBet={minBet} maxBet={maxBet} paso={paso}
          ocupado={fase === 'rolling'} onApuesta={setApuesta} />
      )}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', gap: 8, alignItems: 'center' }}>
        <BotonAuto enFlujo restantes={auto.restantes} activo={auto.activo}
          disabled={fase === 'rolling' || saldo < apuesta}
          onStart={(n) => auto.start(n, () => jugarRef.current())} onStop={auto.stop} />
        <div style={{ flex: 1 }}>
          <BotonJugar texto={fase === 'rolling' || auto.activo ? '…' : 'Tirar'} disabled={fase === 'rolling' || auto.activo || saldo < apuesta} onClick={jugar} />
        </div>
      </div>
      <Saldo valor={saldo} />
    </>
  );
}

// ---- Pantalla real ----
export function JugarDice({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgDiceDe(juego), [juego]);
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

  const jugar: Jugar = async (umbral, direccion, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, umbral, direccion, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <InstantShell
      nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || cfg.fondoUrl || null} tema={tema}
      mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
      cargando={cargando} cargaImagen={(juego.carga_url as string) || (juego.portada_url as string) || null}
    >
      <DiceJuego cfg={cfg} fichas={fichas} modoFichas={vistaFichas.modo} abanicoApertura={vistaFichas.abanicoApertura} abanicoArco={vistaFichas.abanicoArco} saldoInicial={Number(saldoInicial)}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} sonidos={datos.sonidos} motor={juego.motor} />
    </InstantShell>
  );
}

// ---- Vista previa (plata de mentira) ----
export function PreviewDice({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const cfg = useMemo(() => cfgDiceDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const vistaFichas = useMemo(() => fichasVistaDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const saldoRef = useRef(10000);

  const jugar: Jugar = async (umbral, direccion, apuesta) => {
    const r = _tirarDice(juego.dice_cfg, umbral, direccion) as TiradaInstant & { roll: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'dice' as const }, premio, saldo: saldoRef.current };
  };

  return (
    <InstantShell nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || cfg.fondoUrl || null} tema={tema} demo onCerrar={onClose}>
      <DiceJuego cfg={cfg} fichas={fichas} modoFichas={vistaFichas.modo} abanicoApertura={vistaFichas.abanicoApertura} abanicoArco={vistaFichas.abanicoArco} saldoInicial={10000}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} motor={juego.motor} />
    </InstantShell>
  );
}
