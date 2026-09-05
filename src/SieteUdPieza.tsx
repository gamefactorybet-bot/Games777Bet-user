import { useRef, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from 'react';
import type { TipoPieza } from './juego/sieteud.ts';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export type PiezaId = string;
export interface ValPieza { x: number; y: number; escala: number; w?: number; h?: number }
export type PatchPieza = Partial<{ x: number; y: number; w: number; h: number; escala: number }>;

/**
 * Envoltorio posicionable de una pieza de la escena. En modo edición se
 * arrastra para moverla y tiene un tirador en la esquina para el tamaño
 * (ancho/alto en cajas, ancho en 'ancho', escala en 'punto').
 */
export function Pieza<ID extends string = string>({
  id, tipo, v, seleccion, onSelect, onPatch, onPatchFin, stageRef, zBase = 4, children,
  bloqueada = false, snap = true, oculta = false,
}: {
  id: ID;
  tipo: TipoPieza;
  v: ValPieza;
  /** id de la pieza seleccionada, o null si no se está editando. */
  seleccion: ID | null;
  onSelect?: (id: ID) => void;
  /** Se llama en cada movimiento (actualiza posición y guarda, sin historial). */
  onPatch?: (id: ID, patch: PatchPieza) => void;
  /** Se llama una sola vez al soltar, con la posición final (registra deshacer). */
  onPatchFin?: (id: ID, patch: PatchPieza) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  zBase?: number;
  bloqueada?: boolean;
  snap?: boolean;
  /** Oculta visualmente (display:none) sin desmontar — algunos hijos (ej. el
   * canvas de la mesa) llevan un motor que no se reconecta si se remonta. */
  oculta?: boolean;
  children: ReactNode;
}) {
  const modo = useRef<'' | 'move' | 'resize'>('');
  const inicio = useRef({ mx: 0, my: 0, w: 0, h: 0, escala: 0, offx: 0, offy: 0 });
  const rectCache = useRef<DOMRect | null>(null);
  const ultimoPatch = useRef<PatchPieza | null>(null);
  const editando = seleccion !== null;
  const sel = seleccion === id;
  const esCaja = tipo === 'caja';
  const esAncho = tipo === 'ancho';

  const rect = () => stageRef.current?.getBoundingClientRect() ?? null;

  const empezar = (m: 'move' | 'resize') => (e: RPointerEvent) => {
    if (!editando || bloqueada) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect?.(id);
    const r = rect();
    rectCache.current = r;
    const pxp = r && m === 'move' ? ((e.clientX - r.left) / r.width) * 100 : v.x;
    const pyp = r && m === 'move' ? ((e.clientY - r.top) / r.height) * 100 : v.y;
    modo.current = m;
    ultimoPatch.current = null;
    inicio.current = { mx: e.clientX, my: e.clientY, w: v.w ?? 0, h: v.h ?? 0, escala: v.escala, offx: pxp - v.x, offy: pyp - v.y };
  };

  const mover = (e: RPointerEvent) => {
    if (!editando || !modo.current) return;
    const r = rectCache.current; if (!r) return;
    const dxp = ((e.clientX - inicio.current.mx) / r.width) * 100;
    const dyp = ((e.clientY - inicio.current.my) / r.height) * 100;
    const red = (n: number) => Math.round(n * 10) / 10;
    const ajustar = (n: number) => snap ? Math.round(n / 2.5) * 2.5 : red(n);
    let patch: PatchPieza;
    if (modo.current === 'move') {
      patch = {
        x: ajustar(clamp(((e.clientX - r.left) / r.width) * 100 - inicio.current.offx, 2, 98)),
        y: ajustar(clamp(((e.clientY - r.top) / r.height) * 100 - inicio.current.offy, 2, 98)),
      };
    } else if (esCaja) {
      patch = {
        w: ajustar(clamp(inicio.current.w + dxp * 2, 20, 100)),
        h: ajustar(clamp(inicio.current.h + dyp * 2, 8, 80)),
      };
    } else if (esAncho) {
      patch = { w: ajustar(clamp(inicio.current.w + dxp * 2, 20, 100)) };
    } else {
      const f = 1 + (dxp + dyp) / 60;
      const paso = snap ? 0.1 : 0.05;
      patch = { escala: clamp(Math.round((inicio.current.escala * f) / paso) * paso, 0.5, 2.2) };
    }
    ultimoPatch.current = patch;
    onPatch?.(id, patch);
  };
  const moverEnHandle = (e: RPointerEvent) => { e.stopPropagation(); mover(e); };
  const soltar = () => {
    modo.current = '';
    rectCache.current = null;
    if (ultimoPatch.current) { onPatchFin?.(id, ultimoPatch.current); ultimoPatch.current = null; }
  };

  const escala = esCaja ? 1 : v.escala;
  const style: CSSProperties = {
    position: 'absolute', left: `${v.x}%`, top: `${v.y}%`,
    transform: `translate(-50%,-50%) scale(${escala})`,
    width: esCaja || esAncho ? `${v.w}%` : undefined,
    height: esCaja ? `${v.h}%` : undefined,
    display: oculta ? 'none' : esCaja || esAncho ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center',
    touchAction: editando ? 'none' : undefined,
    cursor: editando ? (bloqueada ? 'not-allowed' : 'move') : undefined,
    outline: sel ? '2px dashed var(--accent)' : editando ? '1px dashed rgba(255,255,255,.2)' : 'none',
    outlineOffset: 3, borderRadius: 6,
    zIndex: sel ? zBase + 4 : zBase,
  };

  return (
    <div
      style={style}
      onPointerDown={(e) => { if (editando) onSelect?.(id); empezar('move')(e); }} onPointerMove={mover}
      onPointerUp={soltar} onPointerCancel={soltar}
    >
      {editando && (
        <span style={{
          position: 'absolute', top: -16, left: 0, fontFamily: 'var(--in-num, monospace)', fontSize: 9,
          color: '#fff', background: sel ? 'var(--accent)' : 'rgba(0,0,0,.55)',
          padding: '1px 5px', borderRadius: 5, whiteSpace: 'nowrap',
        }}>{id}</span>
      )}
      {editando && sel && !bloqueada && (
        <span
          onPointerDown={empezar('resize')} onPointerMove={moverEnHandle}
          onPointerUp={soltar} onPointerCancel={soltar}
          title={esCaja ? 'Ancho y alto' : esAncho ? 'Ancho' : 'Tamaño'}
          style={{
            position: 'absolute', right: -8, bottom: -8, width: 16, height: 16, borderRadius: 4,
            background: 'var(--accent)', border: '2px solid var(--surface, #fff)', cursor: 'nwse-resize', zIndex: 9,
          }}
        />
      )}
      {children}
    </div>
  );
}
