import {
  useEffect, useRef, useState,
  type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject,
} from 'react';
import { FichasStrip } from './Fichas.tsx';
import { crearDados3D, type Dados3D } from './juego/dados3d.ts';
import { ZONAS, ZONA_INFO, pagoDe, campana, paletaDadosDe } from './juego/sieteud.ts';
import type { Ficha, PosControlesSieteUd, SieteUdCfg, TiradaInstant, ZonaSieteUd } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export type JugarSieteUd = (zona: ZonaSieteUd, apuesta: number) =>
  Promise<{ resultado: TiradaInstant; premio: number; saldo: number }>;

type ElemId = keyof PosControlesSieteUd;

interface Props {
  cfg: SieteUdCfg;
  pos: PosControlesSieteUd;
  fichas: Ficha[];
  saldoInicial: number;
  minBet: number;
  maxBet: number;
  paso: number;
  onJugar: JugarSieteUd;
  /** ⚙ Ajustar: id de la pieza seleccionada (o null). Arrastrable en vivo. */
  ajusteElem?: ElemId | null;
  onSelectPieza?: (id: ElemId) => void;
  onDragPieza?: (id: ElemId, x: number, y: number) => void;
  /** Preview: mostrar el cartel de premio aunque no se haya ganado, para ubicarlo. */
  cartelDemo?: boolean;
}

