import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoKeno, KenoCfg, PosControlesKeno } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
const mx = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + '×';

const centrado = (p: { x: number; y: number }): CSSProperties => ({
  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
});

interface KenoMesaProps {
  escenario: Escenario;
  cfg: KenoCfg;
  pos: PosControlesKeno;
  estado: EstadoKeno;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  /** Tabla de multiplicadores para la cantidad marcada ahora. */
  tabla: number[];
  /** El juego usa fichas: se ocultan los −/+. */
  ocultarApuesta?: boolean;
  /** Además, ocultar del todo el recuadro de apuesta. */
  ocultarCaja?: boolean;
  onCambiarApuesta: (n: number) => void;
  onAuto: () => void;
  onLimpiar: () => void;
  onJugar: () => void;
}

// La "mesa" del Keno: saldo, historial, bolillero, apuesta, acciones y
// el botón, cada uno en una capa aparte (portal en el escenario) y
// posicionable desde ⚙ Ajustar.
export function KenoMesa({
  escenario, cfg, pos, estado, minBet, maxBet, pasoApuesta, tabla, ocultarApuesta, ocultarCaja,
  onCambiarApuesta, onAuto, onLimpiar, onJugar,
}: KenoMesaProps) {
  const { fase, picked, drawn, res } = estado;
  const jugando = fase === 'rolling';
  const btnDisabled = jugando || (!res && (!picked.length || estado.saldo < estado.apuesta));

  const nota = jugando ? 'Saliendo las bolas…'
    : res ? `${res.aciertos} de ${picked.length} aciertos` + (res.mult > 0 ? ` · paga ×${res.mult}` : ' · sin premio')
    : picked.length ? `${picked.length} marcados` + (picked.length >= cfg.maxMarcar ? ' · máximo' : '')
    : `Marcá entre 1 y ${cfg.maxMarcar} números`;

  const capa = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none', fontFamily: 'var(--kn-body, inherit)' }}>

      {/* Historial */}
      <div style={{
        ...centrado(pos.historial), display: 'flex', gap: 5, maxWidth: '86%', overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
      }}>
        {estado.historial.slice(0, 10).map((v, i) => (
          <span key={i} style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
            fontVariantNumeric: 'tabular-nums',
            background: v > 0 ? 'var(--accent-soft)' : 'var(--surface-alt)',
            color: v >= 10 ? '#ff8a3d' : v > 0 ? 'var(--ok)' : 'var(--text-dim)',
          }}>{v > 0 ? mx(v) : '–'}</span>
        ))}
      </div>

      {/* Saldo */}
      <div style={{ ...centrado(pos.saldo), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
        <strong style={{ display: 'block', fontSize: 14 }}>{fmt(estado.saldo)}</strong>
      </div>

      {/* Bolillero */}
      <div style={{
        ...centrado(pos.bolillero), width: `${pos.bolillero.ancho}%`,
        display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', minHeight: 34,
        padding: '7px 9px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 11,
      }}>
        <style>{`@keyframes kn-bola-pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        {drawn.length
          ? drawn.map((n, i) => (
            <span key={i} style={{
              width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
              fontFamily: 'var(--kn-font-display, var(--kn-body, monospace))', fontSize: 12, fontWeight: 700, color: '#1a1206',
              background: 'radial-gradient(circle at 34% 30%, #f4d488, var(--kn-bola, #e6b354))',
              boxShadow: '0 2px 7px -1px rgba(0,0,0,.5)', animation: 'kn-bola-pop .28s cubic-bezier(.2,1.3,.4,1)',
            }}>{n}</span>
          ))
          : <span className="hint" style={{ margin: 0, alignSelf: 'center', fontSize: 11 }}>las bolas salen acá</span>}
      </div>

      {/* Tabla de pagos de la selección actual */}
      {picked.length > 0 && !res && (
        <div style={{
          position: 'absolute', left: `${pos.apuesta.x}%`, top: `calc(${pos.apuesta.y}% - 40px)`, transform: 'translate(-50%,-50%)',
          display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%',
        }}>
          {tabla.map((m, h) => (m > 0
            ? <span key={h} style={{
                fontFamily: 'var(--kn-font-display, monospace)', fontSize: 10.5, padding: '2px 6px', borderRadius: 6,
                background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--text-dim)',
              }}>{h}→{mx(m)}</span>
            : null))}
        </div>
      )}

      {/* Apuesta */}
      {ocultarCaja ? null : ocultarApuesta ? (
        <div style={{ ...centrado(pos.apuesta), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
          <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
        </div>
      ) : (
        <div style={{ ...centrado(pos.apuesta), display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          <button disabled={jugando} onClick={() => onCambiarApuesta(Math.max(minBet, estado.apuesta - pasoApuesta))} style={stepBtn}>−</button>
          <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
            <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
          </span>
          <button disabled={jugando} onClick={() => onCambiarApuesta(Math.min(maxBet, estado.apuesta + pasoApuesta))} style={stepBtn}>+</button>
        </div>
      )}

      {/* Acciones */}
      <div style={{ ...centrado(pos.acciones), display: 'flex', gap: 8, pointerEvents: 'auto' }}>
        <button disabled={fase !== 'idle'} onClick={onAuto} style={secBtn}>Automático</button>
        <button disabled={jugando} onClick={onLimpiar} style={secBtn}>Limpiar</button>
      </div>

      {/* Botón principal */}
      <button
        onClick={res ? onLimpiar : onJugar}
        disabled={btnDisabled}
        style={{
          position: 'absolute', left: `${pos.boton.x}%`, top: `${pos.boton.y}%`, transform: 'translate(-50%,-50%)',
          width: pos.boton.ancho, height: pos.boton.alto, pointerEvents: 'auto',
          border: 0, borderRadius: 'var(--kn-radius, 14px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--kn-font-display, var(--kn-body, inherit))', fontWeight: 800, letterSpacing: 1, fontSize: 17,
          background: pos.boton.imagen_url
            ? `center/100% 100% no-repeat url("${pos.boton.imagen_url}")`
            : 'var(--kn-btn-bg, var(--accent))',
          color: pos.boton.imagen_url ? '#fff' : 'var(--kn-btn-ink, var(--accent-text, #fff))',
          boxShadow: pos.boton.imagen_url ? 'none' : '0 10px 26px -8px rgba(0,0,0,.35)',
          textShadow: pos.boton.imagen_url ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
          opacity: btnDisabled ? 0.55 : 1,
        }}>
        {jugando ? '…' : res ? 'Otra ronda' : 'Jugar'}
      </button>

      {/* Nota / error */}
      <p style={{
        position: 'absolute', left: '50%', top: `${Math.min(98, pos.boton.y + 6)}%`, transform: 'translateX(-50%)',
        margin: 0, maxWidth: '86%', textAlign: 'center', fontSize: 12, fontWeight: 600,
        color: estado.error ? 'var(--danger)' : 'var(--text-dim)', zIndex: 13,
      }}>{estado.error || nota}</p>
    </div>
  );

  return createPortal(capa, escenario.el);
}

const stepBtn: CSSProperties = {
  width: 40, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-alt)',
  color: 'var(--text)', fontSize: 20, fontWeight: 700, cursor: 'pointer',
};
const secBtn: CSSProperties = {
  fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text-dim)', minWidth: 104,
  background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', cursor: 'pointer',
};
