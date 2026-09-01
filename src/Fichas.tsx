import { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Ficha } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

interface FichasProps {
  /** Elemento donde se montan (la pantalla del juego, 420×860). */
  host: HTMLElement;
  fichas: Ficha[];
  /** Apuesta actual — la ficha con ese valor queda marcada. */
  apuesta: number;
  onElegir: (valor: number) => void;
  /** No se puede tocar (mientras el juego está resolviendo). */
  bloqueado?: boolean;
  /** Modo edición: se pueden arrastrar para ubicarlas. */
  editable?: boolean;
  onMover?: (i: number, x: number, y: number) => void;
}

// Fichas de apuesta rápida. Overlay puro: se monta por portal encima de
// la pantalla del juego, sin tocar el resto de los controles. La misma
// para todos los motores.
export function Fichas({ host, fichas, apuesta, onElegir, bloqueado, editable, onMover }: FichasProps) {
  const dragRef = useRef<{ i: number; movido: boolean } | null>(null);

  const onDown = (e: React.PointerEvent, i: number) => {
    if (!editable) return;
    e.preventDefault();
    dragRef.current = { i, movido: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !editable || !onMover) return;
    d.movido = true;
    const r = host.getBoundingClientRect();
    const x = Math.round(Math.max(3, Math.min(97, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.max(4, Math.min(97, ((e.clientY - r.top) / r.height) * 100)));
    onMover(d.i, x, y);
  };
  const onUp = (e: React.PointerEvent, valor: number) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.movido && !bloqueado) onElegir(valor);
  };

  return createPortal(
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      <style>{`
        .gw-ficha {
          position:absolute; transform:translate(-50%,-50%);
          border:0; padding:0; border-radius:50%;
          background:radial-gradient(circle at 32% 28%, #2b3140, #171a22);
          box-shadow:0 6px 16px -6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
          cursor:pointer; pointer-events:auto; touch-action:none;
          display:flex; align-items:center; justify-content:center;
          transition:box-shadow .14s ease, transform .12s ease, filter .14s ease;
          font-family:var(--pk-body, var(--rs-body, inherit));
        }
        .gw-ficha .gw-ficha-img {
          border-radius:50%; background-size:cover; background-position:center; background-repeat:no-repeat;
          display:flex; align-items:center; justify-content:center;
          font-family:var(--mono, monospace); font-weight:700; color:#fff;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);
        }
        .gw-ficha .gw-ficha-val {
          position:absolute; bottom:-14px; left:50%; transform:translateX(-50%);
          font-family:var(--mono, monospace); font-size:10px; font-weight:600; color:var(--text-dim,#8a93a1);
          background:rgba(0,0,0,.55); padding:1px 6px; border-radius:5px; white-space:nowrap;
        }
        .gw-ficha.on {
          box-shadow:0 0 0 2px var(--accent), 0 0 22px -2px var(--accent), 0 6px 16px -6px rgba(0,0,0,.6);
          filter:brightness(1.2) saturate(1.08);
          transform:translate(-50%,-50%) scale(1.09);
          z-index:3;
        }
        .gw-ficha.on .gw-ficha-val { color:var(--accent); }
        .gw-ficha.edit { outline:1px dashed rgba(255,255,255,.35); outline-offset:3px; }
        @media (prefers-reduced-motion: reduce){ .gw-ficha, .gw-ficha.on { transition:none } }
      `}</style>

      {fichas.map((f, i) => {
        const marcada = Math.round(f.valor) === Math.round(apuesta);
        const conImg = !!f.imagen_url;
        return (
          <button
            key={i}
            className={`gw-ficha ${marcada ? 'on' : ''} ${editable ? 'edit' : ''}`}
            style={{ left: `${f.x}%`, top: `${f.y}%`, width: f.tam, height: f.tam, opacity: bloqueado && !editable ? 0.55 : 1 }}
            onPointerDown={(e) => onDown(e, i)}
            onPointerMove={onMove}
            onPointerUp={(e) => onUp(e, f.valor)}
            onPointerCancel={() => { dragRef.current = null; }}
          >
            <span
              className="gw-ficha-img"
              style={{
                width: `${f.imgTam}%`, height: `${f.imgTam}%`,
                fontSize: Math.max(9, f.tam * f.imgTam / 100 * 0.34),
                background: conImg
                  ? `center/cover no-repeat url("${f.imagen_url}")`
                  : 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))',
                boxShadow: conImg ? 'inset 0 0 0 1px rgba(255,255,255,.14)' : 'none',
              }}
            >
              {!conImg && fichaCorto(f.valor)}
            </span>
            <span className="gw-ficha-val">{fmt(f.valor)}</span>
          </button>
        );
      })}
    </div>,
    host,
  );
}

