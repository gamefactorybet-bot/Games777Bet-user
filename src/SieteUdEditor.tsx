import { useState } from 'react';
import { supabase } from './supabase.ts';
import { subirArchivo } from './juego/subir.ts';
import { Rango } from './AjustePanel.tsx';
import { TEMAS as TEMAS_INSTANT } from './juego/instant-temas.ts';
import { probsZonas as _probs, rtpZona as _rtpZona, pagoRaw as _pagoRaw } from '../motor/sieteud.js';
import {
  PIEZAS_SIETEUD, CONTROLES_SIETEUD_DEFAULT, FIT_OPC, ZONA_INFO, ZONAS,
} from './juego/sieteud.ts';
import type { AjusteImg, Juego, PosControlesSieteUd, SieteUdCfg, ZonaSieteUd } from './types.ts';

type ElemId = keyof PosControlesSieteUd;
type ImgKey = 'pantalla' | 'mesa' | 'cartel' | 'boton';
type Pestana = 'piezas' | 'imagenes' | 'juego';

const CAMPO_IMG: Record<ImgKey, 'fondoPantallaUrl' | 'fondoUrl' | 'cartelUrl' | 'botonImg'> = {
  pantalla: 'fondoPantallaUrl', mesa: 'fondoUrl', cartel: 'cartelUrl', boton: 'botonImg',
};

// Toda la edición de 7 Up 7 Down en un panel, dentro de la Vista previa.
export function SieteUdEditor({
  juego, cfg, pos, seleccion, onSelPieza, onCfg, onArte, onPos,
  puedeDeshacer, puedeRehacer, onDeshacer, onRehacer,
}: {
  juego: Juego;
  cfg: SieteUdCfg;
  pos: PosControlesSieteUd;
  seleccion: ElemId;
  onSelPieza: (id: ElemId) => void;
  onCfg: (patch: Partial<SieteUdCfg>) => void;
  onArte: (k: ImgKey, patch: Partial<AjusteImg>) => void;
  onPos: (pos: PosControlesSieteUd) => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
}) {
  const [tab, setTab] = useState<Pestana>('piezas');
  const [mostrarNombre, setMostrarNombre] = useState((juego.mostrar_nombre ?? true) as boolean);

  const toggleNombre = async (v: boolean) => {
    setMostrarNombre(v);
    await supabase.from('juegos').update({ mostrar_nombre: v }).eq('id', juego.id);
    (juego as { mostrar_nombre?: boolean }).mostrar_nombre = v;
  };

  return (
    <div className="card" style={{ width: 270, maxWidth: '92vw', maxHeight: 'min(860px, 92vh)', overflow: 'auto', position: 'relative', zIndex: 50 }}>
      <div className="grupo-nav" style={{ marginBottom: 12 }}>
        {([['piezas', 'Piezas'], ['imagenes', 'Imágenes'], ['juego', 'Juego']] as const).map(([id, t]) => (
          <button key={id} className={`grupo-btn ${tab === id ? 'on' : ''}`}
            style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setTab(id)}>{t}</button>
        ))}
      </div>

      {tab === 'piezas' && (
        <TabPiezas
          pos={pos} seleccion={seleccion} onSelPieza={onSelPieza} onPos={onPos}
          mostrarNombre={mostrarNombre} onToggleNombre={toggleNombre}
          editor={cfg.editor} onEditor={(editor) => onCfg({ editor })}
          puedeDeshacer={puedeDeshacer} puedeRehacer={puedeRehacer} onDeshacer={onDeshacer} onRehacer={onRehacer}
        />
      )}
      {tab === 'imagenes' && <TabImagenes juego={juego} cfg={cfg} onCfg={onCfg} onArte={onArte} />}
      {tab === 'juego' && <TabJuego cfg={cfg} onCfg={onCfg} />}
    </div>
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
  const set = (prop: string, n: number) => onPos({ ...pos, [seleccion]: { ...(pos[seleccion] as object), [prop]: n } });
  const alternar = (clave: 'ocultas' | 'bloqueadas', id: ElemId) => {
    const actual = editor[clave];
    onEditor({ ...editor, [clave]: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] });
  };
  const alinear = (eje: 'x' | 'y') => set(eje, 50);

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
            <button title={editor.ocultas.includes(p.id) ? 'Mostrar capa' : 'Ocultar capa'} onClick={() => alternar('ocultas', p.id)} style={{ padding: '4px 5px', border: 0, background: 'transparent', fontSize: 12 }}>{editor.ocultas.includes(p.id) ? '○' : '◉'}</button>
            <button title={editor.bloqueadas.includes(p.id) ? 'Desbloquear capa' : 'Bloquear capa'} onClick={() => alternar('bloqueadas', p.id)} style={{ padding: '4px 5px', border: 0, background: 'transparent', fontSize: 12 }}>{editor.bloqueadas.includes(p.id) ? '🔒' : '🔓'}</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
        <button onClick={() => alinear('x')} style={{ flex: 1, padding: '6px 3px', fontSize: 11 }}>Centrar X</button>
        <button onClick={() => alinear('y')} style={{ flex: 1, padding: '6px 3px', fontSize: 11 }}>Centrar Y</button>
      </div>
      <Rango etiqueta="Posición X" min={0} max={100} valor={Math.round(v.x)} onInput={(n) => set('x', n)} />
      <Rango etiqueta="Posición Y" min={0} max={100} valor={Math.round(v.y)} onInput={(n) => set('y', n)} />
      {(meta.tipo === 'caja' || meta.tipo === 'ancho') && (
        <Rango etiqueta="Ancho" min={20} max={100} unidad="%" valor={Math.round(v.w)} onInput={(n) => set('w', n)} />
      )}
      {meta.tipo === 'caja' && (
        <Rango etiqueta="Alto" min={10} max={80} unidad="%" valor={Math.round(v.h)} onInput={(n) => set('h', n)} />
      )}
      {meta.tipo !== 'caja' && (
        <Rango etiqueta="Tamaño" min={50} max={220} unidad="%" valor={Math.round((v.escala ?? 1) * 100)} onInput={(n) => set('escala', n / 100)} />
      )}
      <button style={{ width: '100%', marginTop: 12, fontSize: 12 }}
        onClick={() => onPos({ ...CONTROLES_SIETEUD_DEFAULT })}>Restablecer posiciones</button>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 6 }}>
        {TEMAS_INSTANT.map((t) => {
          const on = (cfg.tema || 'clasico') === t.id;
          return (
            <button key={t.id} onClick={() => onCfg({ tema: t.id })} style={{
              display: 'flex', flexDirection: 'column', gap: 4, padding: 6, textAlign: 'left', borderRadius: 8, cursor: 'pointer', fontSize: 11,
              border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface-alt)',
            }}>
              <span style={{ display: 'block', height: 14, borderRadius: 4, background: t.acento }} />
              {t.nombre}
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ margin: '8px 0 0' }}>{`Pago actual: 7 abajo ${(_pagoRaw(cfg, 'abajo') as number).toFixed(2)}× · Lucky 7 ${(_pagoRaw(cfg, 'siete') as number).toFixed(2)}× · 7 arriba ${(_pagoRaw(cfg, 'arriba') as number).toFixed(2)}×`}</p>
    </>
  );
}
