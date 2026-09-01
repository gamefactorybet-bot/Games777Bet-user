import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoPlinko, PlinkoCfg, PosControlesPlinko } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
const mx = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + '×';

const centrado = (p: { x: number; y: number }): CSSProperties => ({
  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
});

const RIESGO_ET: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };

interface PlinkoMesaProps {
  escenario: Escenario;
  cfg: PlinkoCfg;
  pos: PosControlesPlinko;
  estado: EstadoPlinko;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  cayendo: boolean;
  /** El juego usa fichas: se ocultan los −/+. */
  ocultarApuesta?: boolean;
  onSoltar: () => void;
  onCambiarApuesta: (n: number) => void;
  onCambiarFilas: (n: number) => void;
  onCambiarRiesgo: (r: string) => void;
}

export function PlinkoMesa({
  escenario, cfg, pos, estado, minBet, maxBet, pasoApuesta, cayendo, ocultarApuesta,
  onSoltar, onCambiarApuesta, onCambiarFilas, onCambiarRiesgo,
}: PlinkoMesaProps) {
  const ocupado = cayendo || estado.cargando;
  const btnDisabled = ocupado || estado.saldo < estado.apuesta;

  const seg = (opts: (string | number)[], val: string | number, onPick: (v: never) => void, etq?: (v: string | number) => string) => (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', pointerEvents: 'auto' }}>
      {opts.map((o, i) => (
        <button key={o} disabled={ocupado} onClick={() => onPick(o as never)} style={{
          border: 0, borderLeft: i ? '1px solid var(--border)' : 0, padding: '5px 11px', cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5, lineHeight: 1,
          background: o === val ? 'var(--accent)' : 'transparent',
          color: o === val ? 'var(--accent-text, #fff)' : 'var(--text-dim)',
        }}>{etq ? etq(o) : o}</button>
      ))}
    </div>
  );

  const capa = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none', fontFamily: 'var(--pk-body, inherit)' }}>

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
              background: v >= 2 ? 'var(--accent-soft)' : 'var(--surface-alt)',
              color: v >= 10 ? '#ff8a3d' : v >= 2 ? 'var(--accent)' : v >= 1 ? 'var(--ok)' : 'var(--text-dim)',
            }}>{mx(v)}</span>
          ))}
        </div>
      )}

      <div style={{ ...centrado(pos.saldo), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
        <strong style={{ display: 'block', fontSize: 14 }}>{fmt(estado.saldo)}</strong>
      </div>

      {(cfg.filasPermitidas.length > 1 || cfg.riesgoPermitido.length > 1) && (
        <div style={{ ...centrado(pos.opciones), display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {cfg.filasPermitidas.length > 1 && seg(cfg.filasPermitidas, estado.filas, (v: number) => onCambiarFilas(v))}
          {cfg.riesgoPermitido.length > 1 && seg(cfg.riesgoPermitido, estado.riesgo, (v: string) => onCambiarRiesgo(v), (v) => RIESGO_ET[v as string] || String(v))}
        </div>
      )}

      {ocultarApuesta ? (
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
        onClick={onSoltar}
        disabled={btnDisabled}
        style={{
          position: 'absolute', left: `${pos.boton.x}%`, top: `${pos.boton.y}%`, transform: 'translate(-50%,-50%)',
          width: pos.boton.ancho, height: pos.boton.alto, pointerEvents: 'auto',
          border: 0, borderRadius: 'var(--pk-radius, 14px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--pk-font-display, var(--pk-body, inherit))', fontWeight: 800, letterSpacing: 1, fontSize: 18,
          background: pos.boton.imagen_url
            ? `center/100% 100% no-repeat url("${pos.boton.imagen_url}")`
            : 'var(--pk-btn-bg, var(--accent))',
          color: pos.boton.imagen_url ? '#fff' : 'var(--pk-btn-ink, var(--accent-text, #fff))',
          boxShadow: pos.boton.imagen_url ? 'none' : '0 10px 26px -8px rgba(0,0,0,.35)',
          textShadow: pos.boton.imagen_url ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
          opacity: btnDisabled ? 0.55 : 1,
        }}>
        {ocupado ? '…' : 'Soltar bolita'}
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
