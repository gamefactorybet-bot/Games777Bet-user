import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoRaspa, RaspaCfg, PosControlesRaspa } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
const mx = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + '×';

const centrado = (p: { x: number; y: number }): CSSProperties => ({
  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
});

interface RaspaditaMesaProps {
  escenario: Escenario;
  cfg: RaspaCfg;
  pos: PosControlesRaspa;
  estado: EstadoRaspa;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  /** Hay una tarjeta sin terminar de raspar. */
  raspando: boolean;
  /** El juego usa fichas: se ocultan los −/+. */
  ocultarApuesta?: boolean;
  /** Además de los −/+, ocultar del todo el recuadro de apuesta. */
  ocultarCaja?: boolean;
  onComprar: () => void;
  onCambiarApuesta: (n: number) => void;
}

export function RaspaditaMesa({
  escenario, cfg, pos, estado, minBet, maxBet, pasoApuesta, raspando, ocultarApuesta, ocultarCaja, onComprar, onCambiarApuesta,
}: RaspaditaMesaProps) {
  const ocupado = raspando || estado.cargando;
  const btnDisabled = ocupado || estado.saldo < estado.apuesta;

  const capa = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none', fontFamily: 'var(--rs-body, inherit)' }}>

      {cfg.historial.mostrar && (
        <div style={{
          ...centrado(pos.historial), display: 'flex', gap: 5, maxWidth: '86%', overflow: 'hidden',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
          maskImage: 'linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
        }}>
          {estado.historial.slice(0, cfg.historial.cantidad).map((v, i) => (
            <span key={i} style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              fontVariantNumeric: 'tabular-nums',
              background: v > 0 ? 'var(--accent-soft)' : 'var(--surface-alt)',
              color: v >= 10 ? '#ff8a3d' : v > 0 ? 'var(--accent)' : 'var(--text-dim)',
            }}>{v > 0 ? mx(v) : '–'}</span>
          ))}
        </div>
      )}

      <div style={{ ...centrado(pos.saldo), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
        <strong style={{ display: 'block', fontSize: 14 }}>{fmt(estado.saldo)}</strong>
      </div>

      {ocultarCaja ? null : ocultarApuesta ? (
        <div style={{ ...centrado(pos.apuesta), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
          <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
        </div>
      ) : (
        <div style={{ ...centrado(pos.apuesta), display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          <button disabled={ocupado} onClick={() => onCambiarApuesta(Math.max(minBet, estado.apuesta - pasoApuesta))}
            style={stepBtn}>−</button>
          <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
            <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
          </span>
          <button disabled={ocupado} onClick={() => onCambiarApuesta(Math.min(maxBet, estado.apuesta + pasoApuesta))}
            style={stepBtn}>+</button>
        </div>
      )}

      <button
        className="jg-play"
        onClick={onComprar}
        disabled={btnDisabled}
        style={{
          position: 'absolute', left: `${pos.boton.x}%`, top: `${pos.boton.y}%`, transform: 'translate(-50%,-50%)',
          width: pos.boton.ancho, height: pos.boton.alto, pointerEvents: 'auto',
          border: 0, borderRadius: 'var(--rs-radius, 14px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--rs-font-display, var(--rs-body, inherit))', fontWeight: 800, letterSpacing: 1, fontSize: 17,
          background: pos.boton.imagen_url
            ? `center/100% 100% no-repeat url("${pos.boton.imagen_url}")`
            : 'var(--rs-btn-bg, var(--accent))',
          color: pos.boton.imagen_url ? '#fff' : 'var(--rs-btn-ink, var(--accent-text, #fff))',
          boxShadow: pos.boton.imagen_url ? 'none' : '0 10px 26px -8px rgba(0,0,0,.35)',
          textShadow: pos.boton.imagen_url ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
          opacity: btnDisabled ? 0.55 : 1,
        }}>
        {estado.cargando ? '…' : raspando ? 'Raspá la tarjeta' : 'Comprar tarjeta'}
      </button>

      {estado.error && (
        <p style={{
          position: 'absolute', left: '50%', top: `${Math.min(97, pos.boton.y + 7)}%`, transform: 'translateX(-50%)',
          margin: 0, maxWidth: '84%', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--danger)', zIndex: 13,
        }}>{estado.error}</p>
      )}
    </div>
  );

  return createPortal(capa, escenario.el);
}

const stepBtn: CSSProperties = {
  width: 40, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-alt)',
  color: 'var(--text)', fontSize: 20, fontWeight: 700, cursor: 'pointer',
};
