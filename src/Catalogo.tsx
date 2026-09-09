import { Suspense, useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import {
  Preview, PreviewMines, PreviewRuleta, PreviewRuletaBotones,
  PreviewCrash, PreviewPlinko, PreviewRaspadita, PreviewLimbo,
  PreviewDice, PreviewKeno, PreviewSieteUd, PreviewTorre,
} from './previews-lazy.tsx';
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
  const [previewMines, setPreviewMines] = useState<Juego | null>(null);
  const [previewRuleta, setPreviewRuleta] = useState<null | { juego: Juego; simbolos: Simbolo[] }>(null);
  const [previewBotones, setPreviewBotones] = useState<Juego | null>(null);
  const [previewCrash, setPreviewCrash] = useState<Juego | null>(null);
  const [previewPlinko, setPreviewPlinko] = useState<Juego | null>(null);
  const [previewRaspa, setPreviewRaspa] = useState<Juego | null>(null);
  const [previewLimbo, setPreviewLimbo] = useState<Juego | null>(null);
  const [previewDice, setPreviewDice] = useState<Juego | null>(null);
  const [previewKeno, setPreviewKeno] = useState<Juego | null>(null);
  const [previewTorre, setPreviewTorre] = useState<Juego | null>(null);
  const [previewSieteUd, setPreviewSieteUd] = useState<Juego | null>(null);

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
    if (juego.motor.startsWith('mines')) { setPreviewMines(juego); return; }
    if (juego.motor === 'ruleta-botones') { setPreviewBotones(juego); return; }
    if (juego.motor.startsWith('crash')) { setPreviewCrash(juego); return; }
    if (juego.motor.startsWith('plinko')) { setPreviewPlinko(juego); return; }
    if (juego.motor.startsWith('raspadita')) { setPreviewRaspa(juego); return; }
    if (juego.motor.startsWith('limbo')) { setPreviewLimbo(juego); return; }
    if (juego.motor.startsWith('dice')) { setPreviewDice(juego); return; }
    if (juego.motor.startsWith('keno')) { setPreviewKeno(juego); return; }
    if (juego.motor.startsWith('torre')) { setPreviewTorre(juego); return; }
    if (juego.motor.startsWith('sieteud')) { setPreviewSieteUd(juego); return; }
    if (juego.motor === 'ruleta') {
      const { data } = await supabase.from('simbolos').select('*').eq('juego_id', juego.id).order('orden');
      setPreviewRuleta({ juego, simbolos: (data as Simbolo[]) || [] });
      return;
    }
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
        <div className="empty-state">
          <div className="empty-icon">✦</div>
          <strong>Tu vitrina todavía está vacía</strong>
          <p className="hint">Cuando un juego pase a “Listo”, aparecerá acá para probarlo como cliente.</p>
        </div>
      )}

      <div className="catalog-grid">
        {juegos.map((j) => (
          <button
            key={j.id}
            onClick={() => abrir(j)}
            className="catalog-card"
          >
            <div
              className="catalog-art"
              style={{
                background: j.portada_url ? `center/cover url('${j.portada_url}')` : 'var(--surface-alt)',
              }}
            >
              {!j.portada_url && <span className="hint" style={{ fontSize: 11 }}>Sin portada</span>}
            </div>
            <p>{j.nombre}</p>
          </button>
        ))}
      </div>

      <Suspense fallback={null}>
        {preview && <Preview {...preview} onClose={() => setPreview(null)} />}
        {previewMines && <PreviewMines juego={previewMines} onClose={() => setPreviewMines(null)} />}
        {previewRuleta && <PreviewRuleta {...previewRuleta} onClose={() => setPreviewRuleta(null)} />}
        {previewBotones && <PreviewRuletaBotones juego={previewBotones} onClose={() => setPreviewBotones(null)} />}
        {previewCrash && <PreviewCrash juego={previewCrash} onClose={() => setPreviewCrash(null)} />}
        {previewPlinko && <PreviewPlinko juego={previewPlinko} onClose={() => setPreviewPlinko(null)} />}
        {previewRaspa && <PreviewRaspadita juego={previewRaspa} onClose={() => setPreviewRaspa(null)} />}
        {previewLimbo && <PreviewLimbo juego={previewLimbo} onClose={() => setPreviewLimbo(null)} />}
        {previewDice && <PreviewDice juego={previewDice} onClose={() => setPreviewDice(null)} />}
        {previewKeno && <PreviewKeno juego={previewKeno} onClose={() => setPreviewKeno(null)} />}
        {previewTorre && <PreviewTorre juego={previewTorre} onClose={() => setPreviewTorre(null)} />}
        {previewSieteUd && <PreviewSieteUd juego={previewSieteUd} onClose={() => setPreviewSieteUd(null)} />}
      </Suspense>
    </div>
  );
}
