import { useState } from 'react';
import { supabase } from './supabase.ts';
import { subirArchivo } from './juego/subir.ts';
import { Rango } from './AjustePanel.tsx';
import type { Escenario } from './juego/escenario.ts';
import type { Juego, PosControlesMines } from './types.ts';

type ElemId = 'saldo' | 'mult' | 'boton' | 'apuesta' | 'minas';

const ELEMS: { id: ElemId; etiqueta: string }[] = [
  { id: 'saldo', etiqueta: 'Saldo' },
  { id: 'mult', etiqueta: 'Multiplic.' },
  { id: 'boton', etiqueta: 'Botón' },
  { id: 'apuesta', etiqueta: 'Apuesta' },
  { id: 'minas', etiqueta: 'Minas' },
];

const CON_RECUADRO: ElemId[] = ['saldo', 'mult', 'boton'];

// Panel de ajuste de los controles del tablero de Mines. Edita
// `juego.mines_controles`.
export function AjusteMinesControles({ juego, escenario, pos, onChange }: {
  juego: Juego;
  escenario: Escenario;
  pos: PosControlesMines;
  onChange: (pos: PosControlesMines) => void;
}) {
  const [elem, setElem] = useState<ElemId>('saldo');
  const [msg, setMsg] = useState('');
  const [mostrarNombre, setMostrarNombre] = useState((juego.mostrar_nombre ?? true) as boolean);

  const toggleNombre = async (v: boolean) => {
    setMostrarNombre(v);
    escenario.setMostrarNombre(v);
    await supabase.from('juegos').update({ mostrar_nombre: v }).eq('id', juego.id);
    (juego as { mostrar_nombre?: boolean }).mostrar_nombre = v;
  };

  const actual = pos[elem] as Record<string, number | string | null>;

  const set = (prop: string, valor: number | string | null) => {
    onChange({ ...pos, [elem]: { ...(pos[elem] as object), [prop]: valor } });
  };

  const subirA = async (prop: string, f: File) => {
    const url = await subirArchivo(f, `mines/${juego.id}`);
    if (url) set(prop, url);
  };

  const guardar = async () => {
    setMsg('Guardando...');
    const { error } = await supabase.from('juegos').update({ mines_controles: pos }).eq('id', juego.id);
    setMsg(error ? error.message : 'Guardado ✓');
    (juego as { mines_controles?: unknown }).mines_controles = pos;
  };

  return (
    <div className="card" style={{ width: 260, maxHeight: 'min(860px, 92vh)', overflow: 'auto', position: 'relative', zIndex: 50 }}>
      <strong>Controles del tablero</strong>
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

      <Rango etiqueta="Posición X" min={0} max={100} valor={actual.x as number} onInput={(n) => set('x', n)} />
      <Rango etiqueta="Posición Y" min={0} max={100} valor={actual.y as number} onInput={(n) => set('y', n)} />

      {CON_RECUADRO.includes(elem) && (
        <>
          <Rango etiqueta="Ancho" min={40} max={300} unidad="px" valor={actual.ancho as number} onInput={(n) => set('ancho', n)} />
          <Rango etiqueta="Alto" min={24} max={140} unidad="px" valor={actual.alto as number} onInput={(n) => set('alto', n)} />
          <CampoImagen
            etiqueta={elem === 'boton' ? 'Imagen del botón' : 'Fondo del recuadro'}
            url={(actual[elem === 'boton' ? 'imagen_url' : 'fondo_url'] as string) || null}
            onSubir={(f) => subirA(elem === 'boton' ? 'imagen_url' : 'fondo_url', f)}
            onQuitar={() => set(elem === 'boton' ? 'imagen_url' : 'fondo_url', null)}
          />
        </>
      )}

      {elem === 'minas' && (
        <>
          <Rango etiqueta="Ancho" min={80} max={280} unidad="px" valor={actual.ancho as number} onInput={(n) => set('ancho', n)} />
          <Rango etiqueta="Grosor del carril" min={4} max={28} unidad="px" valor={actual.grosor as number} onInput={(n) => set('grosor', n)} />
          <CampoImagen etiqueta="Imagen del carril" url={(actual.carril_url as string) || null}
            onSubir={(f) => subirA('carril_url', f)} onQuitar={() => set('carril_url', null)} />
          <CampoImagen etiqueta="Imagen de la perilla" redondo url={(actual.thumb_url as string) || null}
            onSubir={(f) => subirA('thumb_url', f)} onQuitar={() => set('thumb_url', null)} />
        </>
      )}

      <button className="primary" style={{ width: '100%', marginTop: 14 }} onClick={guardar}>Guardar posición</button>
      <p className="hint">{msg}</p>
    </div>
  );
}

function CampoImagen({ etiqueta, url, redondo, onSubir, onQuitar }: {
  etiqueta: string;
  url: string | null;
  redondo?: boolean;
  onSubir: (f: File) => void;
  onQuitar: () => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: 'block', height: 54, borderRadius: redondo ? '50%' : 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', width: redondo ? 54 : '100%' }}>
        {url
          ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, textAlign: 'center', padding: 4 }}>{etiqueta}</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onSubir(e.target.files[0])} />
      </label>
      {!redondo && <p className="hint" style={{ margin: '2px 0 0', fontSize: 10 }}>{etiqueta}</p>}
      {url && <button style={{ fontSize: 12, marginTop: 4 }} onClick={onQuitar}>Quitar imagen</button>}
    </div>
  );
}
