import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';
import { Sidebar } from './Sidebar.tsx';
import { ListaJuegos } from './ListaJuegos.tsx';
import type { Juego } from './types.ts';

const Catalogo = lazy(() => import('./Catalogo.tsx').then((m) => ({ default: m.Catalogo })));
const Clientes = lazy(() => import('./Clientes.tsx').then((m) => ({ default: m.Clientes })));
const Apariencia = lazy(() => import('./Apariencia.tsx').then((m) => ({ default: m.Apariencia })));
const Editor = lazy(() => import('./Editor.tsx').then((m) => ({ default: m.Editor })));

function CargaPanel() {
  return <p className="hint" style={{ padding: 24 }}>Cargando…</p>;
}

export type VistaPanel = 'juegos' | 'catalogo' | 'clientes' | 'apariencia';

interface AppProps {
  session: Session;
  onSalir: () => void;
}

/**
 * Shell del panel: barra lateral + área principal. La lista de juegos
 * y el editor de un juego son pantallas separadas — abrís un juego,
 * lo editás, volvés. El editor ya no vive colgado abajo de la lista.
 */
export function App({ session, onSalir }: AppProps) {
  const [juegos, setJuegos] = useState<Juego[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaPanel>('juegos');
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const cargarLista = useCallback(async () => {
    const { data, error } = await supabase
      .from('juegos').select('*').order('updated_at', { ascending: false });
    if (error) { setErrorLista(error.message); return; }
    setErrorLista(null);
    setJuegos((data as Juego[]) || []);
  }, []);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  const juegoSel = juegos.find((j) => j.id === seleccionado) || null;
  const editando = vista === 'juegos' && !!juegoSel;

  const irA = (v: VistaPanel) => { setVista(v); setSeleccionado(null); };

  return (
    <div className="shell">
      <div className="ambient" aria-hidden>
        <b className="a1" /><b className="a2" /><b className="a3" /><b className="a4" /><b className="a5" />
      </div>
      <Sidebar
        vista={vista}
        cantidadJuegos={juegos.length}
        cantidadListos={juegos.filter((j) => j.estado === 'listo').length}
        email={session.user.email ?? ''}
        onIr={irA}
        onSalir={onSalir}
      />

      <main className="shell-main">
        <div className="shell-inner">
          {vista === 'juegos' && !editando && (
            <>
              {errorLista && <p className="hint error">{errorLista}</p>}
              <ListaJuegos juegos={juegos} onAbrir={setSeleccionado} recargar={cargarLista} />
            </>
          )}

          {editando && juegoSel && (
            <div className="editor-cont">
              <div className="crumbs">
                <button onClick={() => setSeleccionado(null)}>← Juegos</button>
                <span className="sep">/</span>
                <span className="cur">{juegoSel.nombre}</span>
              </div>
              <Suspense fallback={<CargaPanel />}>
                <Editor key={juegoSel.id} juego={juegoSel} onCambio={cargarLista} />
              </Suspense>
            </div>
          )}

          {vista === 'catalogo' && (
            <>
              <div className="page-head"><div><h2>Catálogo</h2><p className="sub">Los juegos marcados como "Listo", como se verían en una lista real.</p></div></div>
              <Suspense fallback={<CargaPanel />}><Catalogo /></Suspense>
            </>
          )}
          {vista === 'clientes' && (
            <>
              <div className="page-head"><div><h2>Clientes</h2><p className="sub">Los casinos a los que les servís juegos.</p></div></div>
              <Suspense fallback={<CargaPanel />}><Clientes /></Suspense>
            </>
          )}
          {vista === 'apariencia' && (
            <>
              <div className="page-head"><div><h2>Apariencia</h2><p className="sub">Temas de vidrio y fondo animado. Los cambios se ven al instante en todo el panel.</p></div></div>
              <Suspense fallback={<CargaPanel />}><Apariencia /></Suspense>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
