import { useMemo, useState } from 'react';
import { subirArchivo } from './juego/subir.ts';
import { Rango } from './AjustePanel.tsx';
import { TEMAS as TEMAS_INSTANT } from './juego/instant-temas.ts';
import { SelectorPiel } from './SelectorPiel.tsx';
import { MATERIALES_DADO } from './juego/dados3d.ts';
import { probsZonas as _probs, rtpZona as _rtpZona, pagoRaw as _pagoRaw } from '../motor/sieteud.js';
import {
  PIEZAS_SIETEUD, CONTROLES_SIETEUD_DEFAULT, FIT_OPC, ZONA_INFO, ZONAS, CFG_DEFAULT,
} from './juego/sieteud.ts';
import type { AjusteImg, Juego, PosControlesSieteUd, SieteUdCfg, SieteUdPreset, SieteUdVisualCfg, ZonaSieteUd } from './types.ts';

type ElemId = keyof PosControlesSieteUd;
type ImgKey = 'pantalla' | 'mesa' | 'cartel' | 'boton';
type Pestana = 'piezas' | 'imagenes' | 'estilo' | 'presets' | 'juego';

const CAMPO_IMG: Record<ImgKey, 'fondoPantallaUrl' | 'fondoUrl' | 'cartelUrl' | 'botonImg'> = {
  pantalla: 'fondoPantallaUrl', mesa: 'fondoUrl', cartel: 'cartelUrl', boton: 'botonImg',
};

// Toda la edición de 7 Up 7 Down en un panel, dentro de la Vista previa.
export function SieteUdEditor({
  juego, cfg, pos, seleccion, onSelPieza, onCfg, onArte, onPos, cfgActual,
  mostrarNombre, onToggleNombre,
  puedeDeshacer, puedeRehacer, onDeshacer, onRehacer,
  onAplicarVisual,
}: {
  juego: Juego;
  cfg: SieteUdCfg;
  pos: PosControlesSieteUd;
  seleccion: ElemId;
  onSelPieza: (id: ElemId) => void;
  onCfg: (patch: Partial<SieteUdCfg>) => void;
  onArte: (k: ImgKey, patch: Partial<AjusteImg>) => void;
  onPos: (pos: PosControlesSieteUd) => void;
  /** Lectura síncrona del cfg más reciente (evita pisadas entre ediciones seguidas). */
  cfgActual: () => SieteUdCfg;
  mostrarNombre: boolean;
  onToggleNombre: (v: boolean) => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
  onAplicarVisual: (visual: SieteUdVisualCfg) => void;
}) {
  const [tab, setTab] = useState<Pestana>('piezas');

  return (
    <div className="card" style={{ width: 270, maxWidth: '92vw', maxHeight: 'min(860px, 92vh)', overflow: 'auto', position: 'relative', zIndex: 50 }}>
      <div className="grupo-nav" style={{ marginBottom: 12 }}>
        {([['piezas', 'Piezas'], ['imagenes', 'Imágenes'], ['estilo', 'Estilo'], ['presets', 'Presets'], ['juego', 'Juego']] as const).map(([id, t]) => (
          <button key={id} className={`grupo-btn ${tab === id ? 'on' : ''}`}
            style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setTab(id)}>{t}</button>
        ))}
      </div>

      {tab === 'piezas' && (
        <TabPiezas
          pos={pos} seleccion={seleccion} onSelPieza={onSelPieza} onPos={onPos}
          mostrarNombre={mostrarNombre} onToggleNombre={onToggleNombre}
          editor={cfg.editor} onEditor={(editor) => onCfg({ editor })}
          puedeDeshacer={puedeDeshacer} puedeRehacer={puedeRehacer} onDeshacer={onDeshacer} onRehacer={onRehacer}
        />
      )}
      {tab === 'imagenes' && <TabImagenes juego={juego} cfg={cfg} onCfg={onCfg} onArte={onArte} />}
      {tab === 'estilo' && <TabEstilo cfg={cfg} onCfg={onCfg} />}
      {tab === 'presets' && <TabPresets cfg={cfg} pos={pos} cfgActual={cfgActual} onCfg={onCfg} onAplicarVisual={onAplicarVisual} />}
      {tab === 'juego' && <TabJuego cfg={cfg} onCfg={onCfg} />}
    </div>
  );
}

