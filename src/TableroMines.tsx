import { casillaCara, LADO, TOTAL } from './juego/mines.ts';
import type { EstadoPartida } from './juego/mines.ts';
import type { Juego } from './types.ts';

interface TableroMinesProps {
  juego: Juego;
  estado: EstadoPartida;
  minBet: number;
  maxBet: number;
  pasoApuesta: number;
  onIniciar: () => void;
  onRevelar: (casilla: number) => void;
  onRetirar: () => void;
  onCambiarApuesta: (n: number) => void;
  onCambiarMinas: (n: number) => void;
  onNueva: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

export function TableroMines({
  juego, estado, minBet, maxBet, pasoApuesta,
  onIniciar, onRevelar, onRetirar, onCambiarApuesta, onCambiarMinas, onNueva,
}: TableroMinesProps) {
  const { fase, minas, apuesta, reveladas, minasPos, multiplicador, puedeRetirar, saldo, ganancia, cargando, error } = estado;
  const jugando = fase === 'en_curso';
  const terminada = fase === 'retirada' || fase === 'perdida';
  const segurasRestantes = TOTAL - minas - reveladas.length;
  const gananciaPotencial = apuesta * multiplicador;

  const cara = (i: number) => {
    if (minasPos?.includes(i)) return casillaCara(juego, 'mina');
    if (reveladas.includes(i)) return casillaCara(juego, 'segura');
    return casillaCara(juego, 'oculta');
  };

  return (
    <div style={{ width: 340, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Estado de arriba */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Caja etiqueta="Saldo" valor={fmt(saldo)} />
        {jugando
          ? <Caja etiqueta={`Multiplicador · ${segurasRestantes} seguras`} valor={`×${multiplicador.toFixed(2)}`} />
          : <Caja etiqueta="Minas" valor={String(minas)} />}
      </div>

      {/* Grilla 5×5 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${LADO}, 1fr)`, gap: 6 }}>
        {Array.from({ length: TOTAL }, (_, i) => {
          const c = cara(i);
          const destapable = jugando && !cargando && !reveladas.includes(i);
          return (
            <button
              key={i}
              disabled={!destapable}
              onClick={() => destapable && onRevelar(i)}
              style={{
                aspectRatio: '1', padding: 0, borderRadius: 8, fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: destapable ? 'pointer' : 'default',
                transition: 'transform .12s, opacity .12s',
                opacity: terminada && !minasPos?.includes(i) && !reveladas.includes(i) ? 0.45 : 1,
                ...c.style,
              }}
            >
              {c.emoji}
            </button>
          );
        })}
      </div>

      {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}

      {/* Controles según la fase */}
      {fase === 'inactiva' && (
        <>
          <label style={{ fontSize: 12 }}>
            Minas: <strong>{minas}</strong>
            <input
              type="range" min={1} max={24} value={minas}
              onChange={(e) => onCambiarMinas(Number(e.target.value))}
              style={{ marginTop: 4 }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="hint" style={{ flex: 1 }}>Apuesta</span>
            <button onClick={() => onCambiarApuesta(Math.max(minBet, apuesta - pasoApuesta))}>−</button>
            <strong style={{ minWidth: 80, textAlign: 'center' }}>{fmt(apuesta)}</strong>
            <button onClick={() => onCambiarApuesta(Math.min(maxBet, apuesta + pasoApuesta))}>+</button>
          </div>
          <button className="primary" disabled={cargando || saldo < apuesta} onClick={onIniciar}>
            {cargando ? 'Empezando…' : `Empezar (${fmt(apuesta)})`}
          </button>
          {saldo < apuesta && <p className="hint error" style={{ margin: 0 }}>Sin saldo para esa apuesta.</p>}
        </>
      )}

      {jugando && (
        <button
          className="primary"
          disabled={!puedeRetirar || cargando}
          onClick={onRetirar}
          style={{ opacity: puedeRetirar ? 1 : 0.5 }}
        >
          {puedeRetirar ? `Retirar ${fmt(gananciaPotencial)} (×${multiplicador.toFixed(2)})` : `Retiro cada 5 aciertos · ×${multiplicador.toFixed(2)}`}
        </button>
      )}

      {terminada && (
        <>
          <p style={{
            margin: 0, textAlign: 'center', fontWeight: 600,
            color: fase === 'retirada' ? 'var(--ok)' : 'var(--danger)',
          }}>
            {fase === 'retirada'
              ? `Retiraste ${fmt(ganancia ?? 0)} (×${multiplicador.toFixed(2)})`
              : 'Pisaste una mina. Perdiste la apuesta.'}
          </p>
          <button className="primary" onClick={onNueva}>Jugar de nuevo</button>
        </>
      )}
    </div>
  );
}

function Caja({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 10px' }}>
      <p className="hint" style={{ margin: 0, fontSize: 10 }}>{etiqueta}</p>
      <strong style={{ fontSize: 15 }}>{valor}</strong>
    </div>
  );
}
