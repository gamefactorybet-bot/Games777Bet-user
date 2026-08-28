import './styles.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchJson } from './juego/recursos.ts';
import { PantallaCarga } from './PantallaCarga.tsx';
import { JugarSlot } from './JugarSlot.tsx';
import { JugarMines } from './JugarMines.tsx';
import type { DatosJuego } from './types.ts';

// Pantalla jugable real, sin login: la abre directo el jugador cuando
// toca el juego en el portal de Win777, con ?slug=...&token=... en la
// URL. El token identifica al jugador pero por sí solo no mueve plata:
// cada paso lo resuelve el servidor.
//
// Este componente solo trae los datos y el saldo, y según el motor del
// juego monta la pantalla de slot o la de Mines.

const prevenir = (e: Event) => e.preventDefault();

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; datos: DatosJuego; saldo: number; slug: string; token: string };

function Jugar() {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug') || '';
    const token = params.get('token') || '';

    document.addEventListener('contextmenu', prevenir);
    document.addEventListener('dragstart', prevenir);

    let cancelado = false;

    if (!slug || !token) {
      setEstado({ fase: 'error', mensaje: 'Falta el juego o el token de acceso.' });
    } else {
      (async () => {
        try {
          const [datos, balance] = await Promise.all([
            fetchJson<DatosJuego>(`/api/jugar-datos?slug=${encodeURIComponent(slug)}`),
            fetchJson<{ saldo: number }>(`/api/jugar-balance?token=${encodeURIComponent(token)}`),
          ]);
          if (!cancelado) setEstado({ fase: 'listo', datos, saldo: Number(balance.saldo), slug, token });
        } catch (err) {
          if (!cancelado) setEstado({ fase: 'error', mensaje: (err as Error).message || 'No se pudo cargar el juego.' });
        }
      })();
    }

    return () => {
      cancelado = true;
      document.removeEventListener('contextmenu', prevenir);
      document.removeEventListener('dragstart', prevenir);
    };
  }, []);

  if (estado.fase === 'error') {
    return <p style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{estado.mensaje}</p>;
  }
  if (estado.fase === 'cargando') {
    return <PantallaCarga imagen={null} nombre="" hechos={0} total={1} visible />;
  }

  const props = { datos: estado.datos, saldoInicial: estado.saldo, slug: estado.slug, token: estado.token };
  return estado.datos.juego.motor.startsWith('mines')
    ? <JugarMines {...props} />
    : <JugarSlot {...props} />;
}

createRoot(document.getElementById('app')!).render(<Jugar />);
