import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { casillaCara, LADO, TOTAL } from './juego/mines.ts';
import type { Cara, EstadoPartida } from './juego/mines.ts';
import { montarLottieEn } from './lottie.ts';
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

const BOTON_CELDA: CSSProperties = {
  position: 'relative', aspectRatio: '1', padding: 0, borderRadius: 10,
  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 22, background: 'var(--surface-alt)', border: '1px solid var(--border)',
};

/** Una casilla. Resuelve su cara (lottie → imagen → estilo) y monta el
 * Lottie solo mientras esa cara lo pide. El `useEffect` sobre `cara`
 * evita que una gema/explosión se vuelva a reproducir en cada render. */
function Casilla({
  juego, cara, animar, destapable, atenuada, retardoMs, onClick,
}: {
  juego: Juego;
  cara: Cara;
  /** Si esta casilla debe reproducir su animación (gema al destapar, o
   *  explosión — en todas las minas al perder). */
  animar: boolean;
  destapable: boolean;
  atenuada: boolean;
  /** Retraso del arranque, para que las explosiones no salgan todas juntas. */
  retardoMs: number;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visual = casillaCara(juego, cara);
  const usaLottie = !!visual.lottie && (animar || cara === 'oculta');

  useEffect(() => {
    if (!usaLottie || !ref.current) return;
    let limpiar: (() => void) | null = null;
    let vivo = true;
    const contenedor = ref.current;
    const t = setTimeout(() => {
      montarLottieEn(contenedor, visual.lottie!, { loop: cara === 'oculta' }).then((fn) => {
        if (vivo) limpiar = fn; else fn();
      });
    }, retardoMs);
    return () => { vivo = false; clearTimeout(t); limpiar?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usaLottie, visual.lottie, cara]);

  // Textura de la casilla (campo fondo_url de Arte, en Mines por casilla).
  const textura = (juego.fondo_url as string) || null;
  const caraPlana = !usaLottie && !visual.imagen; // cara "por defecto" (solo tinte + emoji)
  const tinte = caraPlana && cara === 'segura' ? 'rgba(91,191,136,.16)'
    : caraPlana && cara === 'mina' ? 'rgba(229,104,107,.18)'
    : null;
  const borde = cara === 'oculta' ? 'var(--border)'
    : (usaLottie || visual.imagen) ? 'transparent'
    : cara === 'segura' ? 'var(--ok)' : 'var(--danger)';

  return (
    <button
      disabled={!destapable}
      onClick={() => destapable && onClick()}
      aria-label="Casilla"
      style={{
        ...BOTON_CELDA,
        background: textura ? `center/cover no-repeat url('${textura}')` : 'var(--surface-alt)',
        borderColor: borde,
        cursor: destapable ? 'pointer' : 'default',
        opacity: atenuada ? 0.55 : 1,
        transition: 'opacity .15s, border-color .15s',
      }}
    >
      {/* Imagen propia de la cara (segura/mina) — tapa la textura. */}
      {!usaLottie && visual.imagen && (
        <span style={{ position: 'absolute', inset: 0, background: `center/cover no-repeat url('${visual.imagen}')` }} />
      )}
      {/* Tinte semitransparente para las caras por defecto — deja ver la textura. */}
      {tinte && <span style={{ position: 'absolute', inset: 0, background: tinte }} />}
      {/* Animación Lottie. */}
      {usaLottie && <div ref={ref} style={{ position: 'absolute', inset: 0 }} />}
      {/* Emoji de la cara por defecto. */}
      {caraPlana && visual.emoji && <span style={{ position: 'relative' }}>{visual.emoji}</span>}
    </button>
  );
}

export function TableroMines({
  juego, estado, minBet, maxBet, pasoApuesta,
  onIniciar, onRevelar, onRetirar, onCambiarApuesta, onCambiarMinas, onNueva,
}: TableroMinesProps) {
  const { fase, minas, apuesta, reveladas, minasPos, clicMina, multiplicador, puedeRetirar, saldo, ganancia, cargando, error } = estado;
  const jugando = fase === 'en_curso';
  const terminada = fase === 'retirada' || fase === 'perdida';
  const segurasRestantes = TOTAL - minas - reveladas.length;
  const gananciaPotencial = apuesta * multiplicador;

  // Al perder, 'todo' (por defecto) destapa el tablero entero: las
  // seguras que el jugador no eligió también se muestran.
  const perdio = fase === 'perdida';
  const limpiarTablero = perdio && (juego.mines_revelado_al_perder ?? 'todo') !== 'minas';
  const distClic = (i: number) => (clicMina == null ? 0
    : Math.abs(Math.floor(i / LADO) - Math.floor(clicMina / LADO)) + Math.abs((i % LADO) - (clicMina % LADO)));

  return (
    <div style={{ width: 340, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Caja etiqueta="Saldo" valor={fmt(saldo)} />
        {jugando
          ? <Caja etiqueta={`Multiplicador · ${segurasRestantes} seguras`} valor={`×${multiplicador.toFixed(2)}`} />
          : <Caja etiqueta="Minas" valor={String(minas)} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${LADO}, 1fr)`, gap: 6 }}>
        {Array.from({ length: TOTAL }, (_, i) => {
          const esMina = !!minasPos?.includes(i);
          const revelada = reveladas.includes(i) || (limpiarTablero && !esMina);
          const cara: Cara = esMina ? 'mina' : revelada ? 'segura' : 'oculta';

          // Al perder: TODAS las minas explotan y (en modo 'todo') las
          // seguras se destapan, con un retraso en onda expansiva desde
          // la casilla que se pisó.
          const explota = esMina && perdio;
          const retardo = (explota || (limpiarTablero && !esMina)) ? distClic(i) * 55 : 0;

          return (
            <Casilla
              key={i}
              juego={juego}
              cara={cara}
              animar={explota || (cara === 'segura' && revelada)}
              atenuada={esMina && fase === 'retirada'}
              retardoMs={retardo}
              destapable={jugando && !cargando && !revelada}
              onClick={() => onRevelar(i)}
            />
          );
        })}
      </div>

      {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}

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
