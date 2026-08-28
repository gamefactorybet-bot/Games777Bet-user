import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import { subirArchivo } from './juego/subir.ts';
import { mostrarAnimacionJuego, detenerAnimacionesJuego } from './lottie.ts';
import { NOMBRE_CAPA, NIVELES_PREMIO } from './juego/defaults.ts';
import type { CapaId } from './juego/defaults.ts';
import type { Escenario } from './juego/escenario.ts';
import type { AnimacionLottie, CadenaLuz, CapaLibre, Juego, NivelPremio, Simbolo } from './types.ts';

// ---------------- Constantes de panel (de preview.js) ----------------

const CATEGORIAS_PANEL = [
  { id: 'capas', etiqueta: 'Capas', tabs: ['fondo_pantalla', 'marco', 'grilla', 'cartel'] },
  { id: 'extras', etiqueta: 'Extras', tabs: ['libres', 'luces', 'animaciones'] },
  { id: 'controles', etiqueta: 'Controles', tabs: ['girar', 'controles'] },
  { id: 'premio', etiqueta: 'Premio', tabs: ['premio'] },
] as const;

const ETIQUETA_CAPA: Record<string, string> = {
  fondo_pantalla: 'Fondo', marco: 'Marco', grilla: 'Grilla', cartel: 'Cartel',
  libres: 'Libres', luces: 'Luces', animaciones: 'Animaciones',
  girar: 'Girar', controles: 'Controles', premio: 'Premio',
};

type Campo = [clave: string, etiqueta: string, min: number, max: number];

const CAMPOS_POR_CAPA: Record<string, Campo[]> = {
  fondo_pantalla: [
    ['fondo_pantalla_x', 'Posición X', -20, 120], ['fondo_pantalla_y', 'Posición Y', -20, 120],
    ['fondo_pantalla_ancho', 'Ancho', 20, 250], ['fondo_pantalla_alto', 'Alto', 20, 250],
  ],
  cartel: [
    ['cartel_x', 'Posición X', -20, 120], ['cartel_y', 'Posición Y', -20, 120],
    ['cartel_ancho', 'Ancho', 10, 200], ['cartel_alto', 'Alto', 5, 150],
  ],
  grilla: [
    ['grilla_x', 'Posición X', -20, 120], ['grilla_y', 'Posición Y', -20, 120],
    ['grilla_tamano', 'Tamaño', 30, 100], ['grilla_icono_tamano', 'Tamaño del ícono', 20, 100],
  ],
  marco: [
    ['marco_x', 'Posición X', -50, 150], ['marco_y', 'Posición Y', -50, 150],
    ['marco_ancho', 'Ancho', 20, 250], ['marco_alto', 'Alto', 20, 250],
  ],
};

const FILTROS_POR_CAPA: Record<string, Campo[]> = {
  fondo_pantalla: [['fondo_pantalla_blur', 'Nitidez (blur)', 0, 20], ['fondo_pantalla_oscurecer', 'Oscurecer', 0, 100]],
  marco: [['marco_blur', 'Nitidez (blur)', 0, 20], ['marco_oscurecer', 'Oscurecer', 0, 100]],
  cartel: [['cartel_blur', 'Nitidez (blur)', 0, 20], ['cartel_oscurecer', 'Oscurecer', 0, 100]],
  grilla: [['fondo_blur', 'Nitidez del fondo del rodillo', 0, 20], ['fondo_oscurecer', 'Oscurecer fondo del rodillo', 0, 100]],
};

const PALETA_LUCES = ['#EF9F27', '#D85A30', '#378ADD', '#639922', '#D4537E', '#7F77DD', '#F09595', '#5DCAA5'];

const EVENTOS_ANIM = [
  { valor: 'intro', etiqueta: 'Intro (antes de la carga)', tope: 1 },
  { valor: 'girar', etiqueta: 'Al girar', tope: 2 },
  { valor: 'premio_chico', etiqueta: 'Premio chico', tope: 2 },
  { valor: 'premio_mayor', etiqueta: 'Premio mayor', tope: 2 },
];

const CLAVES_BOTON = [
  { clave: 'menos', etiqueta: '− (bajar apuesta)' },
  { clave: 'mas', etiqueta: '+ (subir apuesta)' },
  { clave: 'x1', etiqueta: 'x1' },
  { clave: 'x2', etiqueta: 'x2' },
  { clave: 'x3', etiqueta: 'x3' },
];

// ---------------- Slider genérico ----------------

function Rango({ etiqueta, min, max, step = 1, valor, unidad = '%', onInput }: {
  etiqueta: string; min: number; max: number; step?: number; valor: number; unidad?: string;
  onInput: (n: number) => void;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor]);
  return (
    <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
      {etiqueta} <span className="hint">{v}{unidad}</span>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { const n = Number(e.target.value); setV(n); onInput(n); }} />
    </label>
  );
}

function subtabStyle(activo: boolean) {
  return { flex: 1, fontSize: 11, borderColor: activo ? 'var(--accent)' : 'var(--border)', color: activo ? 'var(--accent)' : 'var(--text)' } as const;
}

// ---------------- Panel principal ----------------

interface AjustePanelProps {
  escenario: Escenario;
  juego: Juego;
  simbolos: Simbolo[];
  onGrillaCambio: () => void;
  /** Limita las categorías (Mines: solo 'capas' y 'extras'). */
  categorias?: string[];
  /** En Mines, la capa "grilla" es el tablero (otro nombre y rangos). */
  esMines?: boolean;
}

