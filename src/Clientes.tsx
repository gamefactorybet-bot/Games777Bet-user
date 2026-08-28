import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import type { Cliente, ClienteActivo } from './types.ts';

/**
 * Panel de clientes conectados (los casinos a los que se les sirve
 * juegos — hoy Win777). La URL y el secreto son los que dio SU panel
 * al crear el proveedor de ese lado.
 */
export function Clientes() {
  const [lista, setLista] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [url, setUrl] = useState('');
  const [secreto, setSecreto] = useState('');
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  const cargarLista = async () => {
    const { data, error } = await supabase
      .from('clientes_conectados')
      .select('*')
      .order('created_at', { ascending: false });

    setCargando(false);
    if (error) { setError(error.message); return; }
    setError(null);
    setLista((data as Cliente[]) || []);
  };

  useEffect(() => { cargarLista(); }, []);

  const alternar = async (c: Cliente) => {
    await supabase.from('clientes_conectados').update({ activo: !c.activo }).eq('id', c.id);
    cargarLista();
  };

  const crear = async () => {
    if (!nombre.trim() || !url.trim() || !secreto.trim()) {
      setMsg({ texto: 'Completá los tres campos.', ok: false });
      return;
    }

    const { error } = await supabase
      .from('clientes_conectados')
      .insert({ nombre: nombre.trim(), panel_url: url.trim(), secreto: secreto.trim() });

    if (error) { setMsg({ texto: error.message, ok: false }); return; }

    setNombre('');
    setUrl('');
    setSecreto('');
    setMsg({ texto: 'Cliente agregado.', ok: true });
    cargarLista();
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <strong style={{ fontSize: 15 }}>Clientes conectados</strong>
      <p className="hint" style={{ marginBottom: 14 }}>
        Los casinos a los que les servís juegos. La URL y el secreto son los que te dio SU panel al crear el proveedor de ese lado.
      </p>

      <div>
        {cargando && <p className="hint">Cargando...</p>}
        {error && <p className="hint error">{error}</p>}
        {!cargando && !error && lista.length === 0 && (
          <p className="hint">Todavía no conectaste ningún cliente.</p>
        )}
        {lista.map((c) => (
          <div
            key={c.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-alt)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{c.nombre}</strong>
              <p className="hint" style={{ margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.panel_url}
              </p>
            </div>
            <span className={`badge ${c.activo ? 'listo' : 'borrador'}`}>
              {c.activo ? 'Activo' : 'Deshabilitado'}
            </span>
            <button onClick={() => alternar(c)}>{c.activo ? 'Deshabilitar' : 'Habilitar'}</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        <input placeholder="Nombre (ej: Win777)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input placeholder="https://win777bet-panel.vercel.app" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <input
        placeholder="Secreto que te dio el panel del cliente"
        style={{ marginTop: 8 }}
        value={secreto}
        onChange={(e) => setSecreto(e.target.value)}
      />
      <button className="primary" style={{ marginTop: 10 }} onClick={crear}>Agregar cliente</button>
      {msg && (
        <p className={msg.ok ? 'hint' : 'hint error'} style={msg.ok ? { color: 'var(--ok)' } : undefined}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}

/** Trae la lista de clientes activos, para marcar a cuáles está
 * conectado un juego puntual. La usa el editor (todavía en JS). */
export async function listarClientesActivos(): Promise<ClienteActivo[]> {
  const { data } = await supabase
    .from('clientes_conectados')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre');
  return (data as ClienteActivo[]) || [];
}
