import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';
import { Sidebar } from './Sidebar.tsx';
import { ListaJuegos } from './ListaJuegos.tsx';
import { Catalogo } from './Catalogo.tsx';
import { Clientes } from './Clientes.tsx';
import { Editor } from './Editor.tsx';
import type { Juego } from './types.ts';

export type VistaPanel = 'juegos' | 'catalogo' | 'clientes';

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
              <Editor key={juegoSel.id} juego={juegoSel} onCambio={cargarLista} />
            </div>
          )}

          {vista === 'catalogo' && (
            <>
              <div className="page-head"><div><h2>Catálogo</h2><p className="sub">Los juegos marcados como "Listo", como se verían en una lista real.</p></div></div>
              <Catalogo />
            </>
          )}
          {vista === 'clientes' && (
            <>
              <div className="page-head"><div><h2>Clientes</h2><p className="sub">Los casinos a los que les servís juegos.</p></div></div>
              <Clientes />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
