import './styles.css';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchJson } from './juego/recursos.ts';
import { caraDe } from './dominio.ts';
import { PantallaCarga } from './PantallaCarga.tsx';
import type { DatosJuego } from './types.ts';

const SESION_KEY = 'jugar-sesion';

function leerCredenciales() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';
  if (slug && token) {
    let guardado = false;
    try {
      sessionStorage.setItem(SESION_KEY, JSON.stringify({ slug, token }));
      guardado = true;
    } catch { /* iframe sin storage: la query se queda */ }
    if (guardado) {
      const path = location.pathname.replace(/\/jugar\.html$/, '/jugar');
      history.replaceState(null, '', path);
    }
    return { slug, token };
  }
  try {
    const guardado = JSON.parse(sessionStorage.getItem(SESION_KEY) || '');
    return { slug: String(guardado.slug || ''), token: String(guardado.token || '') };
  } catch {
    return { slug: '', token: '' };
  }
}

if (caraDe() === 'estudio') {
  location.replace('/estudio');
}

type PropsJugar = { datos: DatosJuego; saldoInicial: number; slug: string; token: string };
type CompJugar = ComponentType<PropsJugar>;

const JugarSlot = lazy(() => import('./JugarSlot.tsx').then((m) => ({ default: m.JugarSlot })));
const JugarMines = lazy(() => import('./JugarMines.tsx').then((m) => ({ default: m.JugarMines })));
const JugarRuleta = lazy(() => import('./JugarRuleta.tsx').then((m) => ({ default: m.JugarRuleta })));
const JugarRuletaBotones = lazy(() => import('./JugarRuletaBotones.tsx').then((m) => ({ default: m.JugarRuletaBotones })));
const JugarCrash = lazy(() => import('./JugarCrash.tsx').then((m) => ({ default: m.JugarCrash })));
const JugarPlinko = lazy(() => import('./JugarPlinko.tsx').then((m) => ({ default: m.JugarPlinko })));
const JugarRaspadita = lazy(() => import('./JugarRaspadita.tsx').then((m) => ({ default: m.JugarRaspadita })));
const JugarLimbo = lazy(() => import('./Limbo.tsx').then((m) => ({ default: m.JugarLimbo })));
const JugarDice = lazy(() => import('./Dice.tsx').then((m) => ({ default: m.JugarDice })));
const JugarKeno = lazy(() => import('./JugarKeno.tsx').then((m) => ({ default: m.JugarKeno })));
const JugarTorre = lazy(() => import('./JugarTorre.tsx').then((m) => ({ default: m.JugarTorre })));
const JugarSieteUd = lazy(() => import('./SieteUd.tsx').then((m) => ({ default: m.JugarSieteUd })));

function pantallaDe(motor: string): CompJugar {
  if (motor.startsWith('mines')) return JugarMines;
  if (motor === 'ruleta') return JugarRuleta;
  if (motor === 'ruleta-botones') return JugarRuletaBotones;
  if (motor.startsWith('crash')) return JugarCrash;
  if (motor.startsWith('plinko')) return JugarPlinko;
  if (motor.startsWith('raspadita')) return JugarRaspadita;
  if (motor.startsWith('limbo')) return JugarLimbo;
  if (motor.startsWith('dice')) return JugarDice;
  if (motor.startsWith('keno')) return JugarKeno;
  if (motor.startsWith('sieteud')) return JugarSieteUd;
  if (motor.startsWith('torre')) return JugarTorre;
  return JugarSlot;
}

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
    const { slug, token } = leerCredenciales();

    document.addEventListener('contextmenu', prevenir);
    document.addEventListener('dragstart', prevenir);
    // En Android el toque deja el botón en :focus y pinta un recuadro.
    const soltarFoco = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.matches('button, [role="button"]')) el.blur();
    };
    document.addEventListener('touchend', soltarFoco, { passive: true });

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
      document.removeEventListener('touchend', soltarFoco);
    };
  }, []);

  if (estado.fase === 'error') {
    return <p style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{estado.mensaje}</p>;
  }
  if (estado.fase === 'cargando') {
    return <PantallaCarga imagen={null} nombre="" hechos={0} total={1} visible />;
  }

  const props = { datos: estado.datos, saldoInicial: estado.saldo, slug: estado.slug, token: estado.token };
  const Pantalla = pantallaDe(estado.datos.juego.motor);
  return (
    <Suspense fallback={<PantallaCarga imagen={null} nombre="" hechos={0} total={1} visible />}>
      <Pantalla {...props} />
    </Suspense>
  );
}

if (caraDe() !== 'estudio') {
  createRoot(document.getElementById('app')!).render(<Jugar />);
}
