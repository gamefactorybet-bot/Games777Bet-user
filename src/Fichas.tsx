import { useRef, useState, type CSSProperties } from 'react';
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
  /** 'fila' (por defecto): todas visibles. 'abanico': una sola ficha
   * (la ficha 0 hace de ancla), el resto se abre al tocarla. */
  modo?: 'fila' | 'abanico';
}

// Fichas de apuesta rápida. Overlay puro: se monta por portal encima de
// la pantalla del juego, sin tocar el resto de los controles. La misma
// para todos los motores.
export function Fichas({ host, fichas, apuesta, onElegir, bloqueado, editable, onMover, modo = 'fila' }: FichasProps) {
  const dragRef = useRef<{ i: number; movido: boolean } | null>(null);

  if (modo === 'abanico') {
    const ancla = fichas[0];
    if (!ancla) return null;
    return createPortal(
      <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
        <Abanico
          fichas={fichas} apuesta={apuesta} onElegir={onElegir} bloqueado={bloqueado}
          host={host} x={ancla.x} y={ancla.y} ancho={host.getBoundingClientRect().width || 320}
          editable={editable} onMover={onMover ? (nx, ny) => onMover(0, nx, ny) : undefined}
        />
      </div>,
      host,
    );
  }

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
  /** 'fila' (por defecto) o 'abanico' (una sola ficha, el resto se abre al tocarla). */
  modo?: 'fila' | 'abanico';
}

// Tira de fichas para los juegos instantáneos (Limbo, Dice, 7 Up 7
// Down): no hay escenario 420×860 para posicionar, así que van en una
// fila centrada. Se respeta el valor, la imagen redonda y el tamaño de
// cada ficha.
export function FichasStrip({ fichas, apuesta, onElegir, bloqueado, modo = 'fila' }: FichasStripProps) {
  if (modo === 'abanico') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 20px' }}>
        <Abanico fichas={fichas} apuesta={apuesta} onElegir={onElegir} bloqueado={bloqueado} ancho={340} />
      </div>
    );
  }
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

// ---------------- Modo "abanico" ----------------

interface AbanicoProps {
  fichas: Ficha[];
  apuesta: number;
  onElegir: (valor: number) => void;
  bloqueado?: boolean;
  /** Ancho de referencia (px) para el radio del abanico. */
  ancho?: number;
  /** Modo edición: la ficha activa se puede arrastrar para reubicar el ancla. */
  editable?: boolean;
  onMover?: (x: number, y: number) => void;
  /** Con host + x/y: se ubica en esa posición (% del host), como <Fichas>.
   * Sin host: queda en flujo normal (lo usa <FichasStrip>). */
  host?: HTMLElement;
  x?: number;
  y?: number;
}

/**
 * Solo se ve la ficha activa (la que coincide con la apuesta). Tocarla
 * despliega el resto en abanico alrededor; elegir una la reemplaza y
 * todo se repliega solo. Pensado para no ocupar una franja fija de la
 * pantalla con todas las fichas a la vez.
 */
