import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { demoraAbanico, fichasCfgSlot, fichasConDefaults, puestosAbanico } from '../motor/fichas.js';
import { alphaEn, encajarImagen } from './juego/silueta.ts';
import type { Ficha, FichasCfg, Juego } from './types.ts';

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
  modo?: 'fila' | 'abanico' | 'columna';
  /** % del radio automático (50–220). 100 = el de siempre. */
  abanicoApertura?: number;
  /** Arco en grados hacia arriba (70–180). 136 = el de siempre. */
  abanicoArco?: number;
  /** Slot 3×3/5×3. Sin estos dos, el arco sigue el orden de la lista y cierra el hueco de la activa. */
  abanicoOrden?: FichasCfg['abanicoOrden'];
  abanicoSale?: FichasCfg['abanicoSale'];
}

// Fichas de apuesta rápida. Overlay puro: se monta por portal encima de
// la pantalla del juego, sin tocar el resto de los controles. La misma
// para todos los motores.
export function Fichas({ host, fichas, apuesta, onElegir, bloqueado, editable, onMover, modo = 'fila', abanicoApertura = 100, abanicoArco = 136, abanicoOrden, abanicoSale }: FichasProps) {
  const dragRef = useRef<{ i: number; movido: boolean } | null>(null);

  if (modo === 'abanico' || modo === 'columna') {
    const ancla = fichas[0];
    if (!ancla) return null;
    const moverAncla = onMover ? (nx: number, ny: number) => onMover(0, nx, ny) : undefined;
    return createPortal(
      <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
        {modo === 'columna' ? (
          <Columna
            fichas={fichas} apuesta={apuesta} onElegir={onElegir} bloqueado={bloqueado}
            host={host} x={ancla.x} y={ancla.y} orden={abanicoOrden}
            editable={editable} onMover={moverAncla}
          />
        ) : (
        <Abanico
          fichas={fichas} apuesta={apuesta} onElegir={onElegir} bloqueado={bloqueado}
          host={host} x={ancla.x} y={ancla.y} ancho={host.getBoundingClientRect().width || 320}
          apertura={abanicoApertura} arco={abanicoArco}
          orden={abanicoOrden} sale={abanicoSale}
          editable={editable} onMover={moverAncla}
        />
        )}
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
        .gw-ficha.con-img, .gw-ficha.con-img.on {
          background:transparent; box-shadow:none; border-radius:0; filter:none;
        }
        .gw-ficha.con-img.on > .gw-ficha-foto {
          filter:brightness(1.14) drop-shadow(0 0 4px var(--jg-borde, var(--accent))) drop-shadow(0 0 11px var(--jg-borde, var(--accent)));
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
            className={`gw-ficha ${conImg ? 'con-img' : ''} ${marcada ? 'on' : ''} ${editable ? 'edit' : ''}`}
            style={{
              left: `${f.x}%`, top: `${f.y}%`,
              width: conImg ? 'auto' : f.tam, height: conImg ? 'auto' : f.tam,
              padding: conImg ? 0 : undefined,
              background: conImg ? 'transparent' : undefined,
              boxShadow: conImg ? 'none' : undefined,
              borderRadius: conImg ? 0 : undefined,
              opacity: bloqueado && !editable ? 0.55 : 1,
            }}
            onPointerDownCapture={conImg ? huecoFicha : undefined}
            onPointerDown={(e) => onDown(e, i)}
            onPointerMove={onMove}
            onPointerUp={(e) => onUp(e, f.valor)}
            onPointerCancel={() => { dragRef.current = null; }}
          >
            {conImg
              ? <FichaFoto url={f.imagen_url!} lado={ladoFicha(f)} />
              : (
                <span
                  className="gw-ficha-img"
                  style={{
                    width: `${f.imgTam}%`, height: `${f.imgTam}%`,
                    fontSize: Math.max(9, f.tam * f.imgTam / 100 * 0.34),
                    background: 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))',
                  }}
                >
                  {fichaCorto(f.valor)}
                </span>
              )}
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
  modo?: 'fila' | 'abanico' | 'columna';
  abanicoApertura?: number;
  abanicoArco?: number;
  abanicoOrden?: FichasCfg['abanicoOrden'];
  abanicoSale?: FichasCfg['abanicoSale'];
}

// Tira de fichas para los juegos instantáneos (Limbo, Dice, 7 Up 7
// Down): no hay escenario 420×860 para posicionar, así que van en una
// fila centrada. Se respeta el valor, la imagen redonda y el tamaño de
// cada ficha.
export function FichasStrip({ fichas, apuesta, onElegir, bloqueado, modo = 'fila', abanicoApertura = 100, abanicoArco = 136, abanicoOrden, abanicoSale }: FichasStripProps) {
  if (modo === 'abanico' || modo === 'columna') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 20px' }}>
        {modo === 'columna' ? (
          <Columna fichas={fichas} apuesta={apuesta} onElegir={onElegir} bloqueado={bloqueado} orden={abanicoOrden} />
        ) : (
          <Abanico fichas={fichas} apuesta={apuesta} onElegir={onElegir} bloqueado={bloqueado} ancho={340}
            apertura={abanicoApertura} arco={abanicoArco} orden={abanicoOrden} sale={abanicoSale} />
        )}
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
        .gw-strip-ficha.con-img, .gw-strip-ficha.con-img.on {
          background:transparent; box-shadow:none; border-radius:0; filter:none; transform:none;
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
            className={`gw-strip-ficha ${conImg ? 'con-img' : ''} ${marcada ? 'on' : ''}`}
            disabled={bloqueado}
            style={{
              width: conImg ? 'auto' : f.tam, height: conImg ? 'auto' : f.tam,
              padding: conImg ? 0 : undefined, background: conImg ? 'transparent' : undefined,
              borderRadius: conImg ? 0 : undefined, opacity: bloqueado ? 0.55 : 1,
            }}
            onPointerDownCapture={conImg ? huecoFicha : undefined}
            onClick={() => !bloqueado && onElegir(f.valor)}
          >
            {conImg
              ? <FichaFoto url={f.imagen_url!} lado={ladoFicha(f)} />
              : (
                <span
                  className="gw-strip-img"
                  style={{
                    width: `${f.imgTam}%`, height: `${f.imgTam}%`,
                    fontSize: Math.max(9, f.tam * f.imgTam / 100 * 0.34),
                    background: 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))',
                  }}
                >
                  {fichaCorto(f.valor)}
                </span>
              )}
            <span className="gw-strip-val">{fmt(f.valor)}</span>
          </button>
        );
      })}
    </div>
  );
}

