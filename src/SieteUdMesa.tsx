import { useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { FichasStrip } from './Fichas.tsx';
import { Pieza, type PatchPieza, type ValPieza } from './SieteUdPieza.tsx';
import { ZONAS, ZONA_INFO, pagoDe, campana, estiloImg, PIEZAS_SIETEUD } from './juego/sieteud.ts';
import type { EstadoSieteUd } from './juego/useSieteUd.ts';
import type { Ficha, PosControlesSieteUd, SieteUdCfg, ZonaSieteUd } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
type ElemId = keyof PosControlesSieteUd;
const TIPO = Object.fromEntries(PIEZAS_SIETEUD.map((p) => [p.id, p.tipo])) as Record<ElemId, 'punto' | 'ancho' | 'caja'>;

export interface EdicionMesa {
  seleccion: ElemId | null;
  onSelect: (id: ElemId) => void;
  onPatch: (id: ElemId, patch: PatchPieza) => void;
}

interface Props {
  cfg: SieteUdCfg;
  pos: PosControlesSieteUd;
  est: EstadoSieteUd;
  fichas: Ficha[];
  minBet: number; maxBet: number; paso: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onApuesta: (n: number) => void;
  onZona: (z: ZonaSieteUd) => void;
  onJugar: () => void;
  onOtra: () => void;
  edicion?: EdicionMesa | null;
  /** mostrar el cartel de premio sin haber ganado (para ubicarlo). */
  cartelDemo?: boolean;
}

export function SieteUdMesa({
  cfg, pos, est, fichas, minBet, maxBet, paso, canvasRef,
  onApuesta, onZona, onJugar, onOtra, edicion, cartelDemo,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const editando = !!edicion;
  const seleccion = edicion?.seleccion ?? null;
  const { fase, res } = est;
  const rolling = fase === 'rolling';
  const suma = res?.suma ?? null;
  const zg = res?.zonaGanadora ?? null;
  const barras = campana(cfg.caras);
  const sumColor = fase === 'gano' ? 'var(--ok)' : fase === 'perdio' ? 'var(--danger)' : 'var(--accent)';
  const cartelVisible = est.cartel != null || cartelDemo;

  const P = (id: ElemId, children: ReactNode, zBase?: number) => (
    <Pieza
      id={id} tipo={TIPO[id]} v={pos[id] as ValPieza} seleccion={seleccion}
      onSelect={edicion?.onSelect} onPatch={edicion?.onPatch} stageRef={stageRef}
      zBase={zBase}
    >{children}</Pieza>
  );

  return (
    <div ref={stageRef} style={{ position: 'absolute', inset: 0, touchAction: editando ? 'none' : undefined, fontFamily: 'var(--in-body, inherit)' }}>

      {P('saldo', (
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 5px rgba(0,0,0,.5)' }}>
          <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
          <strong style={{ display: 'block', fontSize: 15, color: 'var(--text)' }}>{fmt(est.saldo)}</strong>
        </div>
      ))}

      {P('historial', (
        <div style={{ display: 'flex', gap: 4, maxWidth: 170, overflow: 'hidden' }}>
          {est.hist.length === 0 && <span className="hint" style={{ margin: 0, fontSize: 10 }}>historial</span>}
          {est.hist.map((h, i) => (
            <span key={i} style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
              background: h.gano ? 'var(--accent-soft)' : 'var(--surface-alt)', color: h.gano ? 'var(--ok)' : 'var(--text-dim)',
            }}>{h.n}</span>
          ))}
        </div>
      ))}

      {P('mesa', (
        <div style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 12px rgba(0,0,0,.5)' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      ))}

      {cartelVisible && P('cartel', (
        <div style={{
          width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', display: 'grid', placeItems: 'center',
          border: '1px solid var(--accent)', backgroundColor: 'var(--surface-alt)',
          ...estiloImg(cfg.cartelUrl, cfg.arte.cartel),
          boxShadow: '0 22px 55px -14px rgba(0,0,0,.6)',
          animation: est.cartel != null ? 'sud-cartel .4s cubic-bezier(.2,1.35,.4,1)' : undefined,
        }}>
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 12, background: 'linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.6))' }}>
            <div>
              <b style={{ display: 'block', fontWeight: 800, color: '#fff', fontSize: 'clamp(16px,5vw,28px)', textShadow: '0 2px 12px rgba(0,0,0,.65)' }}>¡GANASTE!</b>
              <span style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 'clamp(12px,3.4vw,17px)', color: 'var(--ok)' }}>
                +{fmt(est.cartel ?? Math.round(est.apuesta * pagoDe(cfg, est.zona)))}
              </span>
            </div>
          </div>
        </div>
      ), 8)}
      <style>{'@keyframes sud-cartel{from{opacity:0;transform:translate(-50%,-50%) scale(.8)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}'}</style>

      {P('suma', (
        <div style={{
          fontFamily: 'var(--in-num, monospace)', fontWeight: 600, fontSize: 34, lineHeight: 1, whiteSpace: 'nowrap',
          color: sumColor, transition: 'color .2s', fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 10px rgba(0,0,0,.4)',
        }}>
          {rolling ? '…' : suma ?? '7'}
          {suma != null && !rolling && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 7 }}>
              {zg === 'abajo' ? 'ABAJO' : zg === 'siete' ? 'LUCKY 7' : 'ARRIBA'}
            </span>
          )}
        </div>
      ))}

      {P('campana', (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, width: '100%' }}>
          {barras.map((b) => (
            <div key={b.suma} style={{
              flex: 1, minWidth: 0, borderRadius: '3px 3px 0 0', height: `${Math.round(b.frac * 100)}%`,
              background: b.zona === 'siete' ? 'var(--accent)' : 'var(--surface-alt)',
              opacity: suma === b.suma && !rolling ? 1 : 0.5,
              outline: suma === b.suma && !rolling ? '1px solid var(--accent)' : 'none',
            }} />
          ))}
        </div>
      ))}

      {P('zonas', (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, width: '100%' }}>
          {ZONAS.map((z) => {
            const selZ = est.zona === z;
            const win = (fase === 'gano' || fase === 'perdio') && zg === z;
            const lost = fase === 'perdio' && selZ && !win;
            return (
              <button key={z} disabled={rolling || editando} onClick={() => !editando && fase === 'idle' && onZona(z)} style={zonaBtn(win, selZ, lost, fase)}>
                <div style={{ fontWeight: 700, fontSize: 11.5, color: z === 'siete' ? 'var(--accent)' : 'var(--text)' }}>{ZONA_INFO[z].nombre}</div>
                <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 9.5, color: 'var(--text-dim)', margin: '2px 0 5px' }}>{ZONA_INFO[z].rango}</div>
                <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 14, color: win ? 'var(--ok)' : lost ? 'var(--danger)' : 'var(--accent)' }}>{pagoDe(cfg, z).toFixed(2)}×</div>
              </button>
            );
          })}
        </div>
      ))}

      {P('apuesta', (
        <div style={{ pointerEvents: editando ? 'none' : 'auto' }}>
          {fichas.length > 0
            ? <FichasStrip fichas={fichas} apuesta={est.apuesta} bloqueado={rolling} onElegir={onApuesta} />
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button disabled={rolling} onClick={() => onApuesta(Math.max(minBet, est.apuesta - paso))} style={stepBtn}>−</button>
                <span style={{ minWidth: 96, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
                  <strong style={{ fontSize: 15, color: 'var(--text)' }}>{fmt(est.apuesta)}</strong>
                </span>
                <button disabled={rolling} onClick={() => onApuesta(Math.min(maxBet, est.apuesta + paso))} style={stepBtn}>+</button>
              </div>
            )}
        </div>
      ))}

      {P('boton', (
        <button
          onClick={() => { if (editando) return; if (fase === 'gano' || fase === 'perdio') onOtra(); else onJugar(); }}
          disabled={rolling || est.saldo < est.apuesta}
          style={{
            width: '100%', border: 0, borderRadius: 12, cursor: editando ? 'move' : 'pointer',
            fontFamily: 'var(--in-num, var(--in-body, inherit))', fontWeight: 800, letterSpacing: '.03em', fontSize: 16, color: '#fff',
            ...(cfg.botonImg
              ? { ...estiloImg(cfg.botonImg, cfg.arte.boton), aspectRatio: '5 / 1', textShadow: '0 1px 4px rgba(0,0,0,.6)' }
              : { padding: '13px 0', background: 'var(--accent)', color: 'var(--accent-text, #fff)', boxShadow: '0 10px 26px -8px rgba(0,0,0,.35)' }),
            opacity: (rolling || est.saldo < est.apuesta) ? 0.55 : 1,
          }}>
          {rolling ? '…' : fase === 'idle' ? 'Tirar' : 'Tirar de nuevo'}
        </button>
      ))}
    </div>
  );
}

function zonaBtn(win: boolean, sel: boolean, lost: boolean, fase: string): CSSProperties {
  return {
    padding: '9px 4px', borderRadius: 11, textAlign: 'center', cursor: fase === 'idle' ? 'pointer' : 'default',
    border: `1px solid ${win ? 'var(--ok)' : sel ? 'var(--accent)' : 'var(--border)'}`,
    background: win || sel ? 'var(--accent-soft)' : 'var(--surface-alt)',
    opacity: (fase === 'gano' || fase === 'perdio') && !win && !lost ? 0.4 : 1,
  };
}

const stepBtn: CSSProperties = {
  width: 38, height: 42, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-alt)',
  color: 'var(--text)', fontSize: 19, fontWeight: 700, cursor: 'pointer',
};