function Abanico({ fichas, apuesta, onElegir, bloqueado, ancho = 320, editable, onMover, host, x, y }: AbanicoProps) {
  const [abierto, setAbierto] = useState(false);
  const dragRef = useRef<{ movido: boolean } | null>(null);

  if (!fichas.length) return null;
  const activa = fichas.find((f) => Math.round(f.valor) === Math.round(apuesta)) ?? fichas[0];
  const resto = fichas.filter((f) => f !== activa);
  const radio = Math.max(64, Math.min(112, ancho * 0.32));
  const n = resto.length;

  const elegir = (valor: number) => { onElegir(valor); setAbierto(false); };

  const anclaProps = editable
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          dragRef.current = { movido: false };
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        },
        onPointerMove: (e: React.PointerEvent) => {
          const d = dragRef.current; if (!d || !host || !onMover) return;
          d.movido = true;
          const r = host.getBoundingClientRect();
          const nx = Math.round(Math.max(3, Math.min(97, ((e.clientX - r.left) / r.width) * 100)));
          const ny = Math.round(Math.max(4, Math.min(97, ((e.clientY - r.top) / r.height) * 100)));
          onMover(nx, ny);
        },
        onPointerUp: () => {
          const d = dragRef.current; dragRef.current = null;
          if (!d?.movido) setAbierto((v) => !v);
        },
        onPointerCancel: () => { dragRef.current = null; },
      }
    : { onClick: () => { if (!bloqueado) setAbierto((v) => !v); } };

  const raiz: CSSProperties = host
    ? { position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'auto', width: activa.tam, height: activa.tam }
    : { position: 'relative', width: activa.tam, height: activa.tam };

  return (
    <>
      <style>{`
        .gw-abanico-velo { inset:0; background:rgba(5,6,10,.5); z-index:11; pointer-events:auto; }
        .gw-abanico-ficha {
          position:absolute; left:50%; top:50%; border:0; padding:0; border-radius:50%;
          background:radial-gradient(circle at 32% 28%, #2b3140, #171a22);
          box-shadow:0 6px 16px -6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
          cursor:pointer; touch-action:none; display:flex; align-items:center; justify-content:center;
          transition:transform .36s cubic-bezier(.34,1.56,.64,1), opacity .2s ease, box-shadow .15s ease;
          font-family:var(--pk-body, var(--rs-body, inherit));
        }
        .gw-abanico-principal { z-index:13; }
        .gw-abanico-secundaria { z-index:12; }
        .gw-abanico-img {
          border-radius:50%; background-size:cover; background-position:center; background-repeat:no-repeat;
          display:flex; align-items:center; justify-content:center;
          font-family:var(--mono, monospace); font-weight:700; color:#fff;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);
        }
        .gw-abanico-val {
          position:absolute; bottom:-14px; left:50%; transform:translateX(-50%);
          font-family:var(--mono, monospace); font-size:10px; font-weight:600; color:var(--text-dim,#8a93a1);
          background:rgba(0,0,0,.55); padding:1px 6px; border-radius:5px; white-space:nowrap;
        }
        @media (prefers-reduced-motion: reduce){ .gw-abanico-ficha { transition:none } }
      `}</style>

      {abierto && <div className="gw-abanico-velo" style={{ position: host ? 'absolute' : 'fixed' }} onClick={() => setAbierto(false)} />}

      <div style={raiz}>
        <button
          type="button"
          className="gw-abanico-ficha gw-abanico-principal"
          aria-haspopup="true" aria-expanded={abierto}
          aria-label={`Ficha activa: ${fmt(activa.valor)}. Tocar para elegir otra.`}
          disabled={bloqueado && !editable}
          style={{ width: activa.tam, height: activa.tam, transform: 'translate(-50%,-50%)', opacity: bloqueado && !editable ? 0.55 : 1 }}
          {...anclaProps}
        >
          <FichaContenido f={activa} />
        </button>

        {resto.map((f, k) => {
          const ang = n === 1 ? 90 : 158 + (22 - 158) * (k / (n - 1));
          const rad = (ang * Math.PI) / 180;
          const tx = Math.cos(rad) * radio, ty = -Math.sin(rad) * radio;
          return (
            <button
              key={f.valor}
              type="button"
              className="gw-abanico-ficha gw-abanico-secundaria"
              aria-label={fmt(f.valor)}
              style={{
                width: f.tam, height: f.tam,
                transform: abierto
                  ? `translate(calc(-50% + ${tx.toFixed(1)}px), calc(-50% + ${ty.toFixed(1)}px)) scale(1)`
                  : 'translate(-50%,-50%) scale(.3)',
                opacity: abierto ? 1 : 0,
                pointerEvents: abierto ? 'auto' : 'none',
                transitionDelay: abierto ? `${k * 26}ms` : '0ms',
              }}
              onClick={() => elegir(f.valor)}
            >
              <FichaContenido f={f} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function FichaContenido({ f }: { f: Ficha }) {
  const conImg = !!f.imagen_url;
  return (
    <>
      <span
        className="gw-abanico-img"
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
      <span className="gw-abanico-val">{fmt(f.valor)}</span>
    </>
  );
}
