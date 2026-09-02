import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoTorre, PosControlesTorre, TorreCfg } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
const mx = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + '×';

const centrado = (p: { x: number; y: number }): CSSProperties => ({
  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
});

interface TorreMesaProps {
  escenario: Escenario;
  cfg: TorreCfg;
  pos: PosControlesTorre;
  estado: EstadoTorre;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  contadorMs: number;
  /** El juego usa fichas: se ocultan los −/+. */
  ocultarApuesta?: boolean;
  ocultarCaja?: boolean;
  onCambiarApuesta: (n: number) => void;
  onRetirar: () => void;
  onNueva: () => void;
  /** Monto de demo para ubicar el cartel de la ganancia desde ⚙ Ajustar. */
  premioDemo?: number | null;
}

// La "mesa" de la Torre: multiplicador grande, saldo, historial,
// apuesta, el cartel de la ganancia y el botón Retirar. Cada uno en
// su capa (portal en el escenario) y posicionable desde ⚙ Ajustar.
export function TorreMesa({
  escenario, cfg, pos, estado, minBet, maxBet, pasoApuesta, contadorMs,
  ocultarApuesta, ocultarCaja, onCambiarApuesta, onRetirar, onNueva, premioDemo,
}: TorreMesaProps) {
  const { fase, piso, mult, res } = estado;
  const jugando = fase === 'jugando';
  const idle = fase === 'idle';
  const terminada = fase === 'perdida' || fase === 'retirada';
  const puedeRetirar = jugando && piso > 1;

  // contador de la ganancia
  const [contador, setContador] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!res || res.mult <= 0) { setContador(0); return; }
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : contadorMs;
    if (dur <= 0) { setContador(res.amount); return; }
    const t0 = performance.now();
    const paso = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      setContador(res.amount * (1 - Math.pow(1 - t, 3)));
      if (t < 1) rafRef.current = requestAnimationFrame(paso);
      else setContador(res.amount);
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafRef.current);
  }, [res, contadorMs]);

  const multColor = fase === 'perdida' ? 'var(--danger)' : fase === 'retirada' ? 'var(--to-safe, var(--ok))' : 'var(--to-gold, var(--accent))';
  const multTexto = fase === 'perdida' ? '0.00×' : fase === 'retirada' ? mx(res?.mult ?? mult) : mx(mult);
  const nota = fase === 'perdida' ? `Pisaste la trampa en el piso ${piso}`
    : fase === 'retirada' ? (res?.top ? '¡Llegaste arriba!' : `Retiraste en el piso ${piso - 1}`)
    : jugando ? `Piso ${piso} de ${cfg.pisos}`
    : 'Elegí una casilla del piso 1 para empezar';

  const btnTexto = terminada ? 'Jugar de nuevo'
    : puedeRetirar ? `Retirar ${fmt(estado.apuesta * mult)}`
    : 'Retirar';
  const btnDisabled = idle || (jugando && !puedeRetirar) || fase === 'cargando';

  const capa = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none', fontFamily: 'var(--to-body, inherit)' }}>

      {/* Historial */}
      <div style={{
        ...centrado(pos.historial), display: 'flex', gap: 5, maxWidth: '84%', overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
      }}>
        {estado.historial.slice(0, 10).map((v, i) => (
          <span key={i} style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
            background: v > 0 ? 'var(--accent-soft)' : 'var(--surface-alt)',
            color: v >= 10 ? '#ff8a3d' : v > 0 ? 'var(--to-safe, var(--ok))' : 'var(--text-dim)',
          }}>{v > 0 ? mx(v) : '–'}</span>
        ))}
      </div>

      {/* Saldo */}
      <div style={{ ...centrado(pos.saldo), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
        <strong style={{ display: 'block', fontSize: 14 }}>{fmt(estado.saldo)}</strong>
      </div>

      {/* Multiplicador grande */}
      <div style={{ ...centrado(pos.multiplicador), textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={{
          fontFamily: 'var(--to-font-display, var(--to-body, monospace))', fontWeight: 600,
          fontSize: 34, lineHeight: 1, color: multColor, fontVariantNumeric: 'tabular-nums',
        }}>{multTexto}</div>
        <div className="hint" style={{ margin: '3px 0 0', fontSize: 11 }}>{nota}</div>
      </div>

      {/* Apuesta — solo antes de empezar */}
      {idle && !ocultarCaja && (
        ocultarApuesta ? (
          <div style={{ ...centrado(pos.apuesta), textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
            <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
          </div>
        ) : (
          <div style={{ ...centrado(pos.apuesta), display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
            <button onClick={() => onCambiarApuesta(Math.max(minBet, estado.apuesta - pasoApuesta))} style={stepBtn}>−</button>
            <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
              <strong style={{ fontSize: 15 }}>{fmt(estado.apuesta)}</strong>
            </span>
            <button onClick={() => onCambiarApuesta(Math.min(maxBet, estado.apuesta + pasoApuesta))} style={stepBtn}>+</button>
          </div>
        )
      )}

      {/* Cartel de la ganancia */}
      {((res && res.mult > 0) || (premioDemo != null && premioDemo > 0)) && (
        <div style={{
          ...centrado(pos.premio), textAlign: 'center', zIndex: 16,
          background: 'rgba(0,0,0,.5)', padding: '10px 22px', borderRadius: 16,
          border: '1px solid color-mix(in srgb, var(--to-safe, #37d08b) 55%, transparent)',
          animation: 'to-premio-pop .38s cubic-bezier(.2,1.3,.4,1)',
        }}>
          <style>{`@keyframes to-premio-pop{0%{transform:translate(-50%,-50%) scale(.7);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
          <strong style={{
            display: 'block', fontFamily: 'var(--to-font-display, var(--to-body, inherit))', fontWeight: 800,
            fontSize: 32, lineHeight: 1, color: 'var(--to-safe, #37d08b)', fontVariantNumeric: 'tabular-nums',
          }}>+{fmt(res ? contador : (premioDemo as number))}</strong>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--to-safe, #37d08b)', opacity: 0.85 }}>
            {res ? `×${mx(res.mult).replace('×', '')}` : '×12'}
          </span>
        </div>
      )}

      {/* Botón */}
      <button
        onClick={terminada ? onNueva : onRetirar}
        disabled={btnDisabled}
        style={{
          position: 'absolute', left: `${pos.boton.x}%`, top: `${pos.boton.y}%`, transform: 'translate(-50%,-50%)',
          width: pos.boton.ancho, height: pos.boton.alto, pointerEvents: 'auto',
          border: 0, borderRadius: 'var(--to-radius, 14px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--to-font-display, var(--to-body, inherit))', fontWeight: 800, letterSpacing: 1, fontSize: 16,
          background: pos.boton.imagen_url
            ? `center/100% 100% no-repeat url("${pos.boton.imagen_url}")`
            : terminada ? 'var(--surface-alt)' : 'var(--to-safe, var(--ok, #37d08b))',
          color: pos.boton.imagen_url ? '#fff' : terminada ? 'var(--text)' : '#08160f',
          boxShadow: pos.boton.imagen_url || terminada ? 'none' : '0 10px 26px -8px rgba(0,0,0,.35)',
          textShadow: pos.boton.imagen_url ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
          opacity: btnDisabled ? 0.5 : 1,
        }}>
        {fase === 'cargando' ? '…' : btnTexto}
      </button>

      {estado.error && (
        <p style={{
          position: 'absolute', left: '50%', top: `${Math.min(98, pos.boton.y + 6)}%`, transform: 'translateX(-50%)',
          margin: 0, maxWidth: '86%', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--danger)', zIndex: 13,
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