interface FichasStripProps {
  fichas: Ficha[];
  apuesta: number;
  onElegir: (valor: number) => void;
  bloqueado?: boolean;
}

// Tira de fichas para los juegos instantáneos (Limbo, Dice): no hay
// escenario 420×860 para posicionar, así que van en una fila centrada.
// Se respeta el valor, la imagen redonda y el tamaño de cada ficha.
export function FichasStrip({ fichas, apuesta, onElegir, bloqueado }: FichasStripProps) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', padding: '2px 0 16px' }}>
      <style>{`
        .gw-strip-ficha {
          position:relative; border:0; padding:0; border-radius:50%; flex-shrink:0;
          background:radial-gradient(circle at 32% 28%, #2b3140, #171a22);
          box-shadow:0 6px 16px -6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:box-shadow .14s ease, transform .12s ease, filter .14s ease;
        }
        .gw-strip-ficha .gw-strip-img {
          border-radius:50%; display:flex; align-items:center; justify-content:center;
          font-family:var(--mono, monospace); font-weight:700; color:#fff;
        }
        .gw-strip-ficha .gw-strip-val {
          position:absolute; bottom:-15px; left:50%; transform:translateX(-50%);
          font-family:var(--mono, monospace); font-size:10px; font-weight:600; color:var(--text-dim,#8a93a1);
          background:rgba(0,0,0,.55); padding:1px 6px; border-radius:5px; white-space:nowrap;
        }
        .gw-strip-ficha.on {
          box-shadow:0 0 0 2px var(--accent), 0 0 22px -2px var(--accent), 0 6px 16px -6px rgba(0,0,0,.6);
          filter:brightness(1.2) saturate(1.08); transform:scale(1.09);
        }
        .gw-strip-ficha.on .gw-strip-val { color:var(--accent); }
        @media (prefers-reduced-motion: reduce){ .gw-strip-ficha { transition:none } }
      `}</style>
      {fichas.map((f, i) => {
        const marcada = Math.round(f.valor) === Math.round(apuesta);
        const conImg = !!f.imagen_url;
        return (
          <button
            key={i}
            className={`gw-strip-ficha ${marcada ? 'on' : ''}`}
            disabled={bloqueado}
            style={{ width: f.tam, height: f.tam, opacity: bloqueado ? 0.55 : 1 }}
            onClick={() => !bloqueado && onElegir(f.valor)}
          >
            <span
              className="gw-strip-img"
              style={{
                width: `${f.imgTam}%`, height: `${f.imgTam}%`,
                fontSize: Math.max(9, f.tam * f.imgTam / 100 * 0.34),
                background: conImg
                  ? `center/cover no-repeat url("${f.imagen_url}")`
                  : 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))',
                boxShadow: conImg ? 'inset 0 0 0 1px rgba(255,255,255,.14)' : 'none',
              }}
            >
              {!conImg && fichaCorto(f.valor)}
            </span>
            <span className="gw-strip-val">{fmt(f.valor)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta corta para la ficha sin imagen: 1k, 5k, 1M… */
function fichaCorto(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k';
  return String(Math.round(n));
}