// ---------------- Pestaña Presets ----------------

const copiar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function visualActual(cfg: SieteUdCfg, pos: PosControlesSieteUd): SieteUdVisualCfg {
  return copiar({
    tema: cfg.tema, dadoMaterial: cfg.dadoMaterial, fondoPantallaUrl: cfg.fondoPantallaUrl, fondoUrl: cfg.fondoUrl, velo: cfg.velo,
    cartelUrl: cfg.cartelUrl, botonImg: cfg.botonImg, arte: cfg.arte, controles: pos,
    editor: cfg.editor, estilos: cfg.estilos,
  });
}

const PALETAS_PRESET = [
  { id: 'clasico', nombre: 'Clásico', tema: 'clasico', fondo: '#1b1f27', borde: '#262b34', acento: '#6b8afd', seleccionado: '#26345d', gana: '#175c3c', pierde: '#632b32', boton: '#6b8afd' },
  { id: 'neon', nombre: 'Neón', tema: 'neon', fondo: '#21142b', borde: '#ff5fc8', acento: '#ff78d1', seleccionado: '#57294f', gana: '#16664f', pierde: '#6d284a', boton: '#e337a3' },
  { id: 'casino', nombre: 'Casino', tema: 'casino', fondo: '#173827', borde: '#cda44b', acento: '#f1cb6b', seleccionado: '#355d37', gana: '#297346', pierde: '#7b2929', boton: '#b8822d' },
  { id: 'minimalista', nombre: 'Minimalista', tema: 'grafito', fondo: '#25282d', borde: '#454b54', acento: '#f3f5f7', seleccionado: '#3a4049', gana: '#2f714b', pierde: '#803a42', boton: '#f3f5f7' },
] as const;

const ARTE_CLASICO: SieteUdVisualCfg['arte'] = {
  pantalla: { fit: 'cover', x: 50, y: 50, zoom: 100, blur: 0, osc: 0 },
  mesa: { fit: 'cover', x: 50, y: 50, zoom: 100, blur: 0, osc: 0 },
  cartel: { fit: 'cover', x: 50, y: 50, zoom: 100, blur: 0, osc: 0 },
  boton: { fit: 'fill', x: 50, y: 50, zoom: 100, blur: 0, osc: 0 },
};
const ESTILOS_CLASICOS: SieteUdVisualCfg['estilos'] = {
  zonas: { fondo: '#1b1f27', borde: '#262b34', texto: '#e7eaef', acento: '#6b8afd', seleccionado: '#26345d', gana: '#175c3c', pierde: '#632b32', radio: 11, sombra: 28, escala: 100 },
  boton: { fondo: '#6b8afd', texto: '#ffffff', borde: '#6b8afd', bloqueado: '#3a4050', radio: 12, sombra: 38, escala: 100 },
};

function presetsBase(cfg: SieteUdCfg, pos: PosControlesSieteUd): SieteUdPreset[] {
  return PALETAS_PRESET.map((p) => {
    const visual = visualActual(cfg, pos);
    visual.controles = copiar(CONTROLES_SIETEUD_DEFAULT);
    visual.editor = { ocultas: [], bloqueadas: [], snap: true };
    visual.arte = copiar(ARTE_CLASICO);
    visual.estilos = copiar(ESTILOS_CLASICOS);
    visual.tema = p.tema;
    visual.dadoMaterial = p.id === 'casino' ? 'oro' : p.id === 'neon' ? 'cristal' : p.id === 'minimalista' ? 'onix' : 'marfil';
    visual.velo = CFG_DEFAULT.velo;
    visual.fondoPantallaUrl = null; visual.fondoUrl = null; visual.cartelUrl = null; visual.botonImg = null;
    visual.estilos.zonas = { ...visual.estilos.zonas, fondo: p.fondo, borde: p.borde, acento: p.acento, seleccionado: p.seleccionado, gana: p.gana, pierde: p.pierde };
    visual.estilos.boton = { ...visual.estilos.boton, fondo: p.boton, borde: p.boton, texto: p.id === 'minimalista' ? '#15171a' : '#ffffff' };
    return { id: `base-${p.id}`, nombre: p.nombre, visual };
  });
}

