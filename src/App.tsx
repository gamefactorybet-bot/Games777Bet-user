import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';
import { Catalogo } from './Catalogo.tsx';
import { Clientes } from './Clientes.tsx';
// editor.js sigue en JS vanilla — se monta por ref hasta que se migre.
import { renderEditor } from './editor.js';
import { MOTORES_DISPONIBLES, MOTOR_POR_DEFECTO } from '../motor/registro.js';
import type { Juego } from './types.ts';

const ESTADOS: Record<string, string> = { borrador: 'Borrador', en_prueba: 'En prueba', listo: 'Listo' };

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

interface AppProps {
  session: Session;
  onSalir: () => void;
}

export function App({ onSalir }: AppProps) {
  const [juegos, setJuegos] = useState<Juego[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [mostrarClientes, setMostrarClientes] = useState(false);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMotor, setNuevoMotor] = useState(MOTOR_POR_DEFECTO);

  const seleccionadoRef = useRef<string | null>(null);
  seleccionadoRef.current = seleccionado;

  const cargarLista = useCallback(async () => {
    const { data, error } = await supabase.from('juegos').select('*').order('updated_at', { ascending: false });

    if (error) { setErrorLista(error.message); return; }
    setErrorLista(null);

    const lista = (data as Juego[]) || [];
    setJuegos(lista);
    if (!seleccionadoRef.current && lista.length) setSeleccionado(lista[0].id);
  }, []);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  const juegoSel = juegos.find((j) => j.id === seleccionado) || null;

  const crear = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;

    const slug =
      nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') +
      '-' + Date.now().toString(36);

    const { data, error } = await supabase
      .from('juegos')
      .insert({ nombre, slug, motor: nuevoMotor })
      .select()
      .single();

    if (error) { alert(error.message); return; }

    setNuevoNombre('');
    setSeleccionado((data as Juego).id);
    cargarLista();
  };

  // Duplicar: clona el juego entero (símbolos, imágenes, capas,
  // sonidos, botones, posiciones). La copia entra como borrador.
  const duplicar = async () => {
    if (!juegoSel) return;

    const nombre = prompt('Nombre del juego nuevo:', juegoSel.nombre + ' (copia)');
    if (!nombre?.trim()) return;

    const slug = prompt('Slug del juego nuevo (sin espacios, va en la URL):', juegoSel.slug + '-copia');
    if (!slug?.trim()) return;

    const { data, error } = await supabase.rpc('duplicar_juego', {
      p_juego_id: juegoSel.id,
      p_nombre: nombre.trim(),
      p_slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
    });

    if (error) { alert('No se pudo duplicar: ' + error.message); return; }

    setSeleccionado(data as string);
    cargarLista();
  };

  // Eliminar: borra la fila (cascada en la base) y limpia los archivos
  // del bucket para que no queden huérfanos.
  const eliminar = async () => {
    if (!juegoSel) return;

    if (juegoSel.publicado) {
      alert('Este juego está publicado. Despublicalo desde el editor antes de eliminarlo, así deja de aparecer en el catálogo.');
      return;
    }

    const escrito = prompt(
      `Esto elimina "${juegoSel.nombre}" y TODO lo que tenga adentro (símbolos, imágenes, sonidos, luces, historial). No se puede deshacer.\n\nEscribí el nombre del juego para confirmar:`
    );
    if (escrito === null) return;
    if (escrito.trim() !== juegoSel.nombre) {
      alert('El nombre no coincide. No se eliminó nada.');
      return;
    }

    // Primero los archivos: si fallara la base, al menos no quedan
    // huérfanos sin dueño.
    await borrarArchivosDelJuego(juegoSel.id);
    const { error } = await supabase.from('juegos').delete().eq('id', juegoSel.id);

    if (error) { alert('No se pudo eliminar: ' + error.message); return; }

    setSeleccionado(null);
    cargarLista();
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <h2 style={{ margin: 0, flex: 1 }}>gameswin777</h2>
        <button onClick={() => setMostrarCatalogo((v) => !v)}>Catálogo</button>
        <button onClick={() => setMostrarClientes((v) => !v)}>Clientes</button>
        <button onClick={onSalir}>Salir</button>
      </div>

      {mostrarCatalogo && <Catalogo />}
      {mostrarClientes && <Clientes />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {errorLista && <p className="hint error">{errorLista}</p>}
        {!errorLista && juegos.length === 0 && <p className="hint">Todavía no creaste ningún juego.</p>}
        {juegos.map((j) => (
          <button
            key={j.id}
            className={`pill ${j.id === seleccionado ? 'on' : ''}`}
            onClick={() => setSeleccionado(j.id)}
          >
            {j.nombre}
            <span className={`badge ${j.estado}`} style={{ marginLeft: 6 }}>{ESTADOS[j.estado]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          placeholder="Nombre del juego nuevo"
          style={{ flex: 1 }}
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <select style={{ width: 'auto' }} value={nuevoMotor} onChange={(e) => setNuevoMotor(e.target.value)}>
          {MOTORES_DISPONIBLES.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </select>
        <button className="primary" onClick={crear}>Crear juego</button>
        {seleccionado && <button onClick={duplicar}>Duplicar el seleccionado</button>}
        {seleccionado && <button style={{ color: 'var(--danger)' }} onClick={eliminar}>Eliminar</button>}
      </div>

      {juegoSel && <MontajeEditor juego={juegoSel} onCambio={cargarLista} />}
    </div>
  );
}

/**
 * Puente hacia editor.js (todavía en JS vanilla): monta el editor en un
 * div propio y lo vuelve a montar cuando cambia el juego seleccionado.
 */
function MontajeEditor({ juego, onCambio }: { juego: Juego; onCambio: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) renderEditor(ref.current, juego, onCambio);
    // El editor se reconstruye por completo al cambiar de juego (mismo
    // comportamiento que la versión anterior).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juego.id]);

  return <div ref={ref} />;
}
