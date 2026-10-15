import { useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase.ts';
import { Rango } from './AjustePanel.tsx';
import { planillaDe, planillaJson } from './juego/planilla.ts';
import type { Juego } from './types.ts';

export interface LayVolumen { x: number; y: number; tam: number }

/** Posición del volumen de un juego que no usa el escenario (Dados, Limbo, 7 Up). */
export function useVolumenEditable(juego: Juego, alCambiar?: (planilla: unknown) => void) {
  const ini = planillaDe(juego);
  const [lay, setLay] = useState<LayVolumen>({ x: ini.volumenX, y: ini.volumenY, tam: ini.volumenTam });
  const [msg, setMsg] = useState('');
  const layRef = useRef(lay);
  const poner = (patch: Partial<LayVolumen>) => {
    const next = { ...layRef.current, ...patch };
    layRef.current = next;
    const base = planillaDe(juego);
    const json = planillaJson({ ...base, volumenX: next.x, volumenY: next.y, volumenTam: next.tam });
    juego.planilla = json;
    setLay(next);
    alCambiar?.(json);
  };
  const guardar = async () => {
    setMsg('Guardando...');
    const { error } = await supabase.from('juegos').update({ planilla: juego.planilla }).eq('id', juego.id);
    setMsg(error ? error.message : 'Guardado ✓');
  };
  return { lay, poner, guardar, msg };
}

/** Envuelve la vista previa de Dados o Limbo. El módulo solo se pide al abrir la prueba. */
export function MarcoVolumen({ juego, children }: {
  juego: Juego;
  children: (api: {
    barra: ReactNode;
    panel: ReactNode;
    volumen: {
      x: number; y: number; tam: number; editable: boolean;
      onMover: (x: number, y: number) => void;
      onTam: (tam: number) => void;
    };
  }) => ReactNode;
}) {
  const vol = useVolumenEditable(juego);
  const [ajustar, setAjustar] = useState(false);
  return children({
    barra: <button onClick={() => setAjustar((v) => !v)}>{ajustar ? '✓ Volumen' : '⚙ Volumen'}</button>,
    panel: ajustar ? <TarjetaVolumen lay={vol.lay} onChange={vol.poner} onGuardar={vol.guardar} msg={vol.msg} /> : null,
    volumen: {
      x: vol.lay.x, y: vol.lay.y, tam: vol.lay.tam, editable: ajustar,
      onMover: (x, y) => vol.poner({ x, y }),
      onTam: (tam) => vol.poner({ tam }),
    },
  });
}

export function TarjetaVolumen({ lay, onChange, onGuardar, msg }: {
  lay: LayVolumen;
  onChange: (patch: Partial<LayVolumen>) => void;
  onGuardar: () => void;
  msg: string;
}) {
  return (
    <div className="card" style={{ position: 'absolute', top: 58, left: 12, width: 250, zIndex: 70, maxHeight: 'min(70vh, 520px)', overflow: 'auto' }}>
      <strong>Volumen</strong>
      <p className="hint" style={{ margin: '4px 0 8px' }}>
        Arrastralo en la pantalla. La esquina cambia el tamaño.
      </p>
      <Rango etiqueta="Posición X" min={0} max={100} unidad="%" valor={lay.x} onInput={(n) => onChange({ x: n })} />
      <Rango etiqueta="Posición Y" min={0} max={100} unidad="%" valor={lay.y} onInput={(n) => onChange({ y: n })} />
      <Rango etiqueta="Tamaño" min={50} max={180} unidad="%" valor={lay.tam} onInput={(n) => onChange({ tam: n })} />
      <button className="primary" style={{ width: '100%' }} onClick={onGuardar}>Guardar volumen</button>
      <p className="hint">{msg}</p>
    </div>
  );
}
