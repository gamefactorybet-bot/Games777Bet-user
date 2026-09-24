import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

/** Aviso de saldo, dentro del escenario. Reemplaza el alert del navegador. */
export function AvisoSaldo({ host, saldo, apuesta, onCerrar }: {
  host: HTMLElement;
  saldo: number;
  apuesta: number;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  return createPortal(
    <div className="jg-aviso" role="dialog" aria-modal="true" aria-labelledby="jg-aviso-titulo" onClick={onCerrar}>
      <style>{`
        .jg-aviso {
          position: absolute; inset: 0; z-index: 40;
          display: flex; align-items: center; justify-content: center;
          padding: 28px; background: rgba(4, 5, 10, .62);
          animation: jg-aviso-fondo .22s ease;
        }
        .jg-aviso-caja {
          width: min(300px, 100%);
          padding: 22px 20px 16px;
          border-radius: 18px;
          background:
            radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 55%),
            var(--surface, #14171d);
          border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border, #2a3140));
          box-shadow: 0 22px 50px -18px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.04) inset;
          text-align: center;
          animation: jg-aviso-caja .28s cubic-bezier(.2,.8,.2,1);
        }
        .jg-aviso-ficha {
          width: 54px; height: 54px; margin: 0 auto 12px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background:
            radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--accent) 70%, white), var(--accent, #6b8afd) 42%, #1a1208 43%, #3a2a12 70%, #120e08);
          box-shadow: 0 0 0 3px rgba(0,0,0,.35), 0 8px 18px -8px rgba(0,0,0,.7), inset 0 0 0 2px rgba(255,220,140,.35);
          font-family: var(--mono, monospace); font-weight: 800; font-size: 13px; color: #fff8e8;
        }
        .jg-aviso h2 {
          margin: 0 0 8px; font-size: 18px; letter-spacing: .01em;
        }
        .jg-aviso p { margin: 0; font-size: 13px; line-height: 1.45; color: var(--text-dim, #9aa3b2); }
        .jg-aviso-montos {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
          margin: 14px 0 16px;
        }
        .jg-aviso-montos div {
          padding: 8px 6px 7px; border-radius: 12px;
          background: rgba(0,0,0,.28);
          border: 1px solid var(--border-soft, rgba(255,255,255,.08));
        }
        .jg-aviso-montos span {
          display: block; font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
          color: var(--text-dim, #9aa3b2);
        }
        .jg-aviso-montos b {
          display: block; margin-top: 2px;
          font-family: var(--mono, monospace); font-size: 14px; font-weight: 700; color: var(--text, #e7eaef);
        }
        .jg-aviso-montos .corto b { color: #f0b4b4; }
        .jg-aviso button {
          width: 100%; padding: 11px 14px; border-radius: 12px;
          background: var(--accent, #6b8afd); color: var(--accent-text, #fff);
          border: 1px solid var(--accent, #6b8afd); font-weight: 700;
        }
        @keyframes jg-aviso-fondo { from { opacity: 0; } to { opacity: 1; } }
        @keyframes jg-aviso-caja { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .jg-aviso, .jg-aviso-caja { animation: none; }
        }
      `}</style>
      <div className="jg-aviso-caja" onClick={(e) => e.stopPropagation()}>
        <div className="jg-aviso-ficha" aria-hidden="true" />
        <h2 id="jg-aviso-titulo">Se acabó el saldo</h2>
        <p>Esta apuesta pide más de lo que te queda. Elegí una ficha más chica para seguir.</p>
        <div className="jg-aviso-montos">
          <div>
            <span>Te queda</span>
            <b>{fmt(saldo)}</b>
          </div>
          <div className="corto">
            <span>Esta apuesta</span>
            <b>{fmt(apuesta)}</b>
          </div>
        </div>
        <button type="button" onClick={onCerrar}>Seguir</button>
      </div>
    </div>,
    host,
  );
}
