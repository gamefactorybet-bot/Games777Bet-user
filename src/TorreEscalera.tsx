import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cargarFuenteTorre } from './juego/torre-temas.ts';
import { forma, multPiso } from './juego/torre.ts';
import type { TemaTorre } from './juego/torre-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoTorre, Juego, PosControlesTorre, TorreCfg } from './types.ts';

const mx = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

interface TorreEscaleraProps {
  escenario: Escenario;
  juego: Juego;
  cfg: TorreCfg;
  tema: TemaTorre;
  pos: PosControlesTorre;
  estado: EstadoTorre;
  /** Tocar una casilla del piso actual. */
  onElegir: (piso: number, casilla: number) => void;
}

// La torre de casillas: se sube piso por piso. El piso activo se
// ilumina; los ya subidos muestran la casilla que se eligió, y al
// perder/retirar se revelan todas las trampas.
export function TorreEscalera({ escenario, juego, cfg, tema, pos, estado, onElegir }: TorreEscaleraProps) {
  const fondoPantalla = (juego.fondo_url as string) || cfg.fondoUrl || null;
  const f = forma(cfg);

  useEffect(() => {
    cargarFuenteTorre(tema);
    const el = escenario.el;
    const prevBg = el.style.background;
    if (tema.stageBg && !fondoPantalla) el.style.background = tema.stageBg;
    const claves = Object.keys(tema.vars);
    for (const k of claves) el.style.setProperty(k, tema.vars[k]);
    if (tema.font) el.style.setProperty('--to-body', tema.font.family);
    return () => {
      el.style.background = prevBg;
      for (const k of claves) el.style.removeProperty(k);
      el.style.removeProperty('--to-body');
    };
  }, [tema, escenario, fondoPantalla]);

  const revelar = estado.fase === 'perdida' || estado.fase === 'retirada';
  const pickPorPiso = new Map(estado.picks.map((p) => [p.piso, p.casilla]));
  const T = pos.torre;

  const bgCasilla = (url: string | null, fallback: string) =>
    url ? `center/cover no-repeat url("${url}")` : fallback;

  return createPortal(
    <>
      {fondoPantalla && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `center/cover no-repeat url("${fondoPantalla}")`,
        }} />
      )}
      {tema.deco && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.7 }}
          dangerouslySetInnerHTML={{ __html: tema.deco }} />
      )}

      <style>{`
        .to-host{ position:absolute; transform:translate(-50%,-50%); z-index:9; container-type:inline-size;
          display:flex; flex-direction:column; gap:5px; }
        .to-host.con-fondo{ padding:10px; border-radius:12px; }
        .to-piso{ display:flex; align-items:center; gap:2cqw; }
        .to-piso .to-n{ width:5cqw; text-align:right; font-family:var(--to-font-display,var(--to-body,monospace));
          font-size:3.4cqw; color:var(--text-dim,#8b95a6); flex-shrink:0; }
        .to-piso .to-tiles{ flex:1; display:grid; gap:2cqw; }
        .to-cell{ min-width:0; min-height:0; aspect-ratio:2.5; border:1px solid var(--border-soft,#222836);
          border-radius:3cqw; background:rgba(255,255,255,.03); display:grid; place-items:center;
          font-size:5cqw; position:relative; transition:transform .12s, border-color .15s, background .15s, box-shadow .2s;
          -webkit-tap-highlight-color:transparent; }
        .to-piso.activa .to-cell{ cursor:pointer; background:var(--raised,#232b3a); border-color:var(--accent,#6b8afd); }
        .to-piso.activa .to-cell:hover{ transform:translateY(-1px); background:var(--accent-soft,rgba(107,138,253,.16)); }
        .to-piso.activa{ filter:drop-shadow(0 0 8px var(--accent-soft,rgba(107,138,253,.3))); }
        .to-piso.futura{ opacity:.5 }
        .to-cell.safe{ background:color-mix(in srgb, var(--to-safe,#37d08b) 22%, transparent); border-color:var(--to-safe,#37d08b); }
        .to-cell.safe.img{ background:var(--to-safe-img); }
        .to-cell.trap{ background:color-mix(in srgb, var(--danger,#e5686b) 22%, transparent); border-color:var(--danger,#e5686b); }
        .to-cell.trap.img{ background:var(--to-trap-img); }
        .to-cell.trap.fatal{ animation:to-shake .4s; box-shadow:0 0 14px -2px var(--danger,#e5686b); }
        .to-cell.ghost{ opacity:.5 }
        @keyframes to-shake{ 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        .to-piso .to-next{ width:14cqw; flex-shrink:0; font-family:var(--to-font-display,monospace);
          font-size:3.2cqw; color:var(--to-gold,#e6b354); }
      `}</style>

      <div
        className={`to-host${cfg.fondoTorreUrl ? ' con-fondo' : ''}`}
        style={{
          left: `${T.x}%`, top: `${T.y}%`, width: T.ancho,
          ['--to-safe' as string]: tema.safe, ['--to-gold' as string]: tema.gold,
          ['--to-safe-img' as string]: bgCasilla(cfg.casillaSeguraUrl, tema.safe),
          ['--to-trap-img' as string]: bgCasilla(cfg.casillaTrampaUrl, 'var(--danger, #e5686b)'),
          background: cfg.fondoTorreUrl ? `center/cover no-repeat url("${cfg.fondoTorreUrl}")` : undefined,
        }}
      >
        {Array.from({ length: cfg.pisos }, (_, i) => cfg.pisos - i).map((piso) => {
          const esActiva = piso === estado.piso && (estado.fase === 'idle' || estado.fase === 'jugando');
          const esFutura = piso > estado.piso || (revelar && piso > estado.piso);
          const pick = pickPorPiso.get(piso);
          const trampasPiso = revelar && estado.trampas ? estado.trampas[piso - 1] || [] : [];
          const fatal = estado.fase === 'perdida' && piso === estado.piso ? pick : -1;
          return (
            <div key={piso} className={`to-piso ${esActiva ? 'activa' : ''} ${esFutura ? 'futura' : ''}`}>
              <span className="to-n">{piso}</span>
              <div className="to-tiles" style={{ gridTemplateColumns: `repeat(${f.cols},1fr)` }}>
                {Array.from({ length: f.cols }, (_, c) => {
                  let cls = 'to-cell';
                  let content: string | null = null;
                  if (revelar && trampasPiso.includes(c)) {
                    cls += ' trap' + (cfg.casillaTrampaUrl ? ' img' : '') + (c === fatal ? ' fatal' : '');
                    if (!cfg.casillaTrampaUrl) content = '💀';
                  } else if (pick != null && c === pick) {
                    cls += ' safe' + (cfg.casillaSeguraUrl ? ' img' : '');
                    if (!cfg.casillaSeguraUrl) content = '💎';
                  } else if (pick != null || (revelar && piso <= estado.piso)) {
                    cls += ' ghost';
                  } else if (esActiva) {
                    // clickable, casilla tapada
                  } else {
                    cls += ' ghost';
                  }
                  return (
                    <button
                      key={c}
                      className={cls}
                      disabled={!esActiva}
                      onClick={() => esActiva && onElegir(piso, c)}
                      style={cfg.casillaTapadaUrl && !cls.includes('safe') && !cls.includes('trap')
                        ? { background: `center/cover no-repeat url("${cfg.casillaTapadaUrl}")` }
                        : undefined}
                    >{content}</button>
                  );
                })}
              </div>
              <span className="to-next">{esActiva ? `→${mx(multPiso(cfg, piso))}×` : ''}</span>
            </div>
          );
        })}
      </div>
    </>,
    escenario.el,
  );
}