function esparcirSiApiladas(fichas: Ficha[], gx: number, gy: number): Ficha[] {
  if (fichas.length < 2) return fichas;
  const x0 = fichas[0].x, y0 = fichas[0].y;
  if (!fichas.every((f) => Math.abs(f.x - x0) < 1 && Math.abs(f.y - y0) < 1)) return fichas;
  const paso = 14;
  const start = gx - ((fichas.length - 1) * paso) / 2;
  return fichas.map((f, k) => ({
    ...f,
    x: Math.max(6, Math.min(94, start + k * paso)),
    y: gy,
  }));
}

/** Overlay de fichas para slots / ruleta: el escenario esconde su tira HTML
 *  y cada ficha se ubica (y se arrastra en la preview) como en Mines. */
export function FichasEnEscenario({ juego, escenario, fichas, editable, onMover }: {
  juego: Juego;
  escenario: {
    el: HTMLElement; apuesta: number; pintarApuesta: () => void; girando: boolean;
    posGrupos?: { fichas_x: number; fichas_y: number };
  };
  fichas?: Ficha[];
  editable?: boolean;
  onMover?: (i: number, x: number, y: number) => void;
}) {
  const cfg = fichasCfgSlot(juego.fichas_cfg) as FichasCfg;
  const [apuesta, setApuesta] = useState(escenario.apuesta);
  const lista = fichas ?? cfg.fichas;
  if (!lista.length) return null;
  // En el slot el ancla es el grupo (⚙ Fichas X/Y), no cada ficha por su cuenta.
  const gx = Number(escenario.posGrupos?.fichas_x ?? juego.fichas_x ?? 50);
  const gy = Number(escenario.posGrupos?.fichas_y ?? juego.fichas_y ?? 88);
  const visibles = cfg.modo === 'abanico' || cfg.modo === 'columna'
    ? lista.map((f, i) => (i === 0 ? { ...f, x: gx, y: gy } : f))
    : esparcirSiApiladas(lista, gx, gy);
  return (
    <Fichas
      host={escenario.el}
      fichas={visibles}
      apuesta={apuesta}
      editable={editable}
      onMover={onMover}
      onElegir={(v) => {
        if (escenario.girando) return;
        escenario.apuesta = v;
        escenario.pintarApuesta();
        setApuesta(v);
      }}
      modo={cfg.modo}
      abanicoApertura={cfg.abanicoApertura}
      abanicoArco={cfg.abanicoArco}
      abanicoOrden={cfg.abanicoOrden}
      abanicoSale={cfg.abanicoSale}
    />
  );
}

