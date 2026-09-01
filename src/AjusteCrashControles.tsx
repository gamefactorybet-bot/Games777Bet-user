import { useState } from 'react';
import { supabase } from './supabase.ts';
import { subirArchivo } from './juego/subir.ts';
import { Rango } from './AjustePanel.tsx';
import type { Escenario } from './juego/escenario.ts';
import type { Juego, PosControlesCrash } from './types.ts';

type ElemId = keyof PosControlesCrash | 'fichas';

const ELEMS: { id: ElemId; etiqueta: string }[] = [
  { id: 'boton', etiqueta: 'Botón' },
  { id: 'apuesta', etiqueta: 'Apuesta' },
  { id: 'fichas', etiqueta: 'Fichas' },
  { id: 'auto', etiqueta: 'Auto' },
  { id: 'multiplicador', etiqueta: 'Multiplic.' },
  { id: 'saldo', etiqueta: 'Saldo' },
  { id: 'historial', etiqueta: 'Historial' },
];

// Panel para ubicar los controles del Crash. Edita `crash_cfg.controles`.
export function AjusteCrashControles({ juego, escenario, pos, onChange, onElem }: {
  juego: Juego;
  escenario: Escenario;
  pos: PosControlesCrash;
  onChange: (pos: PosControlesCrash) => void;
  onElem?: (id: ElemId) => void;
}) {
  const [elem, setElemRaw] = useState<ElemId>('boton');
  const setElem = (id: ElemId) => { setElemRaw(id); onElem?.(id); };
  const [msg, setMsg] = useState('');
  const [mostrarNombre, setMostrarNombre] = useState((juego.mostrar_nombre ?? true) as boolean);

  const toggleNombre = async (v: boolean) => {
    setMostrarNombre(v);
    escenario.setMostrarNombre(v);
    await supabase.from('juegos').update({ mostrar_nombre: v }).eq('id', juego.id);
    (juego as { mostrar_nombre?: boolean }).mostrar_nombre = v;
  };

  const esFichas = elem === 'fichas';
  const actual = (esFichas ? {} : pos[elem]) as Record<string, number | string | null>;
  const set = (prop: string, valor: number | string | null) => {
    if (esFichas) return;
    onChange({ ...pos, [elem]: { ...(pos[elem as keyof PosControlesCrash] as object), [prop]: valor } });
  };

  const guardar = async () => {
    setMsg('Guardando...');
    const { data } = await supabase.from('juegos').select('crash_cfg').eq('id', juego.id).single();
    const base = (data?.crash_cfg || {}) as Record<string, unknown>;
    const next = { ...base, controles: pos };
    const { error } = await supabase.from('juegos').update({ crash_cfg: next }).eq('id', juego.id);
    setMsg(error ? error.message : 'Guardado ✓');
    (juego as { crash_cfg?: unknown }).crash_cfg = next;
  };

  return (
    <div className="card" style={{ width: 260, maxHeight: 'min(860px, 92vh)', overflow: 'auto', position: 'relative', zIndex: 50 }}>
      <strong>Ubicar los controles</strong>
      <p className="hint" style={{ margin: '4px 0 10px' }}>Se ve en vivo a la izquierda.</p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
        <input type="checkbox" checked={mostrarNombre} onChange={(e) => toggleNombre(e.target.checked)} />
        Mostrar el nombre del juego arriba
      </label>

      <div className="grupo-nav" style={{ marginBottom: 12 }}>
        {ELEMS.map((e) => (
          <button key={e.id} className={`grupo-btn ${e.id === elem ? 'on' : ''}`}
            style={{ flex: '1 1 30%', fontSize: 12, justifyContent: 'center' }}
            onClick={() => setElem(e.id)}>{e.etiqueta}</button>
        ))}
      </div>

      {esFichas ? (
        <p className="hint" style={{ margin: '4px 0 0' }}>
          Arrastrá cada ficha en la vista previa para ubicarla. El valor, la imagen y los tamaños se
          cargan en <b>Jugabilidad → Fichas de apuesta rápida</b>.
        </p>
      ) : (
        <>
          <Rango etiqueta="Posición X" min={0} max={100} valor={actual.x as number} onInput={(n) => set('x', n)} />
          <Rango etiqueta="Posición Y" min={0} max={100} valor={actual.y as number} onInput={(n) => set('y', n)} />
        </>
      )}

      {elem === 'boton' && (
        <>
          <Rango etiqueta="Ancho" min={100} max={400} unidad="px" valor={actual.ancho as number} onInput={(n) => set('ancho', n)} />
          <Rango etiqueta="Alto" min={36} max={110} unidad="px" valor={actual.alto as number} onInput={(n) => set('alto', n)} />
          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', height: 54, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {actual.imagen_url
                ? <img src={actual.imagen_url as string} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>Imagen del botón</span>}
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const url = await subirArchivo(f, `crash/${juego.id}`);
                if (url) set('imagen_url', url);
              }} />
            </label>
            {actual.imagen_url && <button style={{ fontSize: 12, marginTop: 4 }} onClick={() => set('imagen_url', null)}>Quitar imagen</button>}
          </div>
        </>
      )}

      <button className="primary" style={{ width: '100%', marginTop: 14 }} onClick={guardar}>Guardar posición</button>
      <p className="hint">{msg}</p>
    </div>
  );
}
