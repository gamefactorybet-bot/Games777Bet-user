import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cargarFuenteKeno } from './juego/keno-temas.ts';
import { columnasKeno } from './juego/keno.ts';
import type { TemaKeno } from './juego/keno-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoKeno, Juego, KenoCfg, PosControlesKeno } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

interface KenoTableroProps {
  escenario: Escenario;
  juego: Juego;
  cfg: KenoCfg;
  tema: TemaKeno;
  pos: PosControlesKeno;
  estado: EstadoKeno;
  /** Tocar un número (marcar / desmarcar). */
  onToggle: (n: number) => void;
  /** Monto de demo para ubicar el cartel de la ganancia desde ⚙ Ajustar. */
  premioDemo?: number | null;
}

// El tablero de números del Keno: la grilla que el jugador marca y
// donde después se prenden los aciertos. Más el cartel de la ganancia,
// que vive en el escenario para poder ubicarlo en cualquier lado.
export function KenoTablero({ escenario, juego, cfg, tema, pos, estado, onToggle, premioDemo }: KenoTableroProps) {
  const fondoPantalla = (juego.fondo_url as string) || null;
  const cols = columnasKeno(cfg.tablero);
  const filas = Math.ceil(cfg.tablero / cols);

  // ---- tema ----
  useEffect(() => {
    cargarFuenteKeno(tema);
    const el = escenario.el;
    const prevBg = el.style.background;
    if (tema.stageBg && !fondoPantalla) el.style.background = tema.stageBg;
    const claves = Object.keys(tema.vars);
    for (const k of claves) el.style.setProperty(k, tema.vars[k]);
    if (tema.font) el.style.setProperty('--kn-body', tema.font.family);
    return () => {
      el.style.background = prevBg;
      for (const k of claves) el.style.removeProperty(k);
      el.style.removeProperty('--kn-body');
    };
  }, [tema, escenario, fondoPantalla]);

  // ---- contador de la ganancia ----
  const [contador, setContador] = useState(0);
  const rafRef = useRef(0);
  const res = estado.res;
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!res || res.mult <= 0) { setContador(0); return; }
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : Number((juego.contador_ms as number) ?? 900);
    if (dur <= 0) { setContador(res.amount); return; }
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / dur);
      setContador(res.amount * (1 - Math.pow(1 - t, 3)));
      if (t < 1) rafRef.current = requestAnimationFrame(paso);
      else setContador(res.amount);
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafRef.current);
  }, [res, juego.contador_ms]);

  const drawnSet = new Set(estado.drawn);
  const pickedSet = new Set(estado.picked);
  const T = pos.tablero;
  const P = pos.premio;

  return createPortal(
    <>
      {fondoPantalla && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `center/cover no-repeat url("${fondoPantalla}")`,
        }} />
      )}

      <style>{`
        .kn-host{ position:absolute; transform:translate(-50%,-50%); z-index:9; container-type:inline-size; }
        .kn-host .kn-grid{ display:grid; gap:2.6cqw; width:100%; }
        .kn-cell{
          min-width:0; min-height:0; border:1px solid var(--border,#2a3242); border-radius:24%;
          background:var(--surface-alt,rgba(255,255,255,.05)); cursor:pointer; position:relative;
          font-family:var(--kn-font-display,var(--kn-body,monospace)); color:var(--text-dim,#8b95a6);
          display:grid; place-items:center; font-size:min(5cqw, 17px); font-weight:600;
          transition:transform .1s, border-color .15s, background .15s; -webkit-tap-highlight-color:transparent;
        }
        .kn-cell:disabled{ cursor:default }
        .kn-cell.pick{ background:var(--accent-soft,rgba(107,138,253,.16)); border-color:var(--accent,#6b8afd); color:var(--accent,#6b8afd); font-weight:800 }
        .kn-cell.drawn{ background:rgba(230,179,84,.16); border-color:var(--kn-bola,#e6b354); color:var(--kn-bola,#e6b354) }
        .kn-cell.hit{ background:rgba(55,208,139,.2); border-color:var(--kn-acierto,#37d08b); color:var(--kn-acierto,#37d08b); font-weight:800; transform:scale(1.05) }
        .kn-cell.miss{ border-color:var(--danger,#e5686b); color:var(--danger,#e5686b) }
        .kn-cell.miss::after{ content:""; position:absolute; inset:14%; border-radius:4px;
          background:linear-gradient(135deg,transparent 44%,var(--danger,#e5686b) 45%,var(--danger,#e5686b) 55%,transparent 56%); opacity:.5 }
        .kn-premio{ position:absolute; transform:translate(-50%,-50%); z-index:16; pointer-events:none; }
        .kn-premio-in{
          display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center;
          background:rgba(0,0,0,.5); padding:10px 22px; border-radius:16px;
          border:1px solid color-mix(in srgb, var(--kn-acierto,#37d08b) 55%, transparent);
          animation:kn-premio-pop .38s cubic-bezier(.2,1.3,.4,1);
        }
        .kn-premio .kn-monto{
          font-family:var(--kn-font-display,var(--kn-body,inherit)); font-weight:800; font-size:34px; line-height:1;
          color:var(--kn-acierto,#37d08b); font-variant-numeric:tabular-nums; text-shadow:0 2px 12px rgba(0,0,0,.55);
        }
        .kn-premio .kn-sub{ font-family:var(--kn-body,monospace); font-size:12px; font-weight:600;
          color:color-mix(in srgb, var(--kn-acierto,#37d08b) 80%, #fff); opacity:.85; }
        @keyframes kn-premio-pop{ 0%{transform:scale(.7);opacity:0} 100%{transform:scale(1);opacity:1} }
        @media (prefers-reduced-motion: reduce){ .kn-premio-in{ animation:none } }
      `}</style>

      <div
        className="kn-host"
        style={{
          left: `${T.x}%`, top: `${T.y}%`, width: T.ancho,
          ['--kn-bola' as string]: tema.bola, ['--kn-acierto' as string]: tema.acierto,
        }}
      >
        <div className="kn-grid" style={{
          gridTemplateColumns: `repeat(${cols},1fr)`,
          gridTemplateRows: `repeat(${filas},1fr)`,
          aspectRatio: `${cols} / ${filas}`,
        }}>
          {Array.from({ length: cfg.tablero }, (_, i) => i + 1).map((n) => {
            let cls = 'kn-cell';
            if (estado.res) {
              if (pickedSet.has(n) && drawnSet.has(n)) cls += ' hit';
              else if (pickedSet.has(n)) cls += ' miss';
              else if (drawnSet.has(n)) cls += ' drawn';
            } else {
              if (pickedSet.has(n)) cls += ' pick';
              if (drawnSet.has(n)) cls += ' drawn';
            }
            return (
              <button key={n} className={cls} disabled={estado.fase !== 'idle'} onClick={() => onToggle(n)}>{n}</button>
            );
          })}
        </div>
      </div>

      {res && res.mult > 0 && (
        <div className="kn-premio" style={{ left: `${P.x}%`, top: `${P.y}%`, ['--kn-acierto' as string]: tema.acierto }}>
          <div className="kn-premio-in">
            <strong className="kn-monto">+{fmt(contador)}</strong>
            <span className="kn-sub">{res.aciertos} aciertos · ×{res.mult}</span>
          </div>
        </div>
      )}

      {premioDemo != null && premioDemo > 0 && !res && (
        <div className="kn-premio" style={{ left: `${P.x}%`, top: `${P.y}%`, ['--kn-acierto' as string]: tema.acierto }}>
          <div className="kn-premio-in">
            <strong className="kn-monto">+{fmt(premioDemo)}</strong>
            <span className="kn-sub">4 aciertos · ×12</span>
          </div>
        </div>
      )}
    </>,
    escenario.el,
  );
}
