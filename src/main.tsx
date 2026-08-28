import './styles.css';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';
import { Login } from './Login.tsx';
import { App } from './App.tsx';

function Root() {
  // undefined = todavía no sabemos; null = sin sesión.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  // Quién está logueado ahora mismo. Sirve para distinguir un cambio
  // real de sesión de un simple aviso de Supabase.
  const usuarioActual = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      usuarioActual.current = session?.user?.id ?? null;
      setSession(session);
    });

    // OJO: onAuthStateChange NO avisa solamente al entrar o salir.
    // También salta cuando Supabase renueva el token por su cuenta y
    // cuando volvés a esta pestaña después de estar en otra. Antes,
    // cada uno de esos avisos redibujaba la app entera y se perdía lo
    // que estabas haciendo. Ahora solo se redibuja si CAMBIÓ el
    // usuario (entró otro, o se cerró la sesión).
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      const nuevoUsuario = nuevaSesion?.user?.id ?? null;
      if (nuevoUsuario === usuarioActual.current) return;
      usuarioActual.current = nuevoUsuario;
      setSession(nuevaSesion);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  if (!session) {
    return (
      <Login
        onEntrar={async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            usuarioActual.current = session.user.id;
            setSession(session);
          }
        }}
      />
    );
  }

  return <App session={session} onSalir={() => { supabase.auth.signOut(); }} />;
}

createRoot(document.getElementById('app')!).render(<Root />);
