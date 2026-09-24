import { useState } from 'react';
import { supabase } from './supabase.ts';
import { subirArchivo } from './juego/subir.ts';
import { ControlesAuto, Rango } from './AjustePanel.tsx';
import { planillaJson } from './juego/planilla.ts';
import type { Escenario } from './juego/escenario.ts';
import type { Juego, PosControlesRuleta } from './types.ts';

type ElemId = keyof PosControlesRuleta;

const ELEMS: { id: ElemId; etiqueta: string }[] = [
  { id: 'botones', etiqueta: 'Botones' },
  { id: 'girar', etiqueta: 'Girar' },
  { id: 'fichas', etiqueta: 'Fichas' },
  { id: 'saldo', etiqueta: 'Saldo' },
  { id: 'apostado', etiqueta: 'Apostado' },
  { id: 'sorpresa', etiqueta: 'Sorpresa' },
  { id: 'resultado', etiqueta: 'Resultado' },
];

// Panel de ajuste de la posición de los controles de la ruleta de
// botones. Edita `ruleta_botones_cfg.controles`.
export function AjusteRuletaControles({ juego, escenario, pos, onChange, onPlanilla }: {
  juego: Juego;
  escenario: Escenario;
  pos: PosControlesRuleta;
  onChange: (pos: PosControlesRuleta) => void;
  onPlanilla?: () => void;
}) {
  const [elem, setElem] = useState<ElemId>('botones');
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

  const guardar = async () => {
    setMsg('Guardando...');
    const { data } = await supabase.from('juegos').select('ruleta_botones_cfg').eq('id', juego.id).single();
    const base = (data?.ruleta_botones_cfg || {}) as Record<string, unknown>;
    const next = { ...base, controles: pos };
    const { error } = await supabase.from('juegos').update({
      ruleta_botones_cfg: next,
      planilla: planillaJson(escenario.planilla),
    }).eq('id', juego.id);
    setMsg(error ? error.message : 'Guardado ✓');
    (juego as { ruleta_botones_cfg?: unknown }).ruleta_botones_cfg = next;
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

      <Rango etiqueta="Posición X" min={0} max={100} valor={actual.x as number} onInput={(n) => set('x', n)} />
      <Rango etiqueta="Posición Y" min={0} max={100} valor={actual.y as number} onInput={(n) => set('y', n)} />

      {elem === 'botones' && (
        <Rango etiqueta="Ancho de la grilla" min={40} max={100} unidad="%" valor={actual.ancho as number} onInput={(n) => set('ancho', n)} />
      )}

      {elem === 'girar' && (
        <>
          <Rango etiqueta="Ancho" min={80} max={400} unidad="px" valor={actual.ancho as number} onInput={(n) => set('ancho', n)} />
          <Rango etiqueta="Alto" min={30} max={120} unidad="px" valor={actual.alto as number} onInput={(n) => set('alto', n)} />
          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', height: 54, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {actual.imagen_url
                ? <img src={actual.imagen_url as string} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>Imagen del botón Girar</span>}
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const url = await subirArchivo(f, `ruleta/${juego.id}`);
                if (url) set('imagen_url', url);
              }} />
            </label>
            {actual.imagen_url && <button style={{ fontSize: 12, marginTop: 4 }} onClick={() => set('imagen_url', null)}>Quitar imagen</button>}
          </div>
        </>
      )}

      <ControlesAuto
        escenario={escenario}
        onPlanilla={onPlanilla}
        juego={juego}
        ancla={{ x: pos.girar.x, y: pos.girar.y, tam: pos.girar.ancho }}
      />
      <button className="primary" style={{ width: '100%', marginTop: 14 }} onClick={guardar}>Guardar posición</button>
      <p className="hint">{msg}</p>
    </div>
  );
}
