import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from './juego/recursos.ts';
import { InstantShell, ApuestaControl, BotonJugar, Saldo, Historial } from './InstantShell.tsx';
import { FichasStrip } from './Fichas.tsx';
import { fichasDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import { crearDados3D, type Dados3D } from './juego/dados3d.ts';
import {
  cfgConDefaults as _cfg, tirar as _tirarLocal,
} from '../motor/sieteud.js';
import { ZONAS, ZONA_INFO, pagoDe, campana, paletaDadosDe } from './juego/sieteud.ts';
import type {
  DatosJuego, Ficha, Juego, ResultadoInstant, SieteUdCfg, TiradaInstant, ZonaSieteUd,
} from './types.ts';

export const cfgSieteUdDe = (juego: Juego): SieteUdCfg => _cfg(juego.sieteud_cfg) as SieteUdCfg;

type Jugar = (zona: ZonaSieteUd, apuesta: number) =>
  Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

function SieteUdJuego({ cfg, fichas, saldoInicial, minBet, maxBet, paso, onJugar }: {
  cfg: SieteUdCfg; fichas: Ficha[]; saldoInicial: number; minBet: number; maxBet: number; paso: number; onJugar: Jugar;
}) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(
    fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000)),
  );
  const [zona, setZona] = useState<ZonaSieteUd>('siete');
  const [fase, setFase] = useState<'idle' | 'rolling' | 'gano' | 'perdio'>('idle');
  const [res, setRes] = useState<TiradaInstant | null>(null);
  const [hist, setHist] = useState<{ texto: string; gano: boolean }[]>([]);
  const [cartel, setCartel] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<Dados3D | null>(null);

  const barras = useMemo(() => campana(cfg.caras), [cfg.caras]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let fondo: HTMLImageElement | null = null;
    if (cfg.fondoUrl) { fondo = new Image(); fondo.src = cfg.fondoUrl; }
    const m = crearDados3D(canvasRef.current, {
      paleta: paletaDadosDe(cfg.tema),
      fondo,
      velo: 0.5,
    });
    motorRef.current = m;
    return () => { m.destruir(); motorRef.current = null; };
  }, [cfg.tema, cfg.fondoUrl]);

  const jugar = async () => {
    if (fase === 'rolling' || saldo < apuesta) return;
    setFase('rolling'); setCartel(null); setRes(null);
    setSaldo((s) => s - apuesta);
    try {
      const r = await onJugar(zona, apuesta);
      const dados = (r.resultado.dados || [3, 4]) as [number, number];
      await motorRef.current?.tirar(dados);
      const gano = !!r.resultado.gano;
      setRes(r.resultado);
      setFase(gano ? 'gano' : 'perdio');
      setSaldo(r.saldo);
      setHist((h) => [{ texto: String(r.resultado.suma ?? dados[0] + dados[1]), gano }, ...h].slice(0, 12));
      if (gano) setCartel(r.premio);
    } catch (err) {
      setFase('idle'); setSaldo((s) => s + apuesta);
      console.error(err);
    }
  };

  const suma = res?.suma ?? null;
  const zg = res?.zonaGanadora ?? null;
  const sumColor = fase === 'gano' ? 'var(--ok)' : fase === 'perdio' ? 'var(--danger)' : 'var(--accent)';

  return (
    <>
      <Historial items={hist} />

      <div style={{
        position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '5 / 4',
        borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)',
        boxShadow: 'inset 0 2px 12px rgba(0,0,0,.5), 0 16px 34px -20px rgba(0,0,0,.7)',
      }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {cartel != null && (
          <div style={{
            position: 'absolute', left: '12%', top: '20%', width: '76%', height: '26%',
            borderRadius: 14, overflow: 'hidden', display: 'grid', placeItems: 'center',
            border: '1px solid var(--accent)', backgroundColor: 'var(--surface-alt)',
            background: cfg.cartelUrl ? `center/cover no-repeat url("${cfg.cartelUrl}")` : undefined,
            boxShadow: '0 22px 55px -14px rgba(0,0,0,.6)',
            animation: 'sud-cartel .42s cubic-bezier(.2,1.35,.4,1)',
          }}>
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 10, background: 'linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.6))' }}>
              <div>
                <b style={{ display: 'block', fontFamily: 'var(--in-body, inherit)', fontWeight: 800, color: '#fff', fontSize: 'clamp(15px,3.6vw,24px)', textShadow: '0 2px 12px rgba(0,0,0,.65)' }}>¡GANASTE!</b>
                <span style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 'clamp(11px,2.4vw,15px)', color: 'var(--ok)' }}>+{fmt(cartel)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{'@keyframes sud-cartel{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}'}</style>

      <div style={{
        fontFamily: 'var(--in-num, monospace)', fontWeight: 600, fontSize: 34, lineHeight: 1,
        color: sumColor, transition: 'color .2s', minHeight: 40, fontVariantNumeric: 'tabular-nums',
      }}>
        {fase === 'rolling' ? '…' : suma == null ? '—' : suma}
        {suma != null && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)', marginLeft: 8 }}>
            {zg === 'abajo' ? 'ABAJO' : zg === 'siete' ? 'LUCKY 7' : 'ARRIBA'}
          </span>
        )}
      </div>

      {/* campana */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 42, width: '100%', maxWidth: 300 }}>
        {barras.map((b) => (
          <div key={b.suma} style={{
            flex: 1, minWidth: 0, borderRadius: '3px 3px 0 0', height: `${Math.round(b.frac * 100)}%`,
            background: b.zona === 'siete' ? 'var(--accent)' : 'var(--surface-alt)',
            opacity: suma === b.suma ? 1 : 0.5,
            outline: suma === b.suma ? '1px solid var(--accent)' : 'none',
          }} />
        ))}
      </div>

      {/* zonas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, width: '100%', maxWidth: 420 }}>
        {ZONAS.map((z) => {
          const sel = zona === z;
          const win = fase !== 'idle' && fase !== 'rolling' && zg === z;
          const lost = (fase === 'perdio') && sel;
          return (
            <button key={z} onClick={() => fase === 'idle' && setZona(z)} disabled={fase === 'rolling'} style={{
              padding: '11px 6px', borderRadius: 12, cursor: fase === 'idle' ? 'pointer' : 'default', textAlign: 'center',
              border: `1px solid ${win ? 'var(--ok)' : sel ? 'var(--accent)' : 'var(--border)'}`,
              background: win ? 'var(--accent-soft)' : sel ? 'var(--accent-soft)' : 'var(--surface-alt)',
              opacity: (fase !== 'idle' && fase !== 'rolling' && !win && !lost) ? 0.4 : 1,
            }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: z === 'siete' ? 'var(--accent)' : 'var(--text)' }}>{ZONA_INFO[z].nombre}</div>
              <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 10, color: 'var(--text-dim)', margin: '3px 0 6px' }}>{ZONA_INFO[z].rango}</div>
              <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 15, color: win ? 'var(--ok)' : lost ? 'var(--danger)' : 'var(--accent)' }}>{pagoDe(cfg, z).toFixed(2)}×</div>
            </button>
          );
        })}
      </div>

      {fichas.length > 0 ? (
        <FichasStrip fichas={fichas} apuesta={apuesta} bloqueado={fase === 'rolling'} onElegir={setApuesta} />
      ) : (
        <ApuestaControl apuesta={apuesta} minBet={minBet} maxBet={maxBet} paso={paso}
          ocupado={fase === 'rolling'} onApuesta={setApuesta} />
      )}
      <BotonJugar texto={fase === 'rolling' ? '…' : fase === 'idle' ? 'Tirar' : 'Tirar de nuevo'}
        disabled={fase === 'rolling' || saldo < apuesta}
        onClick={() => { if (fase === 'gano' || fase === 'perdio') { setFase('idle'); setRes(null); setCartel(null); } else jugar(); }} />
      <Saldo valor={saldo} />
    </>
  );
}

// ---- Pantalla real ----
export function JugarSieteUd({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgSieteUdDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);

  const jugar: Jugar = async (zona, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, zona, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <InstantShell
      nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || null} tema={tema}
      mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
      cargaImagen={(juego.carga_url as string) || (juego.portada_url as string) || null}
    >
      <SieteUdJuego cfg={cfg} fichas={fichas} saldoInicial={Number(saldoInicial)}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
    </InstantShell>
  );
}

// ---- Vista previa (plata de mentira) ----
export function PreviewSieteUd({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const cfg = useMemo(() => cfgSieteUdDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const saldoRef = useRef(10000);

  const jugar: Jugar = async (zona, apuesta) => {
    const r = _tirarLocal(juego.sieteud_cfg, zona) as TiradaInstant & { mult: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'sieteud' as const }, premio, saldo: saldoRef.current };
  };

  return (
    <InstantShell nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || null} tema={tema} demo onCerrar={onClose}>
      <SieteUdJuego cfg={cfg} fichas={fichas} saldoInicial={10000}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
    </InstantShell>
  );
}