export function AjustePanel({ escenario, juego, onGrillaCambio, categorias, esMines }: AjustePanelProps) {
  const cats = CATEGORIAS_PANEL.filter((c) => !categorias || categorias.includes(c.id));
  const [categoria, setCategoria] = useState<string>(cats[0]?.id ?? 'capas');
  const [capa, setCapa] = useState<string>(cats[0]?.tabs[0] ?? 'grilla');
  const [, forzar] = useState(0);
  const redibujar = () => forzar((x) => x + 1);

  const cambiarCategoria = (id: string) => {
    setCategoria(id);
    setCapa(cats.find((c) => c.id === id)!.tabs[0]);
  };

  const etiquetaCapa = (t: string) => (esMines && t === 'grilla' ? 'Tablero' : ETIQUETA_CAPA[t]);

  const esCapa = ['fondo_pantalla', 'marco', 'grilla', 'cartel'].includes(capa);

  const guardarPosicion = async (msg: (t: string) => void) => {
    msg('Guardando...');
    const { error } = await supabase.from('juegos')
      .update({ ...escenario.pos, capas_orden: escenario.ordenCapas })
      .eq('id', juego.id);
    msg(error ? error.message : 'Guardado ✓');
    Object.assign(juego, escenario.pos, { capas_orden: escenario.ordenCapas });
  };

  return (
    <div className="card" style={{ width: 260, maxHeight: 'min(860px, 92vh)', overflow: 'auto', position: 'relative', zIndex: 50 }}>
      <strong>Ajustar posición</strong>
      <p className="hint" style={{ margin: '4px 0 10px' }}>Se ve en vivo a la izquierda.</p>

      <p style={{ fontWeight: 600, margin: '0 0 6px', fontSize: 13 }}>Estoy ajustando</p>
      <div className="cat-nav" style={{ marginBottom: 8 }}>
        {cats.map((c) => (
          <button key={c.id} className={`cat-btn ${c.id === categoria ? 'on' : ''}`}
            style={{ flex: '1 1 40%', fontSize: 12, justifyContent: 'center' }}
            onClick={() => cambiarCategoria(c.id)}>{c.etiqueta}</button>
        ))}
      </div>
      <div className="grupo-nav" style={{ marginBottom: 14 }}>
        {cats.find((c) => c.id === categoria)!.tabs.map((t) => (
          <button key={t} className={`grupo-btn ${t === capa ? 'on' : ''}`}
            style={{ flex: '1 1 30%', fontSize: 12, justifyContent: 'center' }}
            onClick={() => setCapa(t)}>{etiquetaCapa(t)}</button>
        ))}
      </div>

      <div className="fade-in">
        {capa === 'premio' && <PanelPremio escenario={escenario} juego={juego} />}
        {capa === 'libres' && <PanelLibres escenario={escenario} juego={juego} redibujar={redibujar} />}
        {capa === 'animaciones' && <PanelAnimaciones escenario={escenario} juego={juego} />}
        {capa === 'luces' && <PanelLuces escenario={escenario} juego={juego} />}
        {capa === 'girar' && <PanelGirar escenario={escenario} juego={juego} />}
        {capa === 'controles' && <PanelControles escenario={escenario} juego={juego} />}
        {esCapa && <PanelCapa escenario={escenario} capa={capa} esMines={esMines} onGrillaCambio={onGrillaCambio} />}
      </div>

      {esCapa && (
        <>
          <OrdenCapas escenario={escenario} esMines={esMines} />
          <BotonGuardar texto="Guardar posición" onGuardar={guardarPosicion} />
        </>
      )}
    </div>
  );
}

// ---------------- Botón guardar con mensajito ----------------

function BotonGuardar({ texto, onGuardar }: { texto: string; onGuardar: (msg: (t: string) => void) => void | Promise<void> }) {
  const [msg, setMsg] = useState('');
  return (
    <>
      <button className="primary" style={{ width: '100%', marginTop: 14 }} onClick={() => onGuardar(setMsg)}>{texto}</button>
      <p className="hint">{msg}</p>
    </>
  );
}

// ---------------- Sliders de una de las cuatro capas ----------------

const CAMPOS_TABLERO_MINES: Campo[] = [
  ['grilla_x', 'Posición X', -20, 120], ['grilla_y', 'Posición Y', -20, 120],
  ['grilla_tamano', 'Tamaño', 30, 100],
];

function PanelCapa({ escenario, capa, esMines, onGrillaCambio }: {
  escenario: Escenario; capa: string; esMines?: boolean; onGrillaCambio: () => void;
}) {
  const tableroMines = esMines && capa === 'grilla';
  const hayImagen: Record<string, boolean> = {
    fondo_pantalla: !!escenario.el.querySelector('[data-capa-img="fondo_pantalla"]'),
    grilla: true,
    marco: !!escenario.el.querySelector('[data-capa-img="marco"]'),
    cartel: !!escenario.el.querySelector('[data-capa-img="cartel"]'),
  };

  if (!hayImagen[capa]) {
    return <p className="hint">Este juego todavía no tiene {NOMBRE_CAPA[capa as CapaId].toLowerCase()}. Subilo desde el editor primero.</p>;
  }

  const aplicar = (clave: string, n: number) => {
    (escenario.pos as Record<string, number>)[clave] = n;
    escenario.aplicarPosiciones();
    escenario.aplicarFiltros();
    if (capa === 'grilla' && !escenario.girando) onGrillaCambio();
  };

  const campos = tableroMines ? CAMPOS_TABLERO_MINES : CAMPOS_POR_CAPA[capa];
  const filtros = tableroMines ? [] : FILTROS_POR_CAPA[capa];

  return (
    <>
      {campos.map(([clave, etiqueta, min, max]) => (
        <Rango key={clave} etiqueta={etiqueta} min={min} max={max}
          valor={(escenario.pos as Record<string, number>)[clave]}
          onInput={(n) => aplicar(clave, n)} />
      ))}
      {filtros.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '12px 0 8px' }}>Nitidez y oscurecimiento</p>
      )}
      {filtros.map(([clave, etiqueta, min, max]) => (
        <Rango key={clave} etiqueta={etiqueta} min={min} max={max} unidad={clave.includes('blur') ? 'px' : '%'}
          valor={(escenario.pos as Record<string, number>)[clave]}
          onInput={(n) => aplicar(clave, n)} />
      ))}
    </>
  );
}