export function SieteUdMesa({
  cfg, pos, fichas, saldoInicial, minBet, maxBet, paso, onJugar,
  ajusteElem, onSelectPieza, onDragPieza, cartelDemo,
}: Props) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(
    fichas.length ? Math.round(fichas[0].valor) : Math.max(minBet, Math.min(maxBet, 1000)),
  );
  const [zona, setZona] = useState<ZonaSieteUd>('siete');
  const [fase, setFase] = useState<'idle' | 'rolling' | 'gano' | 'perdio'>('idle');
  const [res, setRes] = useState<TiradaInstant | null>(null);
  const [hist, setHist] = useState<{ n: string; gano: boolean }[]>([]);
  const [cartelMonto, setCartelMonto] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<Dados3D | null>(null);
  const ajuste = !!ajusteElem;

  const barras = campana(cfg.caras);

  useEffect(() => {
    if (!canvasRef.current) return;
    let fondo: HTMLImageElement | null = null;
    if (cfg.fondoUrl) { fondo = new Image(); fondo.src = cfg.fondoUrl; }
    const m = crearDados3D(canvasRef.current, { paleta: paletaDadosDe(cfg.tema), fondo, velo: 0.5 });
    motorRef.current = m;
    return () => { m.destruir(); motorRef.current = null; };
  }, [cfg.tema, cfg.fondoUrl]);

  // re-medir el canvas cuando cambia el tamaño de su caja en ⚙ Ajustar
  useEffect(() => { motorRef.current?.resize(); }, [pos.mesa.w, pos.mesa.h]);

  const jugar = async () => {
    if (fase === 'rolling' || saldo < apuesta || ajuste) return;
    setFase('rolling'); setRes(null); setCartelMonto(null);
    setSaldo((s) => s - apuesta);
    try {
      const r = await onJugar(zona, apuesta);
      const dados = (r.resultado.dados || [3, 4]) as [number, number];
      await motorRef.current?.tirar(dados);
      const gano = !!r.resultado.gano;
      setRes(r.resultado);
      setFase(gano ? 'gano' : 'perdio');
      setSaldo(r.saldo);
      setHist((h) => [{ n: String(r.resultado.suma ?? dados[0] + dados[1]), gano }, ...h].slice(0, 12));
      if (gano) setCartelMonto(r.premio);
    } catch (err) {
      setFase('idle'); setSaldo((s) => s + apuesta); console.error(err);
    }
  };
  const otra = () => { setFase('idle'); setRes(null); setCartelMonto(null); };

  const suma = res?.suma ?? null;
  const zg = res?.zonaGanadora ?? null;
  const sumColor = fase === 'gano' ? 'var(--ok)' : fase === 'perdio' ? 'var(--danger)' : 'var(--accent)';
  const cartelVisible = cartelMonto != null || cartelDemo;

  return (
    <div ref={stageRef} style={{
      position: 'relative', width: '100%', maxWidth: 420, aspectRatio: '420 / 760',
      margin: '0 auto', overflow: 'hidden', touchAction: ajuste ? 'none' : undefined,
      fontFamily: 'var(--in-body, inherit)',
    }}>
      {/* Saldo */}
      <Pieza id="saldo" p={pos.saldo} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
          <strong style={{ display: 'block', fontSize: 14, color: 'var(--text)' }}>{fmt(saldo)}</strong>
        </div>
      </Pieza>

      {/* Historial */}
      <Pieza id="historial" p={pos.historial} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <div style={{ display: 'flex', gap: 4, maxWidth: 180, overflow: 'hidden', flexWrap: 'nowrap' }}>
          {hist.length === 0 && <span className="hint" style={{ margin: 0, fontSize: 10 }}>historial</span>}
          {hist.map((h, i) => (
            <span key={i} style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              fontVariantNumeric: 'tabular-nums',
              background: h.gano ? 'var(--accent-soft)' : 'var(--surface-alt)',
              color: h.gano ? 'var(--ok)' : 'var(--text-dim)',
            }}>{h.n}</span>
          ))}
        </div>
      </Pieza>

      {/* Mesa (dados 3D) */}
      <Pieza id="mesa" p={pos.mesa} box={{ w: pos.mesa.w, h: pos.mesa.h }} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden',
          border: '1px solid var(--border)', boxShadow: 'inset 0 2px 12px rgba(0,0,0,.5)',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </Pieza>

      {/* Cartel de premio */}
      {cartelVisible && (
        <Pieza id="cartel" p={pos.cartel} box={{ w: pos.cartel.w, h: pos.cartel.h }} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden', display: 'grid', placeItems: 'center',
            border: '1px solid var(--accent)', backgroundColor: 'var(--surface-alt)',
            background: cfg.cartelUrl ? `center/cover no-repeat url("${cfg.cartelUrl}")` : undefined,
            boxShadow: '0 22px 55px -14px rgba(0,0,0,.6)',
            animation: cartelMonto != null ? 'sud-cartel .42s cubic-bezier(.2,1.35,.4,1)' : undefined,
          }}>
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 10, background: 'linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.6))' }}>
              <div>
                <b style={{ display: 'block', fontWeight: 800, color: '#fff', fontSize: 'clamp(15px,4.4vw,24px)', textShadow: '0 2px 12px rgba(0,0,0,.65)' }}>¡GANASTE!</b>
                <span style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 'clamp(11px,3vw,15px)', color: 'var(--ok)' }}>
                  +{fmt(cartelMonto ?? Math.round(apuesta * pagoDe(cfg, zona)))}
                </span>
              </div>
            </div>
          </div>
        </Pieza>
      )}
      <style>{'@keyframes sud-cartel{from{transform:translate(-50%,-50%) scale(.7);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}'}</style>

      {/* Suma */}
      <Pieza id="suma" p={pos.suma} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <div style={{
          fontFamily: 'var(--in-num, monospace)', fontWeight: 600, fontSize: 32, lineHeight: 1,
          color: sumColor, transition: 'color .2s', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>
          {fase === 'rolling' ? '…' : suma == null ? '7' : suma}
          {suma != null && fase !== 'rolling' && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 7 }}>
              {zg === 'abajo' ? 'ABAJO' : zg === 'siete' ? 'LUCKY 7' : 'ARRIBA'}
            </span>
          )}
        </div>
      </Pieza>

      {/* Campana */}
      <Pieza id="campana" p={pos.campana} box={{ w: pos.campana.w }} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, width: '100%' }}>
          {barras.map((b) => (
            <div key={b.suma} style={{
              flex: 1, minWidth: 0, borderRadius: '3px 3px 0 0', height: `${Math.round(b.frac * 100)}%`,
              background: b.zona === 'siete' ? 'var(--accent)' : 'var(--surface-alt)',
              opacity: suma === b.suma && fase !== 'rolling' ? 1 : 0.5,
              outline: suma === b.suma && fase !== 'rolling' ? '1px solid var(--accent)' : 'none',
            }} />
          ))}
        </div>
      </Pieza>

      {/* Zonas */}
      <Pieza id="zonas" p={pos.zonas} box={{ w: pos.zonas.w }} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, width: '100%' }}>
          {ZONAS.map((z) => {
            const sel = zona === z;
            const win = (fase === 'gano' || fase === 'perdio') && zg === z;
            const lost = fase === 'perdio' && sel && !win;
            return (
              <button key={z} disabled={fase === 'rolling' || ajuste}
                onClick={() => fase === 'idle' && !ajuste && setZona(z)}
                style={{
                  padding: '9px 4px', borderRadius: 11, cursor: fase === 'idle' && !ajuste ? 'pointer' : 'default', textAlign: 'center',
                  border: `1px solid ${win ? 'var(--ok)' : sel ? 'var(--accent)' : 'var(--border)'}`,
                  background: win || sel ? 'var(--accent-soft)' : 'var(--surface-alt)',
                  opacity: (fase === 'gano' || fase === 'perdio') && !win && !lost ? 0.4 : 1,
                }}>
                <div style={{ fontWeight: 700, fontSize: 11.5, color: z === 'siete' ? 'var(--accent)' : 'var(--text)' }}>{ZONA_INFO[z].nombre}</div>
                <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 9.5, color: 'var(--text-dim)', margin: '2px 0 5px' }}>{ZONA_INFO[z].rango}</div>
                <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 14, color: win ? 'var(--ok)' : lost ? 'var(--danger)' : 'var(--accent)' }}>{pagoDe(cfg, z).toFixed(2)}×</div>
              </button>
            );
          })}
        </div>
      </Pieza>

      {/* Apuesta / fichas */}
      <Pieza id="apuesta" p={pos.apuesta} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        {fichas.length > 0 ? (
          <div style={{ pointerEvents: ajuste ? 'none' : 'auto' }}>
            <FichasStrip fichas={fichas} apuesta={apuesta} bloqueado={fase === 'rolling'} onElegir={setApuesta} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: ajuste ? 'none' : 'auto' }}>
            <button disabled={fase === 'rolling'} onClick={() => setApuesta((a) => Math.max(minBet, a - paso))} style={stepBtn}>−</button>
            <span style={{ minWidth: 96, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
              <strong style={{ fontSize: 15, color: 'var(--text)' }}>{fmt(apuesta)}</strong>
            </span>
            <button disabled={fase === 'rolling'} onClick={() => setApuesta((a) => Math.min(maxBet, a + paso))} style={stepBtn}>+</button>
          </div>
        )}
      </Pieza>

      {/* Botón */}
      <Pieza id="boton" p={pos.boton} box={{ w: pos.boton.w }} {...{ ajusteElem, onSelectPieza, onDragPieza, stageRef }}>
        <button
          onClick={() => { if (ajuste) return; if (fase === 'gano' || fase === 'perdio') otra(); else jugar(); }}
          disabled={fase === 'rolling' || saldo < apuesta}
          style={{
            width: '100%', padding: '13px 0', border: 0, borderRadius: 12, cursor: ajuste ? 'move' : 'pointer',
            fontFamily: 'var(--in-num, var(--in-body, inherit))', fontWeight: 800, letterSpacing: '.03em', fontSize: 16,
            background: 'var(--accent)', color: 'var(--accent-text, #fff)',
            boxShadow: '0 10px 26px -8px rgba(0,0,0,.35)', opacity: (fase === 'rolling' || saldo < apuesta) ? 0.55 : 1,
          }}>
          {fase === 'rolling' ? '…' : fase === 'idle' ? 'Tirar' : 'Tirar de nuevo'}
        </button>
      </Pieza>
    </div>
  );
}

