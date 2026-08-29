import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { casillaCara, LADO, TOTAL } from './juego/mines.ts';
import type { Cara, EstadoPartida } from './juego/mines.ts';
import { montarLottieEn } from './lottie.ts';
import { ControlesMines } from './ControlesMines.tsx';
import type { Escenario } from './juego/escenario.ts';
import type { Juego, PosControlesMines } from './types.ts';

interface TableroMinesProps {
  escenario: Escenario;
  pos: PosControlesMines;
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

const BOTON_CELDA: CSSProperties = {
  position: 'relative', aspectRatio: '1', padding: 0, borderRadius: 10,
  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 22, background: 'var(--surface-alt)', border: '1px solid var(--border)',
};

/** Una casilla. Resuelve su cara (lottie → imagen → estilo) y monta el
 * Lottie solo mientras esa cara lo pide. El `useEffect` sobre `cara`
 * evita que una gema/explosión se vuelva a reproducir en cada render. */
function Casilla({
  juego, cara, animar, destapable, atenuada, pendiente, retardoMs, onClick,
}: {
  juego: Juego;
  cara: Cara;
  /** Si esta casilla debe reproducir su animación (gema al destapar, o
   *  explosión — en todas las minas al perder). */
  animar: boolean;
  destapable: boolean;
  atenuada: boolean;
  /** Esperando la respuesta del servidor — muestra un pulso al instante. */
  pendiente: boolean;
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
        borderColor: pendiente ? 'var(--accent)' : borde,
        cursor: destapable ? 'pointer' : 'default',
        opacity: atenuada ? 0.55 : 1,
        transform: pendiente ? 'scale(.94)' : 'none',
        transition: 'opacity .15s, border-color .15s, transform .12s',
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
      {caraPlana && !pendiente && visual.emoji && <span style={{ position: 'relative' }}>{visual.emoji}</span>}
      {/* Feedback inmediato mientras el servidor responde. */}
      {pendiente && <span className="mines-pendiente" />}
    </button>
  );
}

// La grilla 5×5, sin controles — se monta dentro de la caja "Tablero"
// del escenario (posicionable desde el panel Capas).
function GrillaMines({ juego, estado, onRevelar }: {
  juego: Juego; estado: EstadoPartida; onRevelar: (i: number) => void;
}) {
  const { fase, minas, reveladas, minasPos, clicMina, pendiente, cargando } = estado;
  const jugando = fase === 'en_curso';
  const perdio = fase === 'perdida';
  const limpiarTablero = perdio && (juego.mines_revelado_al_perder ?? 'todo') !== 'minas';
  const distClic = (i: number) => (clicMina == null ? 0
    : Math.abs(Math.floor(i / LADO) - Math.floor(clicMina / LADO)) + Math.abs((i % LADO) - (clicMina % LADO)));

  return (
    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${LADO}, 1fr)`, gap: 6 }}>
      {Array.from({ length: TOTAL }, (_, i) => {
        const esMina = !!minasPos?.includes(i);
        const revelada = reveladas.includes(i) || (limpiarTablero && !esMina);
        const cara: Cara = esMina ? 'mina' : revelada ? 'segura' : 'oculta';

        // Al perder: TODAS las minas explotan y (en modo 'todo') las
        // seguras se destapan, en onda expansiva desde la que se pisó.
        // La animación en loop de la tapada arranca escalonada, para que
        // el tablero pinte al instante y las 25 instancias no salgan de golpe.
        const explota = esMina && perdio;
        const retardo = (explota || (limpiarTablero && !esMina)) ? distClic(i) * 55
          : cara === 'oculta' ? 120 + i * 35
          : 0;

        return (
          <Casilla
            key={i}
            juego={juego}
            cara={cara}
            animar={explota || (cara === 'segura' && revelada)}
            atenuada={esMina && fase === 'retirada'}
            pendiente={pendiente === i}
            retardoMs={retardo}
            destapable={jugando && !cargando && pendiente == null && !revelada}
            onClick={() => onRevelar(i)}
          />
        );
      })}
    </div>
  );
}

// El tablero completo: la grilla va en la caja "Tablero" del escenario
// y los controles (saldo, multiplicador, botón, apuesta, minas) en una
// capa aparte, cada uno posicionable desde el panel de ajuste.
export function TableroMines({
  escenario, pos, juego, estado, minBet, maxBet, pasoApuesta,
  onIniciar, onRevelar, onRetirar, onCambiarApuesta, onCambiarMinas, onNueva,
}: TableroMinesProps) {
  return (
    <>
      {createPortal(<GrillaMines juego={juego} estado={estado} onRevelar={onRevelar} />, escenario.grillaEl)}
      {createPortal(
        <ControlesMines
          juego={juego} pos={pos} estado={estado}
          minBet={minBet} maxBet={maxBet} pasoApuesta={pasoApuesta}
          onIniciar={onIniciar} onRetirar={onRetirar} onNueva={onNueva}
          onCambiarApuesta={onCambiarApuesta} onCambiarMinas={onCambiarMinas}
        />,
        escenario.el,
      )}
    </>
  );
}
