import './styles.css';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchJson } from './juego/recursos.ts';
import { caraDe } from './dominio.ts';
import { PantallaCarga } from './PantallaCarga.tsx';
import type { DatosJuego } from './types.ts';

const SESION_KEY = 'jugar-sesion';

type SesionJugar = { slug: string; token: string; nombre: string };

function tituloDeSlug(slug: string) {
  const texto = slug.replace(/-/g, ' ').trim();
  if (!texto) return 'Jugar';
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}

function piezaDeRuta() {
  const m = location.pathname.match(/\/jugar\/([^/?#]+)\/?$/);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

function leerSesion(): SesionJugar | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(SESION_KEY) || '');
    const slug = String(g.slug || '');
    const token = String(g.token || '');
    if (!slug || !token) return null;
    return { slug, token, nombre: String(g.nombre || '') };
  } catch {
    return null;
  }
}

function recordar(slug: string, token: string, nombre: string) {
  const previo = leerSesion();
  const nombrePrevio = previo && previo.slug === slug ? previo.nombre : '';
  try {
    sessionStorage.setItem(SESION_KEY, JSON.stringify({
      slug,
      token,
      nombre: nombre.trim() || nombrePrevio,
    }));
    return true;
  } catch {
    return false;
  }
}

function publicarBarra(visible: string) {
  const ruta = '/jugar/' + encodeURIComponent(visible);
  let actual = location.pathname;
  try { actual = decodeURIComponent(location.pathname); } catch { /* pathname raro */ }
  if (actual !== '/jugar/' + visible || location.search || location.hash) {
    history.replaceState(null, '', ruta);
  }
}

// El portal abre /jugar.html?slug=…&token=…. El token se guarda en la
// pestaña y sale de la barra. Lo que se ve es el nombre del juego.
function leerCredenciales() {
  const params = new URLSearchParams(location.search);
  const slugQuery = params.get('slug') || '';
  const tokenQuery = params.get('token') || '';
  const pieza = piezaDeRuta();

  if (tokenQuery && (slugQuery || pieza)) {
    const slug = slugQuery || pieza;
    if (recordar(slug, tokenQuery, '')) {
      const guardado = leerSesion();
      document.title = guardado?.nombre || tituloDeSlug(slug);
      publicarBarra(guardado?.nombre || slug);
    } else {
      document.title = tituloDeSlug(slug);
    }
    return { slug, token: tokenQuery };
  }

  const sesion = leerSesion();
  if (!sesion) return { slug: pieza, token: '' };
  if (pieza && pieza !== sesion.slug && pieza !== sesion.nombre) {
    return { slug: pieza, token: '' };
  }
  if (sesion.nombre) {
    document.title = sesion.nombre;
    publicarBarra(sesion.nombre);
  } else {
    document.title = tituloDeSlug(sesion.slug);
    if (!pieza) publicarBarra(sesion.slug);
  }
  return { slug: sesion.slug, token: sesion.token };
}

function mostrarNombre(slug: string, token: string, nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) return;
  document.title = limpio;
  if (recordar(slug, token, limpio)) publicarBarra(limpio);
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

// Pantalla jugable real, sin login: la abre el portal de Win777 con
// ?slug=...&token=... El token identifica al jugador pero por sí solo
// no mueve plata: cada paso lo resuelve el servidor. En la barra queda
// el nombre del juego.
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
          if (!cancelado) {
            mostrarNombre(slug, token, String(datos.juego.nombre || ''));
            setEstado({ fase: 'listo', datos, saldo: Number(balance.saldo), slug, token });
          }
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