// ---------------- Pieza posicionable / arrastrable ----------------

function Pieza({
  id, p, box, children, ajusteElem, onSelectPieza, onDragPieza, stageRef,
}: {
  id: ElemId;
  p: { x: number; y: number };
  box?: { w: number; h?: number };
  children: ReactNode;
  ajusteElem?: ElemId | null;
  onSelectPieza?: (id: ElemId) => void;
  onDragPieza?: (id: ElemId, x: number, y: number) => void;
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  const drag = useRef(false);
  const ajuste = !!ajusteElem;
  const sel = ajusteElem === id;

  const mover = (e: ReactPointerEvent) => {
    if (!drag.current || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - r.left) / r.width) * 100, 2, 98);
    const y = clamp(((e.clientY - r.top) / r.height) * 100, 2, 98);
    onDragPieza?.(id, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  const style: CSSProperties = {
    position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
    width: box ? `${box.w}%` : undefined,
    height: box?.h != null ? `${box.h}%` : undefined,
    display: box ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center',
    touchAction: ajuste ? 'none' : undefined,
    cursor: ajuste ? 'move' : undefined,
    outline: sel ? '2px dashed var(--accent)' : ajuste ? '1px dashed rgba(255,255,255,.2)' : 'none',
    outlineOffset: 3, borderRadius: 6,
    zIndex: id === 'cartel' ? 8 : sel ? 6 : 4,
  };

  return (
    <div
      style={style}
      onPointerDown={ajuste ? (e) => {
        e.stopPropagation();
        drag.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        onSelectPieza?.(id);
      } : undefined}
      onPointerMove={ajuste ? mover : undefined}
      onPointerUp={ajuste ? () => { drag.current = false; } : undefined}
      onPointerCancel={ajuste ? () => { drag.current = false; } : undefined}
    >
      {ajuste && (
        <span style={{
          position: 'absolute', top: -16, left: 0, fontFamily: 'var(--in-num, monospace)', fontSize: 9,
          color: '#fff', background: sel ? 'var(--accent)' : 'rgba(0,0,0,.55)', padding: '1px 5px', borderRadius: 5, whiteSpace: 'nowrap',
        }}>{id}</span>
      )}
      {children}
    </div>
  );
}

const stepBtn: CSSProperties = {
  width: 38, height: 42, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-alt)',
  color: 'var(--text)', fontSize: 19, fontWeight: 700, cursor: 'pointer',
};
