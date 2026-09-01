import { useMemo, useState } from 'react';
import { supabase } from './supabase.ts';
import { MOTORES_DISPONIBLES, MOTOR_POR_DEFECTO } from '../motor/registro.js';
import type { EstadoJuego, Juego } from './types.ts';

const ESTADOS: Record<string, string> = { borrador: 'Borrador', en_prueba: 'En prueba', listo: 'Listo' };

/** Nombre corto del motor para la columna de la tabla. */
const MOTOR_CORTO: Record<string, string> = {
  'clasico-3x3': 'Slot 3×3',
  'clasico-5x3': 'Slot 5×3',
  'mines-clasico': 'Mines',
  ruleta: 'Ruleta',
  'ruleta-botones': 'Ruleta botones',
  'crash-clasico': 'Crash',
  'plinko-clasico': 'Plinko',
};

// Carpetas del bucket `assets` con archivos por juego. Al eliminar un
// juego hay que limpiarlas a mano: la base se lleva las filas en
// cascada, pero no los archivos.
const CARPETAS_ASSETS = [
  'iconos', 'sonidos', 'digitos', 'premios', 'libres', 'girar', 'botones',
  'fondo_url', 'fondo_pantalla_url', 'marco_url', 'cartel_url', 'portada_url', 'carga_url',
];

async function borrarArchivosDelJuego(juegoId: string) {
  for (const carpeta of CARPETAS_ASSETS) {
    const { data } = await supabase.storage.from('assets').list(`${carpeta}/${juegoId}`);
    if (data?.length) {
      await supabase.storage.from('assets').remove(data.map((f) => `${carpeta}/${juegoId}/${f.name}`));
    }
  }
}

type Est = 'todos' | 'borrador' | 'en_prueba' | 'listo' | 'publicado';
type Orden = 'editado' | 'nombre' | 'motor' | 'estado' | 'version';
const PER = 12;

