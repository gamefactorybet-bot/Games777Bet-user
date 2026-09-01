import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Escenario } from './juego/escenario.ts';
import type { CrashCfg, EstadoCrash, PosControlesCrash } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
const m2 = (n: number) => (Math.floor(n * 100) / 100).toFixed(2) + '×';

const centrado = (p: { x: number; y: number }): CSSProperties => ({
  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
});

interface CrashMesaProps {
  escenario: Escenario;
  cfg: CrashCfg;
  pos: PosControlesCrash;
  estado: EstadoCrash;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  /** El juego usa fichas: se ocultan los −/+. */
  ocultarApuesta?: boolean;
  onApostar: () => void;
  onRetirar: () => void;
  onNueva: () => void;
  onCambiarApuesta: (n: number) => void;
  onCambiarAuto: (activo: boolean, objetivo: number) => void;
}

// La "mesa" del Crash: controles sobre una capa aparte (portal en el
// escenario). El número grande y la curva los pone <Crash>.
export function CrashMesa({
  escenario, cfg, pos, estado, minBet, maxBet, pasoApuesta, ocultarApuesta,
  onApostar, onRetirar, onNueva, onCambiarApuesta, onCambiarAuto,
}: CrashMesaProps) {
  const { fase } = estado;
  const enCurso = fase === 'en_curso';
  const terminada = fase === 'retirada' || fase === 'reventada';
  const btnDisabled = fase === 'inactiva' && (estado.cargando || estado.saldo < estado.apuesta);
  const A = cfg.auto;
  const clampAuto = (v: number) => Math.max(A.min, Math.min(A.max, Math.round(v * 100) / 100));

  const accion = () => {
    if (enCurso) onRetirar();
    else if (terminada) onNueva();
    else onApostar();
  };

  const capa = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none', fontFamily: 'var(--cr-body, inherit)' }}>

      {/* Historial */}
      {cfg.historial.mostrar && (
        <div style={{
          ...centrado(pos.historial), display: 'flex', gap: 5, maxWidth: '92%', overflow: 'hidden',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent)',
          maskImage: 'linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent)',
        }}>
          {estado.historial.slice(0, cfg.historial.cantidad).map((v, i) => (
            <span key={i} style={{
              flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              fontVariantNumeric: 'tabular-nums',
              background: v >= 10 ? 'rgba(53,208,139,.16)' : v >= 2 ? 'var(--accent-soft)' : 'var(--surface-alt)',
              color: v >= 10 ? 'var(--ok)' : v >= 2 ? 'var(--accent)' : 'var(--text-dim)',
            }}>{m2(v)}</span>
          ))}
        </div>
      )}

      {/* Saldo */}
      <div style={{ ...centrado(pos.saldo), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
        <strong style={{ display: 'block', fontSize: 14 }}>{fmt(estado.saldo)}</strong>
      </div>

      {/* Auto-retiro */}
      {A.permitir && (
        <div style={{
          ...centrado(pos.auto), display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', whiteSpace: 'nowrap',
          pointerEvents: 'auto', opacity: estado.autoActivo ? 1 : 0.6,
        }}>
          <button
            onClick={() => onCambiarAuto(!estado.autoActivo, estado.autoObjetivo)}
            aria-pressed={estado.autoActivo}
            style={{
              position: 'relative', width: 38, height: 22, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
              background: estado.autoActivo ? 'var(--accent)' : 'var(--border)',
            }}>
            <span style={{
              position: 'absolute', top: 2, left: estado.autoActivo ? 18 : 2, width: 18, height: 18,
              borderRadius: '50%', background: '#fff', transition: 'left .15s',
            }} />
          </button>
          <span>Auto-retiro</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--surface-alt)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '1px 3px 1px 7px', color: 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <button disabled={enCurso} onClick={() => onCambiarAuto(estado.autoActivo, clampAuto(estado.autoObjetivo - 0.25))}
              style={miniBtn}>−</button>
            {m2(estado.autoObjetivo)}
            <button disabled={enCurso} onClick={() => onCambiarAuto(estado.autoActivo, clampAuto(estado.autoObjetivo + 0.25))}
              style={miniBtn}>+</button>
          </span>
        </div>
      )}

      {/* Apuesta */}
      {ocultarApuesta ? (
        <div style={{ ...centrado(pos.apuesta), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
          <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
        </div>
      ) : (
        <div style={{ ...centrado(pos.apuesta), display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          <button disabled={enCurso} onClick={() => onCambiarApuesta(Math.max(minBet, estado.apuesta - pasoApuesta))}
            style={stepBtn}>−</button>
          <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
            <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
          </span>
          <button disabled={enCurso} onClick={() => onCambiarApuesta(Math.min(maxBet, estado.apuesta + pasoApuesta))}
            style={stepBtn}>+</button>
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={accion}
        disabled={btnDisabled}
        style={{
          position: 'absolute', left: `${pos.boton.x}%`, top: `${pos.boton.y}%`, transform: 'translate(-50%,-50%)',
          width: pos.boton.ancho, height: pos.boton.alto, pointerEvents: 'auto',
          border: 0, borderRadius: 'var(--cr-radius, 14px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--cr-font-display, var(--cr-body, inherit))', fontWeight: 800, letterSpacing: 1,
          fontSize: 18,
          background: pos.boton.imagen_url
            ? `center/100% 100% no-repeat url("${pos.boton.imagen_url}")`
            : enCurso ? 'var(--ok)'
              : terminada ? 'var(--surface-alt)'
                : 'var(--cr-btn-bg, var(--accent))',
          color: pos.boton.imagen_url ? '#fff'
            : enCurso ? '#04150d'
              : terminada ? 'var(--text)'
                : 'var(--cr-btn-ink, var(--accent-text, #fff))',
          boxShadow: pos.boton.imagen_url || terminada ? 'none' : '0 10px 26px -8px var(--cr-glow, rgba(0,0,0,.3))',
          textShadow: pos.boton.imagen_url ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
        }}>
        {enCurso
          ? <>RETIRAR <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }} id="crash-monto-vivo">{fmt(estado.apuesta)}</span></>
          : terminada ? 'Apostar de nuevo' : 'Apostar'}
      </button>

      {/* Error */}
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
const miniBtn: CSSProperties = {
  width: 20, height: 20, borderRadius: 5, border: 0, background: 'transparent',
  color: 'var(--text-dim)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
