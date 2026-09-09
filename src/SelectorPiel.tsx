import type { ReactNode } from 'react';

/** Una piel en el selector: id, nombre y una o más muestras de color. */
export interface OpcionPiel {
  id: string;
  nombre: string;
  colores: string[];
}

const HINT =
  'Fondo, colores y tipografía. Clásico = hereda del panel. No toca la matemática ni el RTP.';

/**
 * Grilla de pieles. Un solo control para todos los motores: Crash, Torre,
 * Mines, Limbo, etc. dejan de copiar el mismo markup.
 */
export function SelectorPiel({ valor, opciones, onSet, compact }: {
  valor?: string | null;
  opciones: OpcionPiel[];
  onSet: (id: string) => void;
  compact?: boolean;
}) {
  const actual = valor || 'clasico';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 78 : 118}px, 1fr))`,
      gap: compact ? 6 : 8,
    }}>
      {opciones.map((t) => {
        const on = actual === t.id;
        const colores = t.colores.length ? t.colores : ['#6b8afd'];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSet(t.id)}
            style={{
              display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6,
              padding: compact ? 6 : 8, textAlign: 'left',
              borderRadius: compact ? 8 : 10, cursor: 'pointer',
              border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              background: on ? 'var(--accent-soft)' : 'var(--surface-alt)',
              fontSize: compact ? 11 : undefined,
            }}
          >
            <span style={{
              display: 'flex', height: compact ? 14 : 18,
              borderRadius: compact ? 4 : 5, overflow: 'hidden',
            }}>
              {colores.map((c, i) => (
                <span key={i} style={{ flex: 1, background: c }} />
              ))}
            </span>
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700 }}>{t.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Card del ensamblador: título + hint + grilla. */
export function CardPiel({ valor, opciones, onSet, hint, children }: {
  valor?: string | null;
  opciones: OpcionPiel[];
  onSet: (id: string) => void;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <strong style={{ fontSize: 15 }}>Tema visual</strong>
      <p className="hint" style={{ marginBottom: 12 }}>{hint || HINT}</p>
      <SelectorPiel valor={valor} opciones={opciones} onSet={onSet} />
      {children}
    </div>
  );
}
