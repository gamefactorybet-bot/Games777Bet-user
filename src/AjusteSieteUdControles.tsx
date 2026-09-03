import { useRef, useState } from 'react';
import { supabase } from './supabase.ts';
import { Rango } from './AjustePanel.tsx';
import { CONTROLES_SIETEUD_DEFAULT } from './juego/sieteud.ts';
import type { Juego, PosControlesSieteUd } from './types.ts';

type ElemId = keyof PosControlesSieteUd;

const ELEMS: { id: ElemId; etiqueta: string }[] = [
  { id: 'mesa', etiqueta: 'Mesa' },
  { id: 'suma', etiqueta: 'Suma' },
  { id: 'campana', etiqueta: 'Campana' },
  { id: 'zonas', etiqueta: 'Zonas' },
  { id: 'apuesta', etiqueta: 'Apuesta' },
  { id: 'boton', etiqueta: 'Botón' },
  { id: 'saldo', etiqueta: 'Saldo' },
  { id: 'historial', etiqueta: 'Historial' },
  { id: 'cartel', etiqueta: 'Cartel' },
];
const CON_ANCHO: ElemId[] = ['mesa', 'campana', 'zonas', 'boton', 'cartel'];
const CON_ALTO: ElemId[] = ['mesa', 'cartel'];

// Panel para ubicar las piezas del 7 Up 7 Down. Se ven en vivo a la
// izquierda y se pueden arrastrar. Guarda en sieteud_cfg.controles.
export function AjusteSieteUdControles({ juego, pos, elem, onChange, onElem }: {
  juego: Juego;
  pos: PosControlesSieteUd;
  elem: ElemId;
  onChange: (pos: PosControlesSieteUd) => void;
  onElem: (id: ElemId) => void;
}) {
  const [msg, setMsg] = useState('');
  const [mostrarNombre, setMostrarNombre] = useState((juego.mostrar_nombre ?? true) as boolean);
  const guardarT = useRef<number | undefined>(undefined);

  const actual = pos[elem] as unknown as Record<string, number>;
  const set = (prop: string, valor: number) => {
    onChange({ ...pos, [elem]: { ...(pos[elem] as object), [prop]: valor } });
    autoguardar();
  };
  const autoguardar = () => {
    window.clearTimeout(guardarT.current);
    guardarT.current = window.setTimeout(guardar, 500);
  };

  const guardar = async () => {
    setMsg('Guardando…');
    const { data } = await supabase.from('juegos').select('sieteud_cfg').eq('id', juego.id).single();
    const base = (data?.sieteud_cfg || {}) as Record<string, unknown>;
    const next = { ...base, controles: pos };
    const { error } = await supabase.from('juegos').update({ sieteud_cfg: next }).eq('id', juego.id);
    setMsg(error ? error.message : 'Guardado ✓');
    (juego as { sieteud_cfg?: unknown }).sieteud_cfg = next;
  };

  const toggleNombre = async (v: boolean) => {
    setMostrarNombre(v);
    await supabase.from('juegos').update({ mostrar_nombre: v }).eq('id', juego.id);
    (juego as { mostrar_nombre?: boolean }).mostrar_nombre = v;
  };

  const restablecer = () => { onChange({ ...CONTROLES_SIETEUD_DEFAULT }); autoguardar(); };

  return (
    <div className="card" style={{ width: 258, maxHeight: 'min(860px, 92vh)', overflow: 'auto', position: 'relative', zIndex: 50 }}>
      <strong>Ubicar las piezas</strong>
      <p className="hint" style={{ margin: '4px 0 10px' }}>Arrastrá en la vista previa o usá los deslizadores. Se guarda solo.</p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
        <input type="checkbox" checked={mostrarNombre} onChange={(e) => toggleNombre(e.target.checked)} />
        Mostrar el nombre del juego arriba
      </label>

      <div className="grupo-nav" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {ELEMS.map((e) => (
          <button key={e.id} className={`grupo-btn ${e.id === elem ? 'on' : ''}`}
            style={{ flex: '1 1 30%', fontSize: 12, justifyContent: 'center' }}
            onClick={() => onElem(e.id)}>{e.etiqueta}</button>
        ))}
      </div>

      <Rango etiqueta="Posición X" min={0} max={100} valor={Math.round(actual.x)} onInput={(n) => set('x', n)} />
      <Rango etiqueta="Posición Y" min={0} max={100} valor={Math.round(actual.y)} onInput={(n) => set('y', n)} />
      {CON_ANCHO.includes(elem) && (
        <Rango etiqueta="Ancho" min={20} max={100} unidad="%" valor={Math.round(actual.w)} onInput={(n) => set('w', n)} />
      )}
      {CON_ALTO.includes(elem) && (
        <Rango etiqueta="Alto" min={10} max={70} unidad="%" valor={Math.round(actual.h)} onInput={(n) => set('h', n)} />
      )}

      <button style={{ width: '100%', marginTop: 12, fontSize: 12 }} onClick={restablecer}>Restablecer posiciones</button>
      <p className="hint" style={{ marginTop: 6 }}>{msg}</p>
    </div>
  );
}
