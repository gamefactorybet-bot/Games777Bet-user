import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { TOTAL } from './juego/mines.ts';
import type { EstadoPartida } from './juego/mines.ts';
import type { BotonMines, Juego, PosControlesMines, RecuadroMines, SelectorMinasCfg } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

// Slider propio de "cuántas minas" (1–24), con arrastre por pointer y
// carril/perilla personalizables con imagen.
function SelectorMinas({ cfg, minas, onCambiar }: {
  cfg: SelectorMinasCfg;
  minas: number;
  onCambiar: (n: number) => void;
}) {
  const carrilRef = useRef<HTMLDivElement>(null);
  const MIN = 1, MAX = 24;
  const pct = (m: number) => ((m - MIN) / (MAX - MIN)) * 100;

  const desde = (clientX: number) => {
    const r = carrilRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onCambiar(Math.round(MIN + p * (MAX - MIN)));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    desde(e.clientX);
    const mover = (ev: PointerEvent) => desde(ev.clientX);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', mover), { once: true });
  };

  const grosor = cfg.grosor ?? 8;
  const tam = Math.max(grosor + 12, 24);

  return (
    <div style={{
      position: 'absolute', left: `${cfg.x}%`, top: `${cfg.y}%`,
      transform: 'translate(-50%,-50%)', width: cfg.ancho ?? 180,
      zIndex: 12, pointerEvents: 'auto', color: '#fff', userSelect: 'none', touchAction: 'none',
    }}>
      <div style={{ fontSize: 11, textAlign: 'center', marginBottom: 5, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
        Minas: <strong style={{ color: '#fff' }}>{minas}</strong>
      </div>
      <div
        ref={carrilRef}
        onPointerDown={onPointerDown}
        style={{
          position: 'relative', height: grosor, borderRadius: 999, cursor: 'pointer',
          background: cfg.carril_url ? `url('${cfg.carril_url}') center/100% 100% no-repeat` : 'var(--surface-alt)',
          boxShadow: cfg.carril_url ? 'none' : 'inset 0 1px 3px rgba(0,0,0,.5)',
        }}
      >
        {!cfg.carril_url && (
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct(minas)}%`,
            borderRadius: '999px 0 0 999px', background: 'linear-gradient(90deg, var(--accent), #8aa0ff)',
            opacity: 0.55, pointerEvents: 'none',
          }} />
        )}
        <div style={{
          position: 'absolute', top: '50%', left: `${pct(minas)}%`, transform: 'translate(-50%,-50%)',
          width: tam, height: tam, borderRadius: '50%', cursor: 'grab',
          background: cfg.thumb_url ? `url('${cfg.thumb_url}') center/contain no-repeat` : 'linear-gradient(160deg, #414a5e, #262b38)',
          border: cfg.thumb_url ? 'none' : '1px solid rgba(255,255,255,.16)',
          boxShadow: cfg.thumb_url ? 'none' : '0 2px 6px rgba(0,0,0,.5)',
        }} />
      </div>
    </div>
  );
}

interface ControlesMinesProps {
  juego: Juego;
  pos: PosControlesMines;
  estado: EstadoPartida;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  /** El juego usa fichas: se ocultan los −/+. */
  ocultarApuesta?: boolean;
  /** Además de los −/+, ocultar del todo el recuadro de apuesta. */
  ocultarCaja?: boolean;
  onIniciar: () => void;
  onRetirar: () => void;
  onNueva: () => void;
  onCambiarApuesta: (n: number) => void;
  onCambiarMinas: (n: number) => void;
}

function estiloRecuadro(r: RecuadroMines): CSSProperties {
  return {
    position: 'absolute', left: `${r.x}%`, top: `${r.y}%`,
    width: r.ancho, height: r.alto, transform: 'translate(-50%,-50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: r.fondo_url ? `url('${r.fondo_url}') center/100% 100% no-repeat` : 'rgba(0,0,0,.4)',
    borderRadius: r.fondo_url ? 0 : 10,
    color: '#fff', whiteSpace: 'nowrap', zIndex: 11, pointerEvents: 'none',
  };
}

// Capa de controles del tablero de Mines — cada elemento posicionado en
// % de la pantalla 420×860 (los valores salen de `juego.mines_controles`).
// Se monta por portal dentro del escenario, encima de la grilla.
export function ControlesMines({
  juego, pos, estado, minBet, maxBet, pasoApuesta, ocultarApuesta, ocultarCaja,
  onIniciar, onRetirar, onNueva, onCambiarApuesta, onCambiarMinas,
}: ControlesMinesProps) {
  const { fase, minas, apuesta, reveladas, multiplicador, puedeRetirar, saldo, ganancia, pendiente, cargando, error } = estado;
  const inactiva = fase === 'inactiva';
  const jugando = fase === 'en_curso';
  const perdida = fase === 'perdida';
  const retirada = fase === 'retirada';
  const gananciaPotencial = apuesta * multiplicador;
  const segurasRestantes = TOTAL - minas - reveladas.length;

  const textoBoton = inactiva ? `Empezar · ${fmt(apuesta)}`
    : retirada || perdida ? 'Jugar de nuevo'
    : pendiente != null ? '…'
    : puedeRetirar ? `Retirar ${fmt(gananciaPotencial)}`
    : `×${multiplicador.toFixed(2)}`;

  const botonDisabled = (inactiva && (cargando || saldo < apuesta))
    || (jugando && (!puedeRetirar || pendiente != null));

  const accion = () => {
    if (inactiva) onIniciar();
    else if (retirada || perdida) onNueva();
    else if (puedeRetirar) onRetirar();
  };

  const b: BotonMines = pos.boton;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none' }}>
      {/* Saldo — siempre visible */}
      <div style={estiloRecuadro(pos.saldo)}>
        <span className="hint" style={{ margin: 0, fontSize: 10 }}>Saldo</span>
        <strong style={{ fontSize: 16 }}>{fmt(saldo)}</strong>
      </div>

      {/* Multiplicador / resultado — durante y después de la partida */}
      {(jugando || perdida || retirada) && (
        <div style={estiloRecuadro(pos.mult)}>
          {jugando && (
            <>
              <strong style={{ fontSize: 18 }}>×{multiplicador.toFixed(2)}</strong>
              <span className="hint" style={{ margin: 0, fontSize: 10 }}>
                {puedeRetirar ? `retirás ${fmt(gananciaPotencial)}` : `${segurasRestantes} seguras`}
              </span>
            </>
          )}
          {retirada && (
            <>
              <strong style={{ fontSize: 18, color: 'var(--ok)' }}>+{fmt(ganancia ?? 0)}</strong>
              <span className="hint" style={{ margin: 0, fontSize: 10 }}>×{multiplicador.toFixed(2)}</span>
            </>
          )}
          {perdida && <strong style={{ fontSize: 16, color: 'var(--danger)' }}>Perdiste</strong>}
        </div>
      )}

      {/* Apuesta − / + — solo antes de empezar */}
      {inactiva && !ocultarApuesta && !ocultarCaja && (
        <div style={{
          position: 'absolute', left: `${pos.apuesta.x}%`, top: `${pos.apuesta.y}%`,
          transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 8,
          zIndex: 12, pointerEvents: 'auto', color: '#fff', whiteSpace: 'nowrap',
        }}>
          <button onClick={() => onCambiarApuesta(Math.max(minBet, apuesta - pasoApuesta))}>−</button>
          <span style={{ minWidth: 78, textAlign: 'center' }}>
            <span className="hint" style={{ display: 'block', fontSize: 10, margin: 0 }}>Apuesta</span>
            <strong>{fmt(apuesta)}</strong>
          </span>
          <button onClick={() => onCambiarApuesta(Math.min(maxBet, apuesta + pasoApuesta))}>+</button>
        </div>
      )}
      {inactiva && ocultarApuesta && !ocultarCaja && (
        <div style={{
          position: 'absolute', left: `${pos.apuesta.x}%`, top: `${pos.apuesta.y}%`,
          transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 12,
          color: '#fff', whiteSpace: 'nowrap',
        }}>
          <span className="hint" style={{ display: 'block', fontSize: 10, margin: 0 }}>Apuesta</span>
          <strong>{fmt(apuesta)}</strong>
        </div>
      )}

      {/* Selector de minas — solo antes de empezar */}
      {inactiva && <SelectorMinas cfg={pos.minas} minas={minas} onCambiar={onCambiarMinas} />}

      {/* Botón de acción */}
      <button
        onClick={accion}
        disabled={botonDisabled}
        className={b.imagen_url ? 'jg-play' : 'primary jg-play'}
        style={{
          position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
          transform: 'translate(-50%,-50%)',
          width: b.ancho, height: b.alto,
          fontSize: 14, fontWeight: 600, borderRadius: 12,
          zIndex: 13, pointerEvents: 'auto',
          ...(b.imagen_url ? {
            background: `url('${b.imagen_url}') center/100% 100% no-repeat`,
            border: 'none', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)',
          } : {}),
        }}
      >
        {textoBoton}
      </button>

      {error && (
        <div style={{
          position: 'absolute', left: '50%', top: `${Math.min(97, b.y + 7)}%`,
          transform: 'translateX(-50%)', maxWidth: '80%', textAlign: 'center',
          fontSize: 12, color: 'var(--danger)', zIndex: 13,
        }}>{error}</div>
      )}
    </div>
  );
}
