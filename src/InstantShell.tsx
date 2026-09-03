import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PantallaCarga } from './PantallaCarga.tsx';
import { cargarFuenteInstant, type TemaInstant } from './juego/instant-temas.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

interface InstantShellProps {
  nombre: string;
  fondoUrl: string | null;
  tema: TemaInstant;
  mostrarNombre?: boolean;
  /** true = vista previa (overlay con botón cerrar y "plata de mentira"). */
  demo?: boolean;
  onCerrar?: () => void;
  /** solo modo real: pantalla de carga. */
  cargando?: boolean;
  progreso?: { hechos: number; total: number };
  cargaImagen?: string | null;
  children: ReactNode;
}

// Marco común de los juegos instantáneos (Limbo, Dice): fondo + tema +
// nombre + pantalla de carga. El juego en sí va como children.
export function InstantShell({
  nombre, fondoUrl, tema, mostrarNombre = true, demo, onCerrar,
  cargando, progreso, cargaImagen, children,
}: InstantShellProps) {
  useEffect(() => { cargarFuenteInstant(tema); }, [tema]);

  const vars: Record<string, string> = { ...tema.vars };
  if (tema.font) vars['--in-body'] = tema.font.family;

  const fondo = fondoUrl
    ? `center/cover no-repeat url("${fondoUrl}")`
    : tema.stageBg || 'var(--bg)';

  const cuerpo = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: demo ? 100 : 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 22, padding: '24px 16px', overflow: 'hidden',
        background: fondo, fontFamily: 'var(--in-body, inherit)',
        ...(vars as object),
      }}
    >
      {demo && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="hint">plata de mentira</span>
          <button onClick={onCerrar}>✕ Cerrar prueba</button>
        </div>
      )}

      {mostrarNombre && nombre && (
        <p style={{
          position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', margin: 0,
          fontSize: 13, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-dim)',
        }}>{nombre}</p>
      )}

      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {children}
      </div>

      {!demo && cargando && (
        <PantallaCarga
          imagen={cargaImagen ?? null}
          nombre={nombre}
          hechos={progreso?.hechos ?? 0}
          total={progreso?.total ?? 1}
          visible
        />
      )}
    </div>
  );

  return demo ? createPortal(cuerpo, document.body) : cuerpo;
}

// ---- Controles compartidos ----

export function ApuestaControl({ apuesta, minBet, maxBet, paso, ocupado, onApuesta }: {
  apuesta: number; minBet: number; maxBet: number; paso: number; ocupado: boolean;
  onApuesta: (n: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button disabled={ocupado} onClick={() => onApuesta(Math.max(minBet, apuesta - paso))} style={stepBtn}>−</button>
      <span style={{ minWidth: 100, textAlign: 'center' }}>
        <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
        <strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{fmt(apuesta)}</strong>
      </span>
      <button disabled={ocupado} onClick={() => onApuesta(Math.min(maxBet, apuesta + paso))} style={stepBtn}>+</button>
    </div>
  );
}

export function BotonJugar({ texto, disabled, onClick }: { texto: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', maxWidth: 420, padding: '14px 0', border: 0, borderRadius: 12, cursor: 'pointer',
        fontFamily: 'var(--in-num, var(--in-body, inherit))', fontWeight: 800, letterSpacing: '.03em', fontSize: 16,
        background: 'var(--accent)', color: 'var(--accent-text, #fff)',
        boxShadow: '0 10px 26px -8px rgba(0,0,0,.35)', opacity: disabled ? 0.55 : 1,
        transition: 'opacity .15s',
      }}>
      {texto}
    </button>
  );
}

export function Saldo({ valor }: { valor: number }) {
  return (
    <div className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>
      Saldo <strong style={{ color: 'var(--text)' }}>{fmt(valor)}</strong>
    </div>
  );
}

export function Historial({ items }: { items: { texto: string; gano: boolean }[] }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', minHeight: 22 }}>
      {items.map((it, i) => (
        <span key={i} style={{
          fontFamily: 'var(--in-num, var(--in-body, monospace))', fontSize: 11, fontWeight: 700,
          padding: '2px 7px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
          background: it.gano ? 'var(--accent-soft)' : 'var(--surface-alt)',
          color: it.gano ? 'var(--ok)' : 'var(--text-dim)',
        }}>{it.texto}</span>
      ))}
    </div>
  );
}

const stepBtn = {
  width: 40, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-alt)',
  color: 'var(--text)', fontSize: 20, fontWeight: 700, cursor: 'pointer',
} as const;