/** @deprecated usar FichasEnEscenario */
export const FichasSlotAbanico = FichasEnEscenario;

/** Etiqueta corta para la ficha sin imagen: 1k, 5k, 1M… */
function fichaCorto(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k';
  return String(Math.round(n));
}

// ---------------- Modo "columna" (como Auto) ----------------

function fichasEnColumna(fichas: Ficha[], apuesta: number, orden?: FichasCfg['abanicoOrden']): Ficha[] {
  const activa = fichas.find((f) => Math.round(f.valor) === Math.round(apuesta)) ?? fichas[0];
  if (orden) {
    const puestos = puestosAbanico(fichas, apuesta, orden) as unknown as { ficha: Ficha }[];
    return puestos.map((p) => p.ficha);
  }
  return fichas.filter((f) => f !== activa);
}

/**
 * Igual que Auto: se ve la ficha activa y, al tocarla, el resto sale
 * hacia arriba en una columna. Elegir una la deja en el botón y cierra.
 */
function Columna({ fichas, apuesta, onElegir, bloqueado, editable, onMover, host, x = 50, y = 88, orden }: {
  fichas: Ficha[];
  apuesta: number;
  onElegir: (valor: number) => void;
  bloqueado?: boolean;
  editable?: boolean;
  onMover?: (x: number, y: number) => void;
  host?: HTMLElement;
  x?: number;
  y?: number;
  orden?: FichasCfg['abanicoOrden'];
}) {
  const [abierto, setAbierto] = useState(false);
  const dragRef = useRef<{ movido: boolean } | null>(null);
  if (!fichas.length) return null;
  const activa = fichas.find((f) => Math.round(f.valor) === Math.round(apuesta)) ?? fichas[0];
  const resto = fichasEnColumna(fichas, apuesta, orden);
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
          if (!d?.movido && !bloqueado) setAbierto((v) => !v);
        },
        onPointerCancel: () => { dragRef.current = null; },
      }
    : { onClick: () => { if (!bloqueado) setAbierto((v) => !v); } };

  const raiz: CSSProperties = host
    ? { position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'auto', overflow: 'visible' }
    : { position: 'relative', display: 'inline-block', overflow: 'visible' };

  return (
    <div style={raiz}>
      <style>{`
        .gw-columna-velo { position:fixed; inset:0; z-index:11; }
        .gw-columna-menu {
          position:absolute; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%);
          display:flex; flex-direction:column; align-items:center; gap:8px; z-index:20;
        }
        .gw-columna-item {
          position:relative; border:0; padding:0; cursor:pointer; touch-action:none;
          display:flex; align-items:center; justify-content:center;
          background:radial-gradient(circle at 32% 28%, #2b3140, #171a22);
          box-shadow:0 6px 16px -6px rgba(0,0,0,.6);
          transition:opacity .2s ease, transform .22s ease;
        }
        .gw-columna-item.con-img, .gw-columna-principal.con-img { background:transparent; box-shadow:none; border-radius:0; }
        .gw-columna-principal {
          position:relative; border:0; padding:0; border-radius:50%; cursor:pointer; touch-action:none;
          display:flex; align-items:center; justify-content:center;
          background:radial-gradient(circle at 32% 28%, #2b3140, #171a22);
          box-shadow:0 6px 16px -6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
        }
        .gw-columna-item, .gw-columna-principal { font-family:var(--pk-body, var(--rs-body, inherit)); }
        .gw-abanico-val {
          position:absolute; bottom:-14px; left:50%; transform:translateX(-50%);
          font-family:var(--mono, monospace); font-size:10px; font-weight:600; color:var(--text-dim,#8a93a1);
          background:rgba(0,0,0,.55); padding:1px 6px; border-radius:5px; white-space:nowrap;
        }
      `}</style>
      {abierto && <div className="gw-columna-velo" onClick={() => setAbierto(false)} />}
      <div style={{ position: 'relative' }}>
        <div className="gw-columna-menu" style={{ visibility: abierto ? 'visible' : 'hidden' }}>
          {resto.map((f, i) => (
            <button
              key={`${f.valor}-${i}`}
              type="button"
              className={`gw-columna-item${f.imagen_url ? ' con-img' : ''}`}
              aria-label={fmt(f.valor)}
              onPointerDownCapture={f.imagen_url ? huecoFicha : undefined}
              style={{
                width: f.imagen_url ? 'auto' : f.tam,
                height: f.imagen_url ? 'auto' : f.tam,
                background: f.imagen_url ? 'transparent' : undefined,
                borderRadius: f.imagen_url ? 0 : '50%',
                opacity: abierto ? 1 : 0,
                transform: abierto ? 'none' : 'translateY(10px)',
                transitionDelay: abierto ? `${i * 26}ms` : '0ms',
                pointerEvents: abierto ? 'auto' : 'none',
              }}
              onClick={() => elegir(f.valor)}
            >
              <FichaContenido f={f} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`gw-columna-principal${activa.imagen_url ? ' con-img' : ''}`}
          aria-expanded={abierto}
          aria-label={`Ficha activa: ${fmt(activa.valor)}. Tocar para ver las demás.`}
          disabled={bloqueado && !editable}
          onPointerDownCapture={activa.imagen_url ? huecoFicha : undefined}
          style={{
            position: 'relative', left: 'auto', top: 'auto',
            width: activa.imagen_url ? 'auto' : activa.tam,
            height: activa.imagen_url ? 'auto' : activa.tam,
            transform: 'none',
            background: activa.imagen_url ? 'transparent' : undefined,
            borderRadius: activa.imagen_url ? 0 : undefined,
            opacity: bloqueado && !editable ? 0.55 : 1,
          }}
          {...anclaProps}
        >
          <FichaContenido f={activa} />
        </button>
      </div>
    </div>
  );
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
  /** % del radio automático. */
  apertura?: number;
  /** Arco en grados (hacia arriba). */
  arco?: number;
  /** Definido solo en el slot 3×3/5×3. */
  orden?: FichasCfg['abanicoOrden'];
  sale?: FichasCfg['abanicoSale'];
}

/**
 * Solo se ve la ficha activa (la que coincide con la apuesta). Tocarla
 * despliega el resto en abanico alrededor; elegir una la reemplaza y
 * todo se repliega solo. Pensado para no ocupar una franja fija de la
 * pantalla con todas las fichas a la vez.
 */
function Abanico({ fichas, apuesta, onElegir, bloqueado, ancho = 320, editable, onMover, host, x, y, apertura = 100, arco = 136, orden, sale }: AbanicoProps) {
  const [abierto, setAbierto] = useState(false);
  const dragRef = useRef<{ movido: boolean } | null>(null);

  if (!fichas.length) return null;
  const activa = fichas.find((f) => Math.round(f.valor) === Math.round(apuesta)) ?? fichas[0];
  const radioAuto = Math.max(64, Math.min(112, ancho * 0.32));
  const radio = radioAuto * (Math.max(50, Math.min(220, apertura)) / 100);
  const arcoDeg = Math.max(70, Math.min(180, arco));
  // Sin orden: lista de siempre, y la activa se saca del arco (el hueco se cierra).
  // Con orden (slot): el arco se arma con todas y la activa deja su sitio vacío.
  const resto = orden
    ? (() => {
        const puestos = puestosAbanico(fichas, apuesta, orden) as { ficha: Ficha; indice: number; total: number }[];
        const visibles = puestos.map((p) => p.indice);
        return puestos.map((p) => ({
          f: p.ficha,
          k: p.indice,
          n: p.total,
          delay: demoraAbanico(p.indice, visibles, p.total, sale ?? 'centro') as number,
        }));
      })()
    : fichas.filter((f) => f !== activa).map((f, k, arr) => ({ f, k, n: arr.length, delay: k * 26 }));

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
    <div style={raiz}>
      <style>{`
        .gw-abanico-velo { position:fixed; inset:0; background:rgba(5,6,10,.5); z-index:11; }
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
        .gw-abanico-ficha.con-img {
          background:transparent; box-shadow:none; border-radius:0; width:auto; height:auto;
        }
        .gw-abanico-val {
          position:absolute; bottom:-14px; left:50%; transform:translateX(-50%);
          font-family:var(--mono, monospace); font-size:10px; font-weight:600; color:var(--text-dim,#8a93a1);
          background:rgba(0,0,0,.55); padding:1px 6px; border-radius:5px; white-space:nowrap;
        }
        @media (prefers-reduced-motion: reduce){ .gw-abanico-ficha { transition:none } }
      `}</style>

      {abierto && <div className="gw-abanico-velo" onClick={() => setAbierto(false)} />}

      <button
        type="button"
        className={`gw-abanico-ficha gw-abanico-principal${activa.imagen_url ? ' con-img' : ''}`}
        aria-haspopup="true" aria-expanded={abierto}
        aria-label={`Ficha activa: ${fmt(activa.valor)}. Tocar para elegir otra.`}
        disabled={bloqueado && !editable}
        onPointerDownCapture={activa.imagen_url ? huecoFicha : undefined}
        style={{
          width: activa.imagen_url ? 'auto' : activa.tam,
          height: activa.imagen_url ? 'auto' : activa.tam,
          transform: 'translate(-50%,-50%)',
          background: activa.imagen_url ? 'transparent' : undefined,
          borderRadius: activa.imagen_url ? 0 : undefined,
          opacity: bloqueado && !editable ? 0.55 : 1,
        }}
        {...anclaProps}
      >
        <FichaContenido f={activa} />
      </button>

      {resto.map(({ f, k, n, delay }) => {
        const start = 90 + arcoDeg / 2;
        const end = 90 - arcoDeg / 2;
        const ang = n === 1 ? 90 : start + (end - start) * (k / Math.max(1, n - 1));
        const rad = (ang * Math.PI) / 180;
        const tx = Math.cos(rad) * radio, ty = -Math.sin(rad) * radio;
        return (
          <button
            key={`${f.valor}-${k}`}
            type="button"
            className={`gw-abanico-ficha gw-abanico-secundaria${f.imagen_url ? ' con-img' : ''}`}
            aria-label={fmt(f.valor)}
            onPointerDownCapture={f.imagen_url ? huecoFicha : undefined}
            style={{
              width: f.imagen_url ? 'auto' : f.tam,
              height: f.imagen_url ? 'auto' : f.tam,
              background: f.imagen_url ? 'transparent' : undefined,
              borderRadius: f.imagen_url ? 0 : undefined,
              transform: abierto
                ? `translate(calc(-50% + ${tx.toFixed(1)}px), calc(-50% + ${ty.toFixed(1)}px)) scale(1)`
                : 'translate(-50%,-50%) scale(.3)',
              opacity: abierto ? 1 : 0,
              pointerEvents: abierto ? 'auto' : 'none',
              transitionDelay: abierto ? `${delay}ms` : '0ms',
            }}
            onClick={() => elegir(f.valor)}
          >
            <FichaContenido f={f} />
          </button>
        );
      })}
    </div>
  );
}

