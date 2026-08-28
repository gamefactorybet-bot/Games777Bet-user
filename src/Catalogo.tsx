import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import { Preview } from './Preview.tsx';
import type { Juego, Simbolo, Sonido, Efecto } from './types.ts';

/**
 * Catálogo: los juegos marcados "listo", con su portada — para verlos
 * como se van a ver en una lista de verdad, y probarlos desde ahí
 * mismo, no solo desde el editor de cada uno.
 */
export function Catalogo() {
  const [juegos, setJuegos] = useState<Juego[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<null | { juego: Juego; simbolos: Simbolo[]; sonidos: Sonido[]; efectos: Efecto[] }>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('juegos')
        .select('*')
        .eq('estado', 'listo')
        .order('nombre');

      setCargando(false);
      if (error) { setError(error.message); return; }
      setJuegos((data as Juego[]) || []);
    })();
  }, []);

  const abrir = async (juego: Juego) => {
    const [{ data: simbolos }, { data: sonidos }, { data: efectos }] = await Promise.all([
      supabase.from('simbolos').select('*').eq('juego_id', juego.id).order('orden'),
      supabase.from('sonidos').select('*').eq('juego_id', juego.id),
      supabase.from('efectos').select('*').eq('juego_id', juego.id),
    ]);

    setPreview({
      juego,
      simbolos: (simbolos as Simbolo[]) || [],
      sonidos: (sonidos as Sonido[]) || [],
      efectos: (efectos as Efecto[]) || [],
    });
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <strong style={{ fontSize: 15 }}>Catálogo</strong>
      <p className="hint" style={{ marginBottom: 14 }}>
        Los juegos marcados como "Listo". Así se verían en una lista real.
      </p>

      {cargando && <p className="hint">Cargando...</p>}
      {error && <p className="hint error">{error}</p>}
      {!cargando && !error && juegos.length === 0 && (
        <p className="hint">Todavía no tenés ningún juego marcado como "Listo".</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
        {juegos.map((j) => (
          <button
            key={j.id}
            onClick={() => abrir(j)}
            style={{ padding: 0, overflow: 'hidden', textAlign: 'left', display: 'block' }}
          >
            <div
              style={{
                aspectRatio: '1',
                background: j.portada_url ? `center/cover url('${j.portada_url}')` : 'var(--surface-alt)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!j.portada_url && <span className="hint" style={{ fontSize: 11 }}>Sin portada</span>}
            </div>
            <p style={{ margin: '8px 10px', fontSize: 13, fontWeight: 500 }}>{j.nombre}</p>
          </button>
        ))}
      </div>

      {preview && <Preview {...preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
