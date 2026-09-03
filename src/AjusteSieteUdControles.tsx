import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.ts';
import { Rango } from './AjustePanel.tsx';
import { CONTROLES_SIETEUD_DEFAULT } from './juego/sieteud.ts';
import type { Juego, PosControlesSieteUd, SieteUdCfg } from './types.ts';

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
const CON_ESCALA: ElemId[] = ['saldo', 'historial', 'suma', 'campana', 'zonas', 'apuesta', 'boton'];

// Panel para ubicar las piezas del 7 Up 7 Down. Se ven en vivo a la
// izquierda y se pueden arrastrar. Guarda en sieteud_cfg.controles.
export function AjusteSieteUdControles({ juego, pos, elem, onChange, onElem, onGuardar }: {
  juego: Juego;
  pos: PosControlesSieteUd;
  elem: ElemId;
  onChange: (pos: PosControlesSieteUd) => void;
  onElem: (id: ElemId) => void;
  /** Si viene, se usa esto para persistir (merge por Editor). Si no, escribe directo. */
  onGuardar?: (patch: Partial<SieteUdCfg>) => Promise<void>;
}) {
  const [msg, setMsg] = useState('');
  const [mostrarNombre, setMostrarNombre] = useState((juego.mostrar_nombre ?? true) as boolean);
  const timer = useRef<number | undefined>(undefined);
  const posRef = useRef(pos);
  posRef.current = pos;
  const pendiente = useRef(false);

  const persistir = async () => {
    if (!pendiente.current) return;
    pendiente.current = false;
    setMsg('Guardando…');
    const p = posRef.current;
    if (onGuardar) {
      await onGuardar({ controles: p });
    } else {
      const { data } = await supabase.from('juegos').select('sieteud_cfg').eq('id', juego.id).single();
      const base = (data?.sieteud_cfg || {}) as Record<string, unknown>;
      const next = { ...base, controles: p };
      await supabase.from('juegos').update({ sieteud_cfg: next }).eq('id', juego.id);
      (juego as { sieteud_cfg?: unknown }).sieteud_cfg = next;
    }
    setMsg('Guardado ✓');
  };

  const persistirRef = useRef(persistir);
  persistirRef.current = persistir;

  const autoguardar = () => {
    pendiente.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persistirRef.current(), 500);
  };

  // flush al cerrar el panel para no perder el último cambio
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (pendiente.current) void persistirRef.current();
  }, []);

  const actual = pos[elem] as unknown as Record<string, number>;
  const set = (prop: string, valor: number) => {
    onChange({ ...pos, [elem]: { ...(pos[elem] as object), [prop]: valor } });
    autoguardar();
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
      <p className="hint" style={{ margin: '4px 0 10px' }}>Arrastrá en la vista previa o usá los deslizadores.</p>

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
      {CON_ESCALA.includes(elem) && (
        <Rango etiqueta="Tamaño" min={50} max={200} unidad="%" valor={Math.round((actual.escala ?? 1) * 100)}
          onInput={(n) => set('escala', n / 100)} />
      )}

      <p className="hint" style={{ margin: '4px 0 0' }}>También podés arrastrar la esquina de la pieza seleccionada en la vista previa.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="primary" style={{ flex: 1, fontSize: 12 }}
          onClick={() => { pendiente.current = true; void persistir(); }}>Guardar posiciones</button>
        <button style={{ fontSize: 12 }} onClick={restablecer}>Restablecer</button>
      </div>
      <p className="hint" style={{ marginTop: 6 }}>{msg}</p>
    </div>
  );
}