function TabPresets({ cfg, pos, cfgActual, onCfg, onAplicarVisual }: {
  cfg: SieteUdCfg; pos: PosControlesSieteUd;
  cfgActual: () => SieteUdCfg;
  onCfg: (patch: Partial<SieteUdCfg>) => void;
  onAplicarVisual: (visual: SieteUdVisualCfg) => void;
}) {
  const [nombre, setNombre] = useState('');
  // Sólo para mostrar la lista: se recalcula cuando cambia cfg/pos, no en
  // cada tecla del campo "Nombre" (nombre no forma parte de las deps).
  const base = useMemo(() => presetsBase(cfg, pos), [cfg, pos]);
  const propios = cfg.presets || [];
  // Las escrituras leen cfgActual() (ref síncrona), no el `cfg` de este
  // render, para que dos guardados seguidos no se pisen entre sí.
  const guardar = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    const id = globalThis.crypto?.randomUUID?.() || `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ahora = cfgActual();
    onCfg({ presets: [...(ahora.presets || []), { id, nombre: limpio, visual: visualActual(ahora, ahora.controles as PosControlesSieteUd) }] });
    setNombre('');
  };
  const aplicar = (preset: SieteUdPreset) => {
    if (window.confirm(`¿Aplicar el preset “${preset.nombre}”? Reemplazará la apariencia y la composición actuales, pero no las reglas del juego.`)) {
      onAplicarVisual(copiar(preset.visual));
    }
  };
  const actualizar = (preset: SieteUdPreset) => {
    if (!window.confirm(`¿Actualizar “${preset.nombre}” con el diseño actual?`)) return;
    const ahora = cfgActual();
    const visual = visualActual(ahora, ahora.controles as PosControlesSieteUd);
    onCfg({ presets: (ahora.presets || []).map((p) => p.id === preset.id ? { ...p, visual } : p) });
  };
  const renombrar = (preset: SieteUdPreset) => {
    const nombreNuevo = window.prompt('Nombre del preset', preset.nombre)?.trim();
    if (!nombreNuevo || nombreNuevo === preset.nombre) return;
    const ahora = cfgActual();
    onCfg({ presets: (ahora.presets || []).map((p) => p.id === preset.id ? { ...p, nombre: nombreNuevo.slice(0, 60) } : p) });
  };
  const borrar = (preset: SieteUdPreset) => {
    if (!window.confirm(`¿Eliminar el preset “${preset.nombre}”?`)) return;
    const ahora = cfgActual();
    onCfg({ presets: (ahora.presets || []).filter((p) => p.id !== preset.id) });
  };
  const resetear = (seccion: 'piezas' | 'imagenes' | 'estilo') => {
    if (!window.confirm(`¿Restablecer ${seccion} al diseño clásico?`)) return;
    const ahora = cfgActual();
    const clasico = presetsBase(ahora, ahora.controles as PosControlesSieteUd)[0].visual;
    const visual = visualActual(ahora, ahora.controles as PosControlesSieteUd);
    if (seccion === 'piezas') { visual.controles = clasico.controles; visual.editor = clasico.editor; }
    if (seccion === 'imagenes') { visual.fondoPantallaUrl = null; visual.fondoUrl = null; visual.cartelUrl = null; visual.botonImg = null; visual.arte = clasico.arte; visual.velo = clasico.velo; }
    if (seccion === 'estilo') { visual.tema = clasico.tema; visual.estilos = clasico.estilos; }
    onAplicarVisual(visual);
  };
  const fila = (preset: SieteUdPreset, propio: boolean) => (
    <div key={preset.id} style={{ padding: 8, border: '1px solid var(--border-soft)', borderRadius: 9, background: 'var(--surface-alt)', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-label="Muestra de colores" title="Muestra de colores" style={{ display: 'flex', overflow: 'hidden', width: 22, height: 13, flexShrink: 0, borderRadius: 99, border: `1px solid ${preset.visual.estilos.zonas.borde}` }}>
          <i style={{ flex: 1, background: preset.visual.estilos.zonas.fondo }} /><i style={{ flex: 1, background: preset.visual.estilos.zonas.acento }} /><i style={{ flex: 1, background: preset.visual.estilos.boton.fondo }} />
        </span>
        <b style={{ flex: 1, fontSize: 12 }}>{preset.nombre}</b>
        <button onClick={() => aplicar(preset)} style={{ fontSize: 11, padding: '4px 7px' }}>Aplicar</button>
      </div>
      {propio && <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        <button onClick={() => actualizar(preset)} style={{ flex: 1, fontSize: 10, padding: '4px' }}>Actualizar</button>
        <button onClick={() => renombrar(preset)} style={{ fontSize: 10, padding: '4px' }}>Renombrar</button>
        <button onClick={() => borrar(preset)} style={{ fontSize: 10, padding: '4px', color: 'var(--danger)' }}>Eliminar</button>
      </div>}
    </div>
  );
  return <>
    <p className="hint" style={{ margin: '0 0 10px' }}>Los presets guardan sólo el diseño: piezas, imágenes, retoques y estilos. RTP, caras y pagos no se modifican.</p>
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Diseños base</div>
    {base.map((p) => fila(p, false))}
    <div style={{ borderTop: '1px solid var(--border-soft)', margin: '12px 0 10px' }} />
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Mis presets</div>
    <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
      <input aria-label="Nombre del preset" value={nombre} maxLength={60} placeholder="Nombre del diseño" onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} style={{ minWidth: 0, flex: 1, fontSize: 11 }} />
      <button className="primary" onClick={guardar} disabled={!nombre.trim()} style={{ fontSize: 11 }}>Guardar actual</button>
    </div>
    {propios.length ? propios.map((p) => fila(p, true)) : <p className="hint" style={{ margin: '0 0 10px' }}>Todavía no guardaste un diseño propio.</p>}
    <div style={{ borderTop: '1px solid var(--border-soft)', margin: '12px 0 10px' }} />
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Restablecer una sección</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
      <button onClick={() => resetear('piezas')} style={{ fontSize: 10, padding: '5px 2px' }}>Piezas</button>
      <button onClick={() => resetear('imagenes')} style={{ fontSize: 10, padding: '5px 2px' }}>Imágenes</button>
      <button onClick={() => resetear('estilo')} style={{ fontSize: 10, padding: '5px 2px' }}>Estilo</button>
    </div>
  </>;
}

// ---------------- Pestaña Estilo ----------------

function Color({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7, fontSize: 11 }}>
      <span>{etiqueta}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input aria-label={etiqueta} type="color" value={valor} onChange={(e) => onCambio(e.target.value)} style={{ width: 28, height: 24, padding: 2, borderRadius: 5 }} />
        <code style={{ fontSize: 10, color: 'var(--text-dim)' }}>{valor}</code>
      </span>
    </label>
  );
}

function TabEstilo({ cfg, onCfg }: { cfg: SieteUdCfg; onCfg: (patch: Partial<SieteUdCfg>) => void }) {
  const { zonas, boton } = cfg.estilos;
  const setZonas = (patch: Partial<typeof zonas>) => onCfg({ estilos: { ...cfg.estilos, zonas: { ...zonas, ...patch } } });
  const setBoton = (patch: Partial<typeof boton>) => onCfg({ estilos: { ...cfg.estilos, boton: { ...boton, ...patch } } });
  return (
    <>
      <p className="hint" style={{ margin: '0 0 10px' }}>Los dados son el centro del juego. El material no toca el RTP ni el tiro.</p>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>Material del dado</div>
      <SelectorPiel
        compact
        valor={cfg.dadoMaterial || 'marfil'}
        opciones={MATERIALES_DADO}
        onSet={(id) => onCfg({ dadoMaterial: id })}
      />
      <p className="hint" style={{ margin: '8px 0 12px' }}>Marfil es el clásico de casino. Oro y cromo son metal. Cristal y rubí se ven translúcidos.</p>

      <div style={{ borderTop: '1px solid var(--border-soft)', margin: '4px 0 10px' }} />
      <p className="hint" style={{ margin: '0 0 10px' }}>Carácter de los controles. Se ve al instante.</p>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>Zonas de apuesta</div>
      <Color etiqueta="Fondo normal" valor={zonas.fondo} onCambio={(fondo) => setZonas({ fondo })} />
      <Color etiqueta="Borde normal" valor={zonas.borde} onCambio={(borde) => setZonas({ borde })} />
      <Color etiqueta="Texto" valor={zonas.texto} onCambio={(texto) => setZonas({ texto })} />
      <Color etiqueta="Acento / Lucky 7" valor={zonas.acento} onCambio={(acento) => setZonas({ acento })} />
      <Color etiqueta="Seleccionada" valor={zonas.seleccionado} onCambio={(seleccionado) => setZonas({ seleccionado })} />
      <Color etiqueta="Ganadora" valor={zonas.gana} onCambio={(gana) => setZonas({ gana })} />
      <Color etiqueta="Perdedora" valor={zonas.pierde} onCambio={(pierde) => setZonas({ pierde })} />
      <Rango etiqueta="Redondez" min={0} max={30} unidad=" px" valor={zonas.radio} onInput={(radio) => setZonas({ radio })} />
      <Rango etiqueta="Sombra activa" min={0} max={100} unidad="%" valor={zonas.sombra} onInput={(sombra) => setZonas({ sombra })} />
      <Rango etiqueta="Escala de texto" min={70} max={145} valor={zonas.escala} onInput={(escala) => setZonas({ escala })} />

      <div style={{ borderTop: '1px solid var(--border-soft)', margin: '14px 0 10px' }} />
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>Botón de tirar</div>
      <Color etiqueta="Fondo activo" valor={boton.fondo} onCambio={(fondo) => setBoton({ fondo })} />
      <Color etiqueta="Texto" valor={boton.texto} onCambio={(texto) => setBoton({ texto })} />
      <Color etiqueta="Borde" valor={boton.borde} onCambio={(borde) => setBoton({ borde })} />
      <Color etiqueta="Bloqueado" valor={boton.bloqueado} onCambio={(bloqueado) => setBoton({ bloqueado })} />
      <Rango etiqueta="Redondez" min={0} max={30} unidad=" px" valor={boton.radio} onInput={(radio) => setBoton({ radio })} />
      <Rango etiqueta="Sombra" min={0} max={100} unidad="%" valor={boton.sombra} onInput={(sombra) => setBoton({ sombra })} />
      <Rango etiqueta="Escala de texto" min={70} max={145} valor={boton.escala} onInput={(escala) => setBoton({ escala })} />
    </>
  );
}

// ---------------- Pestaña Piezas ----------------

function TabPiezas({
  pos, seleccion, onSelPieza, onPos, mostrarNombre, onToggleNombre,
  editor, onEditor, puedeDeshacer, puedeRehacer, onDeshacer, onRehacer,
}: {
  pos: PosControlesSieteUd;
  seleccion: ElemId;
  onSelPieza: (id: ElemId) => void;
  onPos: (pos: PosControlesSieteUd) => void;
  mostrarNombre: boolean;
  onToggleNombre: (v: boolean) => void;
  editor: SieteUdCfg['editor'];
  onEditor: (editor: SieteUdCfg['editor']) => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
}) {
  const meta = PIEZAS_SIETEUD.find((p) => p.id === seleccion)!;
  const v = pos[seleccion] as unknown as Record<string, number>;
  const bloqueada = editor.bloqueadas.includes(seleccion);
  const set = (prop: string, n: number) => {
    if (bloqueada) return;
    onPos({ ...pos, [seleccion]: { ...(pos[seleccion] as object), [prop]: n } });
  };
  const alternar = (clave: 'ocultas' | 'bloqueadas', id: ElemId) => {
    const actual = editor[clave];
    onEditor({ ...editor, [clave]: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] });
  };
  const alinear = (eje: 'x' | 'y') => set(eje, 50);
  const restablecer = () => onPos(Object.fromEntries(
    PIEZAS_SIETEUD.map((p) => [p.id, editor.bloqueadas.includes(p.id) ? pos[p.id] : CONTROLES_SIETEUD_DEFAULT[p.id]]),
  ) as unknown as PosControlesSieteUd);

  return (
    <>
      <p className="hint" style={{ margin: '0 0 8px' }}>Arrastrá las piezas sobre la grilla. Los cambios se guardan solos.</p>
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        <button title="Deshacer" disabled={!puedeDeshacer} onClick={onDeshacer} style={{ flex: 1, padding: '6px 3px', fontSize: 11 }}>↶ Deshacer</button>
        <button title="Rehacer" disabled={!puedeRehacer} onClick={onRehacer} style={{ flex: 1, padding: '6px 3px', fontSize: 11 }}>Rehacer ↷</button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, marginBottom: 10 }}>
        <input type="checkbox" checked={editor.snap} onChange={(e) => onEditor({ ...editor, snap: e.target.checked })} />
        Ajustar a la grilla
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 10 }}>
        <input type="checkbox" checked={mostrarNombre} onChange={(e) => onToggleNombre(e.target.checked)} />
        Mostrar el nombre del juego arriba
      </label>
      <div style={{ fontSize: 11, fontWeight: 600, margin: '10px 0 5px' }}>Capas</div>
      <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        {PIEZAS_SIETEUD.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 7, background: p.id === seleccion ? 'var(--accent-soft)' : 'var(--surface-alt)', border: `1px solid ${p.id === seleccion ? 'var(--accent)' : 'var(--border-soft)'}` }}>
            <button onClick={() => onSelPieza(p.id)} style={{ flex: 1, textAlign: 'left', padding: '5px 6px', border: 0, background: 'transparent', fontSize: 11, color: p.id === seleccion ? 'var(--accent)' : 'var(--text)' }}>{p.etiqueta}</button>
            <button aria-label={editor.ocultas.includes(p.id) ? 'Mostrar capa' : 'Ocultar capa'} title={editor.ocultas.includes(p.id) ? 'Mostrar capa' : 'Ocultar capa'} onClick={() => alternar('ocultas', p.id)} style={{ padding: '4px 5px', border: 0, background: 'transparent', fontSize: 12 }}>{editor.ocultas.includes(p.id) ? '○' : '◉'}</button>
            <button aria-label={editor.bloqueadas.includes(p.id) ? 'Desbloquear capa' : 'Bloquear capa'} title={editor.bloqueadas.includes(p.id) ? 'Desbloquear capa' : 'Bloquear capa'} onClick={() => alternar('bloqueadas', p.id)} style={{ padding: '4px 5px', border: 0, background: 'transparent', fontSize: 12 }}>{editor.bloqueadas.includes(p.id) ? '🔒' : '🔓'}</button>
          </div>
        ))}
      </div>
      {bloqueada && <p className="hint" style={{ margin: '0 0 8px' }}>🔒 Esta pieza está bloqueada — desbloqueala en Capas para moverla.</p>}
      <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
        <button disabled={bloqueada} onClick={() => alinear('x')} style={{ flex: 1, padding: '6px 3px', fontSize: 11 }}>Centrar X</button>
        <button disabled={bloqueada} onClick={() => alinear('y')} style={{ flex: 1, padding: '6px 3px', fontSize: 11 }}>Centrar Y</button>
      </div>
      <Rango etiqueta="Posición X" min={0} max={100} valor={Math.round(v.x)} onInput={(n) => set('x', n)} disabled={bloqueada} />
      <Rango etiqueta="Posición Y" min={0} max={100} valor={Math.round(v.y)} onInput={(n) => set('y', n)} disabled={bloqueada} />
      {(meta.tipo === 'caja' || meta.tipo === 'ancho') && (
        <Rango etiqueta="Ancho" min={20} max={100} unidad="%" valor={Math.round(v.w)} onInput={(n) => set('w', n)} disabled={bloqueada} />
      )}
      {meta.tipo === 'caja' && (
        <Rango etiqueta="Alto" min={10} max={80} unidad="%" valor={Math.round(v.h)} onInput={(n) => set('h', n)} disabled={bloqueada} />
      )}
      {meta.tipo !== 'caja' && (
        <Rango etiqueta="Tamaño" min={50} max={220} unidad="%" valor={Math.round((v.escala ?? 1) * 100)} onInput={(n) => set('escala', n / 100)} disabled={bloqueada} />
      )}
      <button style={{ width: '100%', marginTop: 12, fontSize: 12 }} onClick={restablecer}>Restablecer posiciones</button>
    </>
  );
}

// ---------------- Pestaña Imágenes ----------------

function TabImagenes({ juego, cfg, onCfg, onArte }: {
  juego: Juego; cfg: SieteUdCfg;
  onCfg: (patch: Partial<SieteUdCfg>) => void;
  onArte: (k: ImgKey, patch: Partial<AjusteImg>) => void;
}) {
  const [abierto, setAbierto] = useState<ImgKey | null>(null);

  const subir = async (k: ImgKey, file: File) => {
    const url = await subirArchivo(file, `sieteud/${juego.id}`);
    if (url) onCfg({ [CAMPO_IMG[k]]: url } as Partial<SieteUdCfg>);
  };

  const slot = (k: ImgKey, etiqueta: string, sub: string, encuadre: boolean) => {
    const url = cfg[CAMPO_IMG[k]] as string | null;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, border: '1px dashed var(--border)', borderRadius: 10, background: 'var(--surface-alt)' }}>
          <div style={{ width: 44, height: 36, borderRadius: 7, border: '1px solid var(--border)', flexShrink: 0, background: url ? `center/cover no-repeat url("${url}")` : 'var(--bg)', display: 'grid', placeItems: 'center', fontSize: 14 }}>{url ? '' : '🖼️'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 12, display: 'block' }}>{etiqueta}</b>
            <span className="hint" style={{ margin: 0, fontSize: 10 }}>{sub}</span>
          </div>
          {url && <button style={{ fontSize: 11 }} onClick={() => setAbierto((a) => (a === k ? null : k))}>{abierto === k ? '▲' : 'Retoque'}</button>}
          <label className="add-sym" style={{ flexShrink: 0, fontSize: 11 }}>
            {url ? 'Cambiar' : 'Subir'}
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(k, f); }} />
          </label>
          {url && <button style={{ fontSize: 11, color: 'var(--danger)' }} onClick={() => onCfg({ [CAMPO_IMG[k]]: null } as Partial<SieteUdCfg>)}>✕</button>}
        </div>
        {url && abierto === k && <Retoque a={cfg.arte[k]} encuadre={encuadre} onSet={(p) => onArte(k, p)} />}
      </div>
    );
  };

  return (
    <>
      <p className="hint" style={{ margin: '0 0 10px' }}>Todo opcional. Los fondos siempre cubren la pantalla — el retoque sólo panea, agranda, desenfoca y oscurece.</p>
      {slot('pantalla', 'Fondo de pantalla', 'detrás de todo', false)}
      {slot('mesa', 'Fondo de la mesa (fieltro)', 'donde caen los dados', false)}
      <label style={{ fontSize: 12, display: 'block', margin: '2px 0 2px' }}>
        Velo sobre el fieltro <b>{Math.round(cfg.velo * 100)}%</b>
        <span className="hint" style={{ margin: 0 }}> — más velo, los dados se leen mejor</span>
      </label>
      <input type="range" min={10} max={95} value={Math.round(cfg.velo * 100)}
        onChange={(e) => onCfg({ velo: Number(e.target.value) / 100 })} style={{ width: '100%', margin: '2px 0 12px' }} />
      {slot('cartel', 'Cartel de premio', 'aparece al ganar', true)}
      {slot('boton', 'Imagen del botón', 'reemplaza el botón de color', true)}
    </>
  );
}

function Retoque({ a, encuadre, onSet }: {
  a: AjusteImg; encuadre: boolean; onSet: (patch: Partial<AjusteImg>) => void;
}) {
  return (
    <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
      {encuadre && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Encuadre</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {FIT_OPC.map((o) => (
              <button key={o.v} onClick={() => onSet({ fit: o.v })} className={a.fit === o.v ? 'primary' : undefined}
                style={{ fontSize: 11, flex: 1, padding: '4px 0' }}>{o.t}</button>
            ))}
          </div>
        </>
      )}
      <Rango etiqueta="Posición X" min={-50} max={150} valor={Math.round(a.x)} onInput={(n) => onSet({ x: n })} />
      <Rango etiqueta="Posición Y" min={-50} max={150} valor={Math.round(a.y)} onInput={(n) => onSet({ y: n })} />
      <Rango etiqueta="Zoom" min={100} max={400} unidad="%" valor={Math.round(a.zoom)} onInput={(n) => onSet({ zoom: n })} />
      <Rango etiqueta="Desenfoque" min={0} max={30} unidad="px" valor={Math.round(a.blur)} onInput={(n) => onSet({ blur: n })} />
      <Rango etiqueta="Oscurecer" min={0} max={90} unidad="%" valor={Math.round(a.osc)} onInput={(n) => onSet({ osc: n })} />
    </div>
  );
}

// ---------------- Pestaña Juego ----------------

function TabJuego({ cfg, onCfg }: { cfg: SieteUdCfg; onCfg: (patch: Partial<SieteUdCfg>) => void }) {
  const probs = _probs(cfg.caras) as Record<ZonaSieteUd, number>;
  const setPago = (z: ZonaSieteUd, val: string) => {
    const n = parseFloat(val.replace(',', '.'));
    const pagos = { ...cfg.pagos };
    pagos[z] = (val.trim() === '' || Number.isNaN(n) || n <= 1) ? null : Math.round(n * 100) / 100;
    onCfg({ pagos });
  };

  return (
    <>
      <p className="hint" style={{ margin: '0 0 10px' }}>Pago por zona = <code>rtp ÷ P(zona)</code>. El retorno esperado es el mismo elijas la zona que elijas.</p>
      <Rango etiqueta="RTP objetivo" min={85} max={99} step={0.5} unidad="%" valor={Number((cfg.rtp * 100).toFixed(1))}
        onInput={(n) => onCfg({ rtp: n / 100 })} />
      <Rango etiqueta="Caras por dado" min={4} max={10} unidad="" valor={cfg.caras}
        onInput={(n) => onCfg({ caras: n, pagos: { abajo: null, siete: null, arriba: null } })} />
      <p className="hint" style={{ margin: '2px 0 6px' }}>6 = dado normal. Con menos de 6 puede no haber ningún 7.</p>

      <div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 6px' }}>Pagos por zona</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 66px 56px', gap: 6, alignItems: 'center', fontSize: 11, fontFamily: 'monospace' }}>
        <span className="hint" style={{ margin: 0 }}>zona</span>
        <span className="hint" style={{ margin: 0, textAlign: 'center' }}>pago ×</span>
        <span className="hint" style={{ margin: 0, textAlign: 'right' }}>RTP</span>
        {ZONAS.map((z) => {
          const p = probs[z] || 0;
          return (
            <div key={z} style={{ display: 'contents' }}>
              <span>{ZONA_INFO[z].nombre} <span className="hint" style={{ margin: 0 }}>{(p * 100).toFixed(1)}%</span></span>
              <input
                key={`${z}-${cfg.caras}-${cfg.pagos[z] ?? 'x'}`}
                defaultValue={cfg.pagos[z] != null ? String(cfg.pagos[z]) : ''}
                placeholder={p > 0 ? (cfg.rtp / p).toFixed(2) : '—'}
                onBlur={(e) => setPago(z, e.target.value)}
                style={{ width: '100%', textAlign: 'center', fontSize: 11 }} />
              <span style={{ textAlign: 'right', color: 'var(--ok)' }}>
                {p > 0 ? ((_rtpZona(cfg, z) as number) * 100).toFixed(0) + '%' : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <button className="linkbtn" style={{ marginTop: 8, background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 11, padding: 0 }}
        onClick={() => onCfg({ pagos: { abajo: null, siete: null, arriba: null } })}>Volver a pagos exactos por RTP</button>

      <div style={{ fontSize: 12, fontWeight: 600, margin: '14px 0 6px' }}>Tema</div>
      <SelectorPiel
        compact
        valor={cfg.tema}
        opciones={TEMAS_INSTANT.map((t) => ({ id: t.id, nombre: t.nombre, colores: [t.acento] }))}
        onSet={(id) => onCfg({ tema: id })}
      />
      <p className="hint" style={{ margin: '8px 0 0' }}>{`Pago actual: 7 abajo ${(_pagoRaw(cfg, 'abajo') as number).toFixed(2)}× · Lucky 7 ${(_pagoRaw(cfg, 'siete') as number).toFixed(2)}× · 7 arriba ${(_pagoRaw(cfg, 'arriba') as number).toFixed(2)}×`}</p>
    </>
  );
}