function ladoFicha(f: Ficha) {
  return Math.max(8, Math.round(f.tam * f.imgTam / 100));
}

function huecoFicha(e: React.PointerEvent) {
  const img = (e.currentTarget as HTMLElement).querySelector('img');
  if (img && alphaEn(img, e.clientX, e.clientY) === false) {
    e.preventDefault();
    e.stopPropagation();
  }
}

/** PNG con su forma. El lado más largo es el tamaño de la ficha. */
function FichaFoto({ url, lado }: { url: string; lado: number }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { if (ref.current) encajarImagen(ref.current, lado); }, [url, lado]);
  return <img ref={ref} className="gw-ficha-foto jg-silueta" alt="" draggable={false} src={url} />;
}

function FichaContenido({ f }: { f: Ficha }) {
  if (f.imagen_url) {
    return (
      <>
        <FichaFoto url={f.imagen_url} lado={ladoFicha(f)} />
        <span className="gw-abanico-val">{fmt(f.valor)}</span>
      </>
    );
  }
  return (
    <>
      <span
        className="gw-abanico-img"
        style={{
          width: `${f.imgTam}%`, height: `${f.imgTam}%`,
          fontSize: Math.max(9, f.tam * f.imgTam / 100 * 0.34),
          background: 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))',
        }}
      >
        {fichaCorto(f.valor)}
      </span>
      <span className="gw-abanico-val">{fmt(f.valor)}</span>
    </>
  );
}