function OrdenCapas({ escenario, esMines }: { escenario: Escenario; esMines?: boolean }) {
  const [, forzar] = useState(0);
  const mover = (i: number, dir: 1 | -1) => {
    const o = escenario.ordenCapas;
    [o[i], o[i + dir]] = [o[i + dir], o[i]];
    escenario.aplicarOrden();
    forzar((x) => x + 1);
  };
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
      <p style={{ fontWeight: 600, margin: '0 0 4px', fontSize: 13 }}>Orden de capas</p>
      <p className="hint" style={{ margin: '0 0 8px' }}>De atrás hacia adelante. La de arriba de la lista es la más al fondo.</p>
      {escenario.ordenCapas.map((c, i) => (
        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 8px', marginBottom: 4 }}>
          <span style={{ flex: 1, fontSize: 12 }}>{esMines && c === 'grilla' ? 'Tablero' : NOMBRE_CAPA[c]}</span>
          <button aria-label="Subir" disabled={i === escenario.ordenCapas.length - 1} style={{ padding: '2px 8px' }} onClick={() => mover(i, 1)}>↑</button>
          <button aria-label="Bajar" disabled={i === 0} style={{ padding: '2px 8px' }} onClick={() => mover(i, -1)}>↓</button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Premio (por nivel) ----------------

const CAMPOS_PREMIO: [string, string, number, number, string][] = [
  ['x', 'Posición X', -20, 120, '%'], ['y', 'Posición Y', -20, 120, '%'],
  ['ancho', 'Ancho', 15, 150, '%'], ['alto', 'Alto', 10, 100, '%'],
  ['blur', 'Nitidez (blur)', 0, 20, 'px'], ['oscurecer', 'Oscurecer', 0, 100, '%'],
  ['imagen_x', 'Posición X', -20, 120, '%'], ['imagen_y', 'Posición Y', -20, 120, '%'], ['imagen_tamano', 'Tamaño', 15, 150, '%'],
  ['monto_x', 'Posición X', -20, 120, '%'], ['monto_y', 'Posición Y', -20, 120, '%'],
  ['monto_alto', 'Alto', 16, 80, 'px'], ['monto_espaciado', 'Espaciado', 0, 16, 'px'],
];

function PanelPremio({ escenario, juego }: { escenario: Escenario; juego: Juego }) {
  const [nivel, setNivel] = useState<NivelPremio>('dos_iguales');
  const [, forzar] = useState(0);
  const p = escenario.posPremio[nivel];

  const cambiarNivel = (n: NivelPremio) => { setNivel(n); escenario.aplicarPosicionPremio(n); };

  const slider = (campo: string, etiqueta: string, min: number, max: number, unidad: string) => (
    <Rango key={campo} etiqueta={etiqueta} min={min} max={max} unidad={unidad}
      valor={(p as unknown as Record<string, number>)[campo]}
      onInput={(v) => { (p as unknown as Record<string, number>)[campo] = v; escenario.aplicarPosicionPremio(nivel); }} />
  );

  const subir = async (f: File) => {
    const url = await subirArchivo(f, `premios/${juego.id}`);
    if (url) { p.imagen_url = url; escenario.aplicarPosicionPremio(nivel); forzar((x) => x + 1); }
  };

  const guardar = async (msg: (t: string) => void) => {
    msg('Guardando...');
    const { data, error } = await supabase.from('premios_visuales').upsert({
      id: p.id || undefined, juego_id: juego.id, nivel_premio: nivel,
      imagen_url: p.imagen_url, x: p.x, y: p.y, ancho: p.ancho, alto: p.alto,
      blur: p.blur, oscurecer: p.oscurecer,
      imagen_x: p.imagen_x, imagen_y: p.imagen_y, imagen_tamano: p.imagen_tamano,
      monto_x: p.monto_x, monto_y: p.monto_y, monto_alto: p.monto_alto, monto_espaciado: p.monto_espaciado,
    }, { onConflict: 'juego_id,nivel_premio' }).select().single();
    if (error) { msg(error.message); return; }
    p.id = (data as { id: string }).id;
    msg('Guardado ✓');
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {NIVELES_PREMIO.map((n) => (
          <button key={n.valor} style={subtabStyle(n.valor === nivel)} onClick={() => cambiarNivel(n.valor)}>{n.etiqueta}</button>
        ))}
      </div>

      <label style={{ display: 'block', aspectRatio: '2', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
        {p.imagen_url
          ? <img src={p.imagen_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>Subir imagen</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
      </label>

      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px' }}>Cuadro</p>
      {CAMPOS_PREMIO.slice(0, 4).map(([c, e, mi, ma, u]) => slider(c, e, mi, ma, u))}
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Nitidez y oscurecimiento</p>
      {CAMPOS_PREMIO.slice(4, 6).map(([c, e, mi, ma, u]) => slider(c, e, mi, ma, u))}
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Imagen (independiente del cuadro)</p>
      {CAMPOS_PREMIO.slice(6, 9).map(([c, e, mi, ma, u]) => slider(c, e, mi, ma, u))}
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Monto ganado (independiente de la imagen)</p>
      {CAMPOS_PREMIO.slice(9).map(([c, e, mi, ma, u]) => slider(c, e, mi, ma, u))}

      <button style={{ width: '100%', marginTop: 6 }} onClick={() => escenario.mostrarPremio(123000, nivel)}>Probar</button>
      <BotonGuardar texto="Guardar este nivel" onGuardar={guardar} />
    </>
  );
}

// ---------------- Imágenes libres ----------------

function PanelLibres({ escenario, juego, redibujar }: { escenario: Escenario; juego: Juego; redibujar: () => void }) {
  const [lista, setLista] = useState<CapaLibre[]>(() => escenario.capasLibres);
  const [actualId, setActualId] = useState<string | null>(lista[0]?.id ?? null);
  const [, forzar] = useState(0);
  const actual = lista.find((c) => c.id === actualId);

  const sincronizar = (next: CapaLibre[]) => { setLista(next); escenario.capasLibres = next; };

  const agregar = async () => {
    const { data, error } = await supabase.from('capas_libres')
      .insert({ juego_id: juego.id, x: 50, y: 50, tamano: 40, angulo: 0, blur: 0, oscurecer: 0, orden: lista.length })
      .select().single();
    if (error) { alert(error.message); return; }
    sincronizar([...lista, data as CapaLibre]);
    setActualId((data as CapaLibre).id);
    escenario.aplicarCapasLibres();
  };

  const slider = (campo: keyof CapaLibre, etiqueta: string, min: number, max: number, unidad: string) => actual && (
    <Rango key={campo as string} etiqueta={etiqueta} min={min} max={max} unidad={unidad} valor={actual[campo] as number}
      onInput={(v) => { (actual as unknown as Record<string, unknown>)[campo] = v; escenario.aplicarCapasLibres(); }} />
  );

  const subir = async (f: File) => {
    if (!actual) return;
    const url = await subirArchivo(f, `libres/${juego.id}`);
    if (url) { actual.imagen_url = url; escenario.aplicarCapasLibres(); forzar((x) => x + 1); }
  };

  const guardar = async (msg: (t: string) => void) => {
    if (!actual) return;
    msg('Guardando...');
    const { error } = await supabase.from('capas_libres').update({
      x: actual.x, y: actual.y, tamano: actual.tamano, angulo: actual.angulo,
      blur: actual.blur, oscurecer: actual.oscurecer, imagen_url: actual.imagen_url,
    }).eq('id', actual.id);
    msg(error ? error.message : 'Guardado ✓');
  };

  const quitar = async () => {
    if (!actual || !confirm('¿Quitar esta imagen?')) return;
    await supabase.from('capas_libres').delete().eq('id', actual.id);
    const next = lista.filter((c) => c.id !== actual.id);
    sincronizar(next);
    setActualId(next[0]?.id ?? null);
    escenario.aplicarCapasLibres();
    redibujar();
  };

  return (
    <>
      <ChipsAgregar
        items={lista.map((c, i) => ({ id: c.id, etiqueta: `Imagen ${i + 1}` }))}
        actualId={actualId} onSelect={setActualId} onAgregar={agregar}
      />
      {!actual && <p className="hint">Todavía no agregaste ninguna imagen.</p>}
      {actual && (
        <>
          <label style={{ display: 'block', aspectRatio: '1', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
            {actual.imagen_url
              ? <img src={actual.imagen_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>Subir imagen</span>}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
          </label>
          {slider('x', 'Posición X', -20, 120, '%')}
          {slider('y', 'Posición Y', -20, 120, '%')}
          {slider('tamano', 'Tamaño', 10, 150, '%')}
          {slider('angulo', 'Ángulo', -180, 180, '°')}
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Nitidez y oscurecimiento</p>
          {slider('blur', 'Nitidez (blur)', 0, 20, 'px')}
          {slider('oscurecer', 'Oscurecer', 0, 100, '%')}
          <BotonGuardar texto="Guardar" onGuardar={guardar} />
          <button style={{ width: '100%', marginTop: 8, color: 'var(--danger)' }} onClick={quitar}>Quitar esta imagen</button>
        </>
      )}
    </>
  );
}

// ---------------- Animaciones Lottie del juego ----------------

function PanelAnimaciones({ escenario, juego }: { escenario: Escenario; juego: Juego }) {
  const [lista, setLista] = useState<AnimacionLottie[]>(() => escenario.animaciones);
  const [actualId, setActualId] = useState<string | null>(lista[0]?.id ?? null);
  const [, forzar] = useState(0);
  const actual = lista.find((a) => a.id === actualId);

  const sincronizar = (next: AnimacionLottie[]) => { setLista(next); escenario.animaciones = next; };

  const agregar = async () => {
    const { data, error } = await supabase.from('animaciones_lottie')
      .insert({ juego_id: juego.id, orden: lista.length }).select().single();
    if (error) { alert(error.message); return; }
    sincronizar([...lista, data as AnimacionLottie]);
    setActualId((data as AnimacionLottie).id);
  };

  const cuantasEn = (ev: string) => lista.filter((a) => a.evento === ev && a.id !== actual?.id).length;
  const evActual = actual && EVENTOS_ANIM.find((e) => e.valor === actual.evento);
  const pasado = evActual && cuantasEn(actual!.evento) >= evActual.tope;

  const subir = async (f: File) => {
    if (!actual) return;
    const url = await subirArchivo(f, `girar/${juego.id}`);
    if (url) { actual.lottie_url = url; forzar((x) => x + 1); }
  };

  const guardar = async (msg: (t: string) => void) => {
    if (!actual) return;
    msg('Guardando...');
    const { error } = await supabase.from('animaciones_lottie').update({
      evento: actual.evento, lottie_url: actual.lottie_url, x: actual.x, y: actual.y, tamano: actual.tamano,
    }).eq('id', actual.id);
    msg(error ? error.message : 'Guardado ✓');
  };

  const quitar = async () => {
    if (!actual || !confirm('¿Quitar esta animación?')) return;
    await supabase.from('animaciones_lottie').delete().eq('id', actual.id);
    const next = lista.filter((a) => a.id !== actual.id);
    sincronizar(next);
    setActualId(next[0]?.id ?? null);
    detenerAnimacionesJuego();
  };

  return (
    <>
      <ChipsAgregar
        items={lista.map((a, i) => ({ id: a.id, etiqueta: `${(EVENTOS_ANIM.find((e) => e.valor === a.evento)?.etiqueta || a.evento).split(' ')[0]} ${i + 1}` }))}
        actualId={actualId} onSelect={setActualId} onAgregar={agregar} textoAgregar="+ Agregar"
      />
      {!actual && <p className="hint">Todavía no agregaste ninguna animación.</p>}
      {actual && (
        <>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Cuándo se muestra
            <select style={{ width: '100%' }} value={actual.evento}
              onChange={(e) => { actual.evento = e.target.value as AnimacionLottie['evento']; forzar((x) => x + 1); }}>
              {EVENTOS_ANIM.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>
          </label>
          {pasado && <p className="hint" style={{ color: 'var(--danger)' }}>Ya hay {evActual!.tope} animación(es) en este evento. Más de eso puede tironear el giro en celulares.</p>}
          <label style={{ display: 'block', height: 56, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
            <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
              {actual.lottie_url ? 'Archivo cargado ✓ — tocá para reemplazar' : 'Subir animación (.json o .lottie)'}
            </span>
            <input type="file" accept=".json,.lottie" hidden onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
          </label>
          <Rango etiqueta="Posición X" min={0} max={100} valor={actual.x} onInput={(n) => { actual.x = n; }} />
          <Rango etiqueta="Posición Y" min={0} max={100} valor={actual.y} onInput={(n) => { actual.y = n; }} />
          <Rango etiqueta="Tamaño" min={10} max={140} valor={actual.tamano} onInput={(n) => { actual.tamano = n; }} />
          <button style={{ width: '100%', marginTop: 6 }} onClick={() => { detenerAnimacionesJuego(); mostrarAnimacionJuego(escenario.animRiveEl, actual); }}>Probar acá</button>
          <BotonGuardar texto="Guardar" onGuardar={guardar} />
          <button style={{ width: '100%', marginTop: 8, color: 'var(--danger)' }} onClick={quitar}>Quitar esta animación</button>
        </>
      )}
    </>
  );
}

// ---------------- Cadenas de luces ----------------

function PanelLuces({ escenario, juego }: { escenario: Escenario; juego: Juego }) {
  const [lista, setLista] = useState<CadenaLuz[]>(() => escenario.cadenasLuces);
  const [actualId, setActualId] = useState<string | null>(lista[0]?.id ?? null);
  const [, forzar] = useState(0);
  const redibujar = () => forzar((x) => x + 1);
  const actual = lista.find((c) => c.id === actualId);

  const sincronizar = (next: CadenaLuz[]) => { setLista(next); escenario.cadenasLuces = next; };

  const agregar = async () => {
    const { data, error } = await supabase.from('cadenas_luces')
      .insert({ juego_id: juego.id, orden: lista.length }).select().single();
    if (error) { alert(error.message); return; }
    sincronizar([...lista, data as CadenaLuz]);
    setActualId((data as CadenaLuz).id);
    escenario.reconstruirCadena(data as CadenaLuz);
  };

  // Defaults en memoria por si falta correr algún SQL de formas.
  useEffect(() => {
    if (!actual) return;
    actual.forma = actual.forma || 'circulo';
    actual.ancho = actual.ancho ?? actual.tamano ?? 11;
    actual.alto = actual.alto ?? actual.tamano ?? 11;
    if (!Array.isArray(actual.colores) || !actual.colores.length) actual.colores = ['#EF9F27', '#378ADD'];
    if (!Array.isArray(actual.puntos)) actual.puntos = [];
    actual.figura = actual.figura || 'rectangulo';
    actual.figura_x = actual.figura_x ?? 50; actual.figura_y = actual.figura_y ?? 50;
    actual.figura_ancho = actual.figura_ancho ?? 60; actual.figura_alto = actual.figura_alto ?? 30;
    actual.figura_rotacion = actual.figura_rotacion ?? 0;
    actual.glow = actual.glow ?? 14; actual.nucleo = actual.nucleo ?? 45;
    actual.apagado = actual.apagado ?? 18; actual.vidrio = actual.vidrio ?? true;
    escenario.reconstruirCadena(actual);
    activarArrastre(actual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  const activarArrastre = (c: CadenaLuz) => {
    escenario.desactivarArrastreLuces();
    if (c.modo !== 'libre') return;
    const wrap = escenario.cadenasLuzEl.querySelector<HTMLElement>(`[data-cadena="${c.id}"]`);
    if (!wrap) return;
    wrap.style.pointerEvents = 'auto';
    (c._dots || []).forEach((dot, i) => {
      dot.style.pointerEvents = 'auto';
      dot.style.cursor = 'grab';
      dot.addEventListener('pointerdown', (e) => {
        dot.setPointerCapture(e.pointerId);
        const mover = (ev: PointerEvent) => {
          const r = escenario.el.getBoundingClientRect();
          const escala = r.width / 420;
          c.puntos[i] = {
            x: Math.max(0, Math.min(100, (ev.clientX - r.left) / escala / 420 * 100)),
            y: Math.max(0, Math.min(100, (ev.clientY - r.top) / escala / 860 * 100)),
          };
          dot.style.left = c.puntos[i].x + '%';
          dot.style.top = c.puntos[i].y + '%';
        };
        dot.addEventListener('pointermove', mover);
        dot.addEventListener('pointerup', () => dot.removeEventListener('pointermove', mover), { once: true });
      });
    });
  };

  const set = (campo: keyof CadenaLuz, valor: unknown, reconstruir = false) => {
    if (!actual) return;
    (actual as Record<string, unknown>)[campo] = valor;
    if (reconstruir) { escenario.reconstruirCadena(actual); activarArrastre(actual); }
    redibujar();
  };

  const guardar = async (msg: (t: string) => void) => {
    if (!actual) return;
    msg('Guardando...');
    const { error } = await supabase.from('cadenas_luces').update({
      modo: actual.modo, cantidad: actual.cantidad, tamano: actual.tamano,
      forma: actual.forma, ancho: actual.ancho, alto: actual.alto,
      figura: actual.figura, figura_x: actual.figura_x, figura_y: actual.figura_y,
      figura_ancho: actual.figura_ancho, figura_alto: actual.figura_alto, figura_rotacion: actual.figura_rotacion,
      glow: actual.glow, nucleo: actual.nucleo, apagado: actual.apagado, vidrio: actual.vidrio,
      animacion: actual.animacion, velocidad: actual.velocidad,
      colores: actual.colores, puntos: actual.puntos,
    }).eq('id', actual.id);
    msg(error
      ? (/glow|nucleo|apagado|vidrio/.test(error.message) ? 'Falta correr el SQL 25_focos_realistas.sql en Supabase.'
        : /figura/.test(error.message) ? 'Falta correr el SQL 24_figura_luces.sql en Supabase.'
        : /forma|ancho|alto/.test(error.message) ? 'Falta correr el SQL 23_formas_luces.sql en Supabase.'
        : error.message)
      : 'Guardado ✓');
  };

  const quitar = async () => {
    if (!actual || !confirm('¿Quitar esta cadena de luces?')) return;
    await supabase.from('cadenas_luces').delete().eq('id', actual.id);
    escenario.cadenasLuzEl.querySelector(`[data-cadena="${actual.id}"]`)?.remove();
    const next = lista.filter((c) => c.id !== actual.id);
    sincronizar(next);
    setActualId(next[0]?.id ?? null);
  };

  return (
    <>
      <ChipsAgregar
        items={lista.map((c, i) => ({ id: c.id, etiqueta: `Cadena ${i + 1}` }))}
        actualId={actualId} onSelect={setActualId} onAgregar={agregar} textoAgregar="+ Agregar"
      />
      {!actual && <p className="hint">Todavía no agregaste ninguna cadena.</p>}
      {actual && (
        <>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Colocación
            <select style={{ width: '100%' }} value={actual.modo} onChange={(e) => set('modo', e.target.value, true)}>
              <option value="marco">Seguir el marco</option>
              <option value="figura">Figura propia</option>
              <option value="libre">Libre (arrastrar en la vista previa)</option>
            </select>
          </label>

          {actual.modo === 'figura' && (
            <>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Figura
                <select style={{ width: '100%' }} value={actual.figura} onChange={(e) => set('figura', e.target.value, true)}>
                  <option value="rectangulo">Rectángulo</option>
                  <option value="circulo">Círculo</option>
                  <option value="linea">Línea</option>
                </select>
              </label>
              <Rango etiqueta="Posición X" min={0} max={100} valor={actual.figura_x!} onInput={(n) => set('figura_x', n, true)} />
              <Rango etiqueta="Posición Y" min={0} max={100} valor={actual.figura_y!} onInput={(n) => set('figura_y', n, true)} />
              <Rango etiqueta="Ancho de la figura" min={5} max={120} valor={actual.figura_ancho!} onInput={(n) => set('figura_ancho', n, true)} />
              <Rango etiqueta="Alto de la figura" min={0} max={100} valor={actual.figura_alto!} onInput={(n) => set('figura_alto', n, true)} />
              <Rango etiqueta="Rotación" min={-180} max={180} unidad="°" valor={actual.figura_rotacion!} onInput={(n) => set('figura_rotacion', n, true)} />
            </>
          )}

          <Rango etiqueta="Cantidad de focos" min={2} max={40} unidad="" valor={actual.cantidad} onInput={(n) => set('cantidad', n, true)} />
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Forma del foco
            <select style={{ width: '100%' }} value={actual.forma} onChange={(e) => set('forma', e.target.value, true)}>
              <option value="circulo">Círculo</option><option value="cuadrado">Cuadrado</option>
              <option value="rombo">Rombo</option><option value="barra">Barra</option>
            </select>
          </label>
          <Rango etiqueta="Ancho" min={3} max={60} unidad="px" valor={actual.ancho!} onInput={(n) => set('ancho', n, true)} />
          <Rango etiqueta="Alto" min={3} max={60} unidad="px" valor={actual.alto!} onInput={(n) => set('alto', n, true)} />
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Animación
            <select style={{ width: '100%' }} value={actual.animacion} onChange={(e) => set('animacion', e.target.value)}>
              <option value="secuencial">Secuencial (uno tras otro)</option>
              <option value="sincronizado">Todos juntos</option>
              <option value="ola">Ola de color</option>
              <option value="alternado">Alternado (marquesina)</option>
              <option value="aleatorio">Parpadeo aleatorio</option>
              <option value="vaiven">Vaivén (ida y vuelta)</option>
            </select>
          </label>
          <Rango etiqueta="Velocidad" min={0.25} max={4} step={0.25} unidad="x" valor={actual.velocidad} onInput={(n) => set('velocidad', n)} />
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 6px' }}>Aspecto del foco</p>
          <Rango etiqueta="Resplandor" min={0} max={34} unidad="px" valor={actual.glow!} onInput={(n) => set('glow', n)} />
          <Rango etiqueta="Núcleo blanco" min={0} max={80} valor={actual.nucleo!} onInput={(n) => set('nucleo', n)} />
          <Rango etiqueta="Brillo apagado" min={0} max={60} valor={actual.apagado!} onInput={(n) => set('apagado', n)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 10 }}>
            <input type="checkbox" checked={!!actual.vidrio} onChange={(e) => set('vidrio', e.target.checked, true)} /> Reflejo de vidrio
          </label>

          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 6px' }}>Colores (1 a 8)</p>
          <Colores cadena={actual} redibujar={redibujar} />
          {actual.modo === 'libre' && <p className="hint" style={{ margin: '0 0 10px' }}>Arrastrá cada foco directo en la vista previa para acomodar la cadena.</p>}

          <BotonGuardar texto="Guardar" onGuardar={guardar} />
          <button style={{ width: '100%', marginTop: 8, color: 'var(--danger)' }} onClick={quitar}>Quitar esta cadena</button>
        </>
      )}
    </>
  );
}

function Colores({ cadena, redibujar }: { cadena: CadenaLuz; redibujar: () => void }) {
  const [, forzar] = useState(0);
  const cambio = () => { forzar((x) => x + 1); redibujar(); };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {cadena.colores.map((col, i) => (
        <button key={i} style={{ width: 26, height: 26, padding: 0, borderRadius: '50%', background: col }}
          onClick={() => { if (cadena.colores.length > 1) { cadena.colores.splice(i, 1); cambio(); } }} />
      ))}
      {cadena.colores.length < 8 && (
        <button style={{ width: 26, height: 26, padding: 0, fontSize: 14 }} onClick={() => {
          const usado = PALETA_LUCES.findIndex((c) => !cadena.colores.includes(c));
          cadena.colores.push(usado >= 0 ? PALETA_LUCES[usado] : PALETA_LUCES[cadena.colores.length % PALETA_LUCES.length]);
          cambio();
        }}>+</button>
      )}
    </div>
  );
}

// ---------------- Girar ----------------

function PanelGirar({ escenario, juego }: { escenario: Escenario; juego: Juego }) {
  const g = escenario.posGirar;
  const [, forzar] = useState(0);
  const [paso, setPaso] = useState(escenario.pasoApuesta);

  const subir = async (f: File) => {
    const url = await subirArchivo(f, `girar/${juego.id}`);
    if (url) { g.girar_imagen_url = url; escenario.aplicarGirar(); forzar((x) => x + 1); }
  };

  const guardar = async (msg: (t: string) => void) => {
    msg('Guardando...');
    const { error } = await supabase.from('juegos').update({
      girar_x: g.girar_x, girar_y: g.girar_y, girar_tamano: g.girar_tamano,
      girar_imagen_url: g.girar_imagen_url, girar_imagen_tamano: g.girar_imagen_tamano,
      girar_sin_fondo: g.girar_sin_fondo, paso_apuesta: Number(paso) || 500,
    }).eq('id', juego.id);
    msg(error ? error.message : 'Guardado ✓ (el paso nuevo se aplica al reabrir)');
  };

  return (
    <>
      <label style={{ display: 'block', height: 70, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 10 }}>
        {g.girar_imagen_url
          ? <img src={g.girar_imagen_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>Subir imagen del botón</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
      </label>
      {g.girar_imagen_url && (
        <button style={{ width: '100%', marginBottom: 10, fontSize: 12 }} onClick={() => { g.girar_imagen_url = null; escenario.aplicarGirar(); forzar((x) => x + 1); }}>Quitar imagen</button>
      )}
      <Rango etiqueta="Posición X" min={0} max={100} valor={g.girar_x} onInput={(n) => { g.girar_x = n; escenario.aplicarGirar(); }} />
      <Rango etiqueta="Posición Y" min={0} max={100} valor={g.girar_y} onInput={(n) => { g.girar_y = n; escenario.aplicarGirar(); }} />
      <Rango etiqueta="Tamaño del botón" min={36} max={140} unidad="px" valor={g.girar_tamano} onInput={(n) => { g.girar_tamano = n; escenario.aplicarGirar(); }} />
      <Rango etiqueta="Tamaño de la imagen" min={20} max={140} valor={g.girar_imagen_tamano} onInput={(n) => { g.girar_imagen_tamano = n; escenario.aplicarGirar(); }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '10px 0' }}>
        <input type="checkbox" checked={g.girar_sin_fondo} onChange={(e) => { g.girar_sin_fondo = e.target.checked; escenario.aplicarGirar(); forzar((x) => x + 1); }} /> Ocultar el fondo del botón
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Apuesta</p>
      <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Sube y baja de a
        <input type="number" value={paso} min={1} style={{ width: '100%' }} onChange={(e) => setPaso(Number(e.target.value))} />
      </label>
      <BotonGuardar texto="Guardar" onGuardar={guardar} />
    </>
  );
}

// ---------------- Controles ----------------

function PanelControles({ escenario, juego }: { escenario: Escenario; juego: Juego }) {
  const gr = escenario.posGrupos;
  const [, forzar] = useState(0);
  const redibujar = () => forzar((x) => x + 1);
  const [botonActual, setBotonActual] = useState('menos');
  const cfg = escenario.botones[botonActual];

  const sliderGrupo = (campo: keyof typeof gr, etiqueta: string, min: number, max: number, unidad: string) => (
    <Rango key={campo} etiqueta={etiqueta} min={min} max={max} unidad={unidad} valor={gr[campo] as number}
      onInput={(n) => { (gr as unknown as Record<string, number>)[campo as string] = n; escenario.aplicarGrupos(); }} />
  );
  const sliderBoton = (campo: 'tamano' | 'imagen_tamano', etiqueta: string, min: number, max: number, unidad: string) => (
    <Rango key={campo} etiqueta={etiqueta} min={min} max={max} unidad={unidad} valor={cfg[campo]}
      onInput={(n) => { cfg[campo] = n; escenario.aplicarBotonesApuesta(); escenario.pintarTurbo(); }} />
  );

  const subirFondo = async (campo: 'saldo_fondo_url' | 'apuesta_fondo_url', f: File) => {
    const url = await subirArchivo(f, `botones/${juego.id}`);
    if (url) { gr[campo] = url; escenario.aplicarGrupos(); redibujar(); }
  };

  const subirImgBoton = async (f: File) => {
    const url = await subirArchivo(f, `botones/${juego.id}`);
    if (url) { cfg.imagen_url = url; escenario.aplicarBotonesApuesta(); escenario.pintarTurbo(); redibujar(); }
  };

  const guardar = async (msg: (t: string) => void) => {
    msg('Guardando...');
    const { error: errPos } = await supabase.from('juegos').update({
      saldo_x: gr.saldo_x, saldo_y: gr.saldo_y, apuesta_x: gr.apuesta_x, apuesta_y: gr.apuesta_y,
      turbo_x: gr.turbo_x, turbo_y: gr.turbo_y, fichas_x: gr.fichas_x, fichas_y: gr.fichas_y,
      saldo_ancho: gr.saldo_ancho, saldo_alto: gr.saldo_alto, apuesta_ancho: gr.apuesta_ancho, apuesta_alto: gr.apuesta_alto,
      saldo_fondo_url: gr.saldo_fondo_url, apuesta_fondo_url: gr.apuesta_fondo_url,
      modo_apuesta: escenario.modoApuesta, mostrar_nombre: escenario.mostrarNombre,
      contador_ms: escenario.contadorMs, fichas: escenario.fichas,
    }).eq('id', juego.id);

    const { error: errBtn } = await supabase.from('botones').upsert(
      CLAVES_BOTON.map(({ clave }) => ({
        juego_id: juego.id, clave,
        imagen_url: escenario.botones[clave].imagen_url,
        tamano: escenario.botones[clave].tamano,
        imagen_tamano: escenario.botones[clave].imagen_tamano,
        sin_fondo: escenario.botones[clave].sin_fondo,
      })),
      { onConflict: 'juego_id,clave' },
    );
    msg((errPos || errBtn) ? (errPos || errBtn)!.message : 'Guardado ✓');
  };

  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
        <input type="checkbox" defaultChecked={escenario.mostrarNombre} onChange={(e) => {
          escenario.mostrarNombre = e.target.checked;
          const t = escenario.el.querySelector<HTMLElement>('[data-titulo]');
          if (t) t.style.visibility = e.target.checked ? 'visible' : 'hidden';
        }} /> Mostrar el nombre del juego arriba
      </label>
      <Rango etiqueta="Contador del premio" min={0} max={3000} step={100} unidad="ms"
        valor={escenario.contadorMs} onInput={(n) => { escenario.contadorMs = n; (juego as Record<string, unknown>).contador_ms = n; }} />

      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px' }}>Modo de apuesta</p>
      <select style={{ width: '100%', marginBottom: 6 }} defaultValue={escenario.modoApuesta}
        onChange={(e) => { escenario.modoApuesta = e.target.value; escenario.aplicarModo(); }}>
        <option value="fichas">Solo fichas</option>
        <option value="mas_menos">Solo + y −</option>
        <option value="mixto">Mixto (fichas + ajuste fino)</option>
      </select>
      <label style={{ display: 'block', marginBottom: 10, fontSize: 12 }}>Montos de las fichas (separados por coma)
        <input type="text" defaultValue={escenario.fichas.join(', ')} style={{ width: '100%' }} onChange={(e) => {
          const lista = e.target.value.split(',').map((t) => Number(String(t).replace(/[^\d]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
          if (lista.length) { escenario.fichas = lista; escenario.aplicarModo(); }
        }} />
      </label>
      {sliderGrupo('fichas_x', 'Fichas — Posición X', 0, 100, '%')}
      {sliderGrupo('fichas_y', 'Fichas — Posición Y', 0, 100, '%')}

      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Saldo</p>
      {sliderGrupo('saldo_x', 'Posición X', 0, 100, '%')}
      {sliderGrupo('saldo_y', 'Posición Y', 0, 100, '%')}
      {sliderGrupo('saldo_ancho', 'Ancho del recuadro', 60, 240, 'px')}
      {sliderGrupo('saldo_alto', 'Alto del recuadro', 24, 120, 'px')}
      <FondoRecuadro url={gr.saldo_fondo_url} onSubir={(f) => subirFondo('saldo_fondo_url', f)} onQuitar={() => { gr.saldo_fondo_url = null; escenario.aplicarGrupos(); redibujar(); }} />

      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Apuesta (− y +)</p>
      {sliderGrupo('apuesta_x', 'Posición X', 0, 100, '%')}
      {sliderGrupo('apuesta_y', 'Posición Y', 0, 100, '%')}
      {sliderGrupo('apuesta_ancho', 'Ancho del recuadro', 60, 240, 'px')}
      {sliderGrupo('apuesta_alto', 'Alto del recuadro', 24, 120, 'px')}
      <FondoRecuadro url={gr.apuesta_fondo_url} onSubir={(f) => subirFondo('apuesta_fondo_url', f)} onQuitar={() => { gr.apuesta_fondo_url = null; escenario.aplicarGrupos(); redibujar(); }} />

      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 8px' }}>Velocidad (x1 x2 x3)</p>
      {sliderGrupo('turbo_x', 'Posición X', 0, 100, '%')}
      {sliderGrupo('turbo_y', 'Posición Y', 0, 100, '%')}

      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '14px 0 8px' }}>Aspecto de cada botón</p>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {CLAVES_BOTON.map(({ clave, etiqueta }) => (
          <button key={clave} style={{ fontSize: 11, ...(clave === botonActual ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
            onClick={() => setBotonActual(clave)}>{etiqueta}</button>
        ))}
      </div>
      <label style={{ display: 'block', height: 64, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
        {cfg.imagen_url
          ? <img src={cfg.imagen_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>Subir imagen</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subirImgBoton(e.target.files[0])} />
      </label>
      {cfg.imagen_url && (
        <button style={{ width: '100%', marginBottom: 10, fontSize: 12 }} onClick={() => { cfg.imagen_url = null; escenario.aplicarBotonesApuesta(); escenario.pintarTurbo(); redibujar(); }}>Quitar imagen</button>
      )}
      {sliderBoton('tamano', 'Tamaño del botón', 18, 100, 'px')}
      {sliderBoton('imagen_tamano', 'Tamaño de la imagen', 20, 140, '%')}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '8px 0' }}>
        <input type="checkbox" checked={cfg.sin_fondo} onChange={(e) => { cfg.sin_fondo = e.target.checked; escenario.aplicarBotonesApuesta(); escenario.pintarTurbo(); redibujar(); }} /> Ocultar el fondo del botón
      </label>

      <BotonGuardar texto="Guardar todo" onGuardar={guardar} />
    </>
  );
}

function FondoRecuadro({ url, onSubir, onQuitar }: { url: string | null; onSubir: (f: File) => void; onQuitar: () => void }) {
  return (
    <>
      <label style={{ display: 'block', height: 48, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 6 }}>
        {url
          ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span className="hint" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>Fondo del recuadro</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onSubir(e.target.files[0])} />
      </label>
      {url && <button style={{ width: '100%', marginBottom: 10, fontSize: 11 }} onClick={onQuitar}>Quitar fondo</button>}
    </>
  );
}

// ---------------- Chips + agregar (Libres / Animaciones / Luces) ----------------

function ChipsAgregar({ items, actualId, onSelect, onAgregar, textoAgregar = '+ Agregar' }: {
  items: { id: string; etiqueta: string }[];
  actualId: string | null;
  onSelect: (id: string) => void;
  onAgregar: () => void;
  textoAgregar?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
        {items.map((it) => (
          <button key={it.id} style={{ fontSize: 11, borderColor: it.id === actualId ? 'var(--accent)' : 'var(--border)', color: it.id === actualId ? 'var(--accent)' : 'var(--text)' }}
            onClick={() => onSelect(it.id)}>{it.etiqueta}</button>
        ))}
      </div>
      <button style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={onAgregar}>{textoAgregar}</button>
    </div>
  );
}