function hace(iso?: string): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} d`;
  if (d < 35) return `hace ${Math.round(d / 7)} sem`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function motorCorto(m: string) {
  return MOTOR_CORTO[m] || m || 'motor';
}

interface ListaJuegosProps {
  juegos: Juego[];
  onAbrir: (id: string) => void;
  recargar: () => void;
}

/**
 * Lista de juegos: buscar, filtrar por estado y motor, ordenar, y
 * abrir uno para editarlo. Pensada para cuando hay cientos de juegos
 * y no una docena — de ahí el paginado y los filtros.
 */
export function ListaJuegos({ juegos, onAbrir, recargar }: ListaJuegosProps) {
  const [q, setQ] = useState('');
  const [est, setEst] = useState<Est>('todos');
  const [motorF, setMotorF] = useState('');
  const [orden, setOrden] = useState<Orden>('editado');
  const [vista, setVista] = useState<'tabla' | 'tarjetas'>('tabla');
  const [pagina, setPagina] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMotor, setNuevoMotor] = useState(MOTOR_POR_DEFECTO);

  const conteo = useMemo(() => ({
    todos: juegos.length,
    borrador: juegos.filter((j) => j.estado === 'borrador').length,
    en_prueba: juegos.filter((j) => j.estado === 'en_prueba').length,
    listo: juegos.filter((j) => j.estado === 'listo').length,
    publicado: juegos.filter((j) => j.publicado).length,
  }), [juegos]);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const orderEstado: Record<string, number> = { borrador: 0, en_prueba: 1, listo: 2 };
    return juegos
      .filter((j) => {
        if (est === 'publicado' && !j.publicado) return false;
        if (est !== 'todos' && est !== 'publicado' && j.estado !== est) return false;
        if (motorF && j.motor !== motorF) return false;
        if (texto && !j.nombre.toLowerCase().includes(texto) && !j.slug.toLowerCase().includes(texto)) return false;
        return true;
      })
      .sort((a, b) => {
        switch (orden) {
          case 'nombre': return a.nombre.localeCompare(b.nombre);
          case 'motor': return motorCorto(a.motor).localeCompare(motorCorto(b.motor));
          case 'estado': return (orderEstado[b.estado] - orderEstado[a.estado]) || a.nombre.localeCompare(b.nombre);
          case 'version': return (b.version || 1) - (a.version || 1);
          default: {
            const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return tb - ta;
          }
        }
      });
  }, [juegos, q, est, motorF, orden]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / PER));
  const pag = Math.min(pagina, paginas);
  const inicio = (pag - 1) * PER;
  const visibles = filtrados.slice(inicio, inicio + PER);

  const cambiarFiltro = (fn: () => void) => { fn(); setPagina(1); };

  const alternarSel = (id: string) => {
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selPagina = visibles.length > 0 && visibles.every((j) => sel.has(j.id));
  const alternarPagina = () => {
    setSel((prev) => {
      const n = new Set(prev);
      if (selPagina) visibles.forEach((j) => n.delete(j.id));
      else visibles.forEach((j) => n.add(j.id));
      return n;
    });
  };

  // ---------------- Crear / duplicar / eliminar ----------------
  const crear = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const slug =
      nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') +
      '-' + Date.now().toString(36);
    const { data, error } = await supabase
      .from('juegos').insert({ nombre, slug, motor: nuevoMotor }).select().single();
    if (error) { alert(error.message); return; }
    setNuevoNombre('');
    setNuevoAbierto(false);
    recargar();
    onAbrir((data as Juego).id);
  };

  const duplicar = async (j: Juego) => {
    const nombre = prompt('Nombre del juego nuevo:', j.nombre + ' (copia)');
    if (!nombre?.trim()) return;
    const slug = prompt('Slug del juego nuevo (sin espacios, va en la URL):', j.slug + '-copia');
    if (!slug?.trim()) return;
    const { data, error } = await supabase.rpc('duplicar_juego', {
      p_juego_id: j.id,
      p_nombre: nombre.trim(),
      p_slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
    });
    if (error) { alert('No se pudo duplicar: ' + error.message); return; }
    recargar();
    onAbrir(data as string);
  };

  const eliminar = async (j: Juego) => {
    if (j.publicado) {
      alert('Este juego está publicado. Despublicalo desde el editor antes de eliminarlo, así deja de aparecer en el catálogo.');
      return;
    }
    const escrito = prompt(
      `Esto elimina "${j.nombre}" y TODO lo que tenga adentro (símbolos, imágenes, sonidos, luces, historial). No se puede deshacer.\n\nEscribí el nombre del juego para confirmar:`
    );
    if (escrito === null) return;
    if (escrito.trim() !== j.nombre) { alert('El nombre no coincide. No se eliminó nada.'); return; }
    await borrarArchivosDelJuego(j.id);
    const { error } = await supabase.from('juegos').delete().eq('id', j.id);
    if (error) { alert('No se pudo eliminar: ' + error.message); return; }
    setSel((prev) => { const n = new Set(prev); n.delete(j.id); return n; });
    recargar();
  };

  const cambiarEstadoLote = async (estado: EstadoJuego) => {
    const ids = [...sel];
    if (!ids.length) return;
    const { error } = await supabase.from('juegos').update({ estado }).in('id', ids);
    if (error) { alert('No se pudo cambiar el estado: ' + error.message); return; }
    setSel(new Set());
    recargar();
  };

  const listos = conteo.listo;
  const pubs = conteo.publicado;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Juegos</h2>
          <p className="sub">{juegos.length} juegos · {listos} listos · {pubs} publicados</p>
        </div>
        <button className="primary" onClick={() => setNuevoAbierto((v) => !v)}>+ Nuevo juego</button>
      </div>

      {nuevoAbierto && (
        <div className="card nuevo-juego">
          <input
            placeholder="Nombre del juego nuevo"
            autoFocus
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
          />
          <select style={{ width: 'auto' }} value={nuevoMotor} onChange={(e) => setNuevoMotor(e.target.value)}>
            {MOTORES_DISPONIBLES.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
          <button className="primary" onClick={crear}>Crear</button>
          <button onClick={() => setNuevoAbierto(false)}>Cancelar</button>
        </div>
      )}

      <div className="lista-tools">
        <div className="buscar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="search"
            placeholder="Buscar por nombre o slug…"
            value={q}
            onChange={(e) => cambiarFiltro(() => setQ(e.target.value))}
          />
        </div>

        <div className="seg">
          {([
            ['todos', 'Todos'], ['borrador', 'Borradores'], ['en_prueba', 'En prueba'],
            ['listo', 'Listos'], ['publicado', 'Publicados'],
          ] as [Est, string][]).map(([v, etq]) => (
            <button
              key={v}
              className={est === v ? 'on' : ''}
              onClick={() => cambiarFiltro(() => setEst(v))}
            >
              {etq}<span className="n">{conteo[v]}</span>
            </button>
          ))}
        </div>

        <select
          className="compacto"
          value={motorF}
          onChange={(e) => cambiarFiltro(() => setMotorF(e.target.value))}
        >
          <option value="">Todos los motores</option>
          {MOTORES_DISPONIBLES.map((m) => (
            <option key={m.valor} value={m.valor}>{motorCorto(m.valor)}</option>
          ))}
        </select>

        <select className="compacto" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
          <option value="editado">Última edición</option>
          <option value="nombre">Nombre A–Z</option>
          <option value="motor">Motor</option>
          <option value="estado">Estado</option>
          <option value="version">Versión</option>
        </select>

        <div className="vista-toggle">
          <button className={vista === 'tabla' ? 'on' : ''} onClick={() => setVista('tabla')} title="Tabla" aria-label="Ver como tabla">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <button className={vista === 'tarjetas' ? 'on' : ''} onClick={() => setVista('tarjetas')} title="Tarjetas" aria-label="Ver como tarjetas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          </button>
        </div>
      </div>

      {sel.size > 0 && (
        <div className="lote">
          <span className="lote-n">{sel.size} seleccionados</span>
          <button onClick={() => cambiarEstadoLote('borrador')}>Marcar borrador</button>
          <button onClick={() => cambiarEstadoLote('en_prueba')}>Marcar en prueba</button>
          <button onClick={() => cambiarEstadoLote('listo')}>Marcar listo</button>
          <span className="sp" />
          <button onClick={() => setSel(new Set())}>Limpiar</button>
        </div>
      )}

      {filtrados.length === 0 ? (
        <div className="card"><p className="hint">Ningún juego coincide con el filtro.</p></div>
      ) : vista === 'tabla' ? (
        <div className="jt-wrap">
          <table className="jt">
            <thead>
              <tr>
                <th className="c-check"><input type="checkbox" checked={selPagina} onChange={alternarPagina} aria-label="Seleccionar página" /></th>
                <th className="orden" onClick={() => setOrden('nombre')}>Juego</th>
                <th className="orden" onClick={() => setOrden('motor')}>Motor</th>
                <th className="orden" onClick={() => setOrden('estado')}>Estado</th>
                <th className="orden" onClick={() => setOrden('version')}>Ver.</th>
                <th className="orden" onClick={() => setOrden('editado')}>Editado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((j) => (
                <tr
                  key={j.id}
                  className={`${j.publicado ? 'pub' : ''} ${sel.has(j.id) ? 'sel' : ''}`}
                  onClick={() => onAbrir(j.id)}
                >
                  <td className="c-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.has(j.id)} onChange={() => alternarSel(j.id)} aria-label={`Seleccionar ${j.nombre}`} />
                  </td>
                  <td>
                    <div className="jt-juego">
                      <div
                        className="jt-thumb"
                        style={j.portada_url ? { backgroundImage: `url('${j.portada_url}')` } : undefined}
                      >
                        {!j.portada_url && '🎰'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="nm">{j.nombre}</div>
                        <div className="sl">{j.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="motor">{motorCorto(j.motor)}</span></td>
                  <td>
                    <span className={`badge ${j.estado}`}>{ESTADOS[j.estado]}</span>
                    {j.publicado && <span className="badge pub" style={{ marginLeft: 6 }}>Publicado</span>}
                  </td>
                  <td><span className="num">v{j.version || 1}</span></td>
                  <td><span className="when">{hace(j.updated_at)}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="jt-acts">
                      <button title="Editar" onClick={() => onAbrir(j.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
                      </button>
                      <button title="Duplicar" onClick={() => duplicar(j)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      </button>
                      <button className="del" title="Eliminar" onClick={() => eliminar(j)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="jcards">
          {visibles.map((j) => (
            <button key={j.id} className="jcard" onClick={() => onAbrir(j.id)}>
              <div
                className="art"
                style={j.portada_url
                  ? { backgroundImage: `url('${j.portada_url}')` }
                  : { background: 'var(--surface-alt)' }}
              >
                {!j.portada_url && <span className="hint" style={{ fontSize: 11 }}>Sin portada</span>}
                {j.publicado && <span className="flag" />}
              </div>
              <div className="meta">
                <div className="nm">{j.nombre}</div>
                <div className="row">
                  <span className={`badge ${j.estado}`}>{ESTADOS[j.estado]}</span>
                  <span className="hint" style={{ fontSize: 11 }}>{motorCorto(j.motor)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="pager">
          <div className="info">
            Mostrando <b>{inicio + 1}</b>–<b>{Math.min(inicio + PER, filtrados.length)}</b> de <b>{filtrados.length}</b>
          </div>
          {paginas > 1 && (
            <div className="nums">
              <button disabled={pag === 1} onClick={() => setPagina(pag - 1)} aria-label="Anterior">‹</button>
              {paginasVisibles(pag, paginas).map((p, i) => (
                p === '…'
                  ? <span key={`g${i}`} style={{ color: 'var(--text-dim)', padding: '0 2px' }}>…</span>
                  : <button key={p} className={p === pag ? 'on' : ''} onClick={() => setPagina(p as number)}>{p}</button>
              ))}
              <button disabled={pag === paginas} onClick={() => setPagina(pag + 1)} aria-label="Siguiente">›</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Números de página a mostrar: primera, última, y una ventana alrededor de la actual. */
function paginasVisibles(actual: number, total: number): (number | '…')[] {
  const out: (number | '…')[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - actual) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}
