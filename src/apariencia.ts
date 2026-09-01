// =========================================================
// APARIENCIA
//
// Temas de "vidrio líquido" + fondo animado. Un tema es un set de
// colores (fondo, superficies, texto, acento) más 3 colores para el
// degradado que respira detrás de todo. El usuario elige hasta 2 y el
// fondo mezcla los colores de ambos.
//
// Todo se aplica escribiendo custom properties en :root, así que el
// cambio es inmediato y no hace falta recargar. La preferencia se
// guarda en localStorage (por navegador / por usuario).
// =========================================================

export interface Tema {
  id: string;
  nombre: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textDim: string;
  accent: string;
  /** 3 colores del degradado de fondo. */
  amb: [string, string, string];
}

export const TEMAS: Tema[] = [
  { id: 'onix',     nombre: 'Ónix',     bg: '#0c0e12', surface: '#14171d', surfaceAlt: '#1b1f27', text: '#e7eaef', textDim: '#8a93a1', accent: '#6b8afd', amb: ['#26397a', '#1f5563', '#3a2f6c'] },
  { id: 'abisal',   nombre: 'Abisal',   bg: '#080f14', surface: '#0f1a20', surfaceAlt: '#152530', text: '#e2f0f2', textDim: '#7e99a1', accent: '#3fc8d6', amb: ['#0b3a4a', '#12545a', '#0f6b74'] },
  { id: 'aurora',   nombre: 'Aurora',   bg: '#0a0f10', surface: '#111a1c', surfaceAlt: '#17262a', text: '#e6f1ec', textDim: '#899c94', accent: '#5be0a6', amb: ['#123f34', '#2a2f6e', '#3b6b52'] },
  { id: 'amatista', nombre: 'Amatista', bg: '#0e0b14', surface: '#171320', surfaceAlt: '#20192e', text: '#ece7f2', textDim: '#9a8fb0', accent: '#b98bff', amb: ['#3a2470', '#5a2a6e', '#241f5c'] },
  { id: 'brasa',    nombre: 'Brasa',    bg: '#120d0b', surface: '#1c1512', surfaceAlt: '#271b16', text: '#f1e8e2', textDim: '#a2938a', accent: '#e8894a', amb: ['#5a2a1e', '#6e3320', '#3a2340'] },
  { id: 'bruma',    nombre: 'Bruma',    bg: '#0d0f12', surface: '#161a1f', surfaceAlt: '#1e242b', text: '#e7ebef', textDim: '#8a93a1', accent: '#9db2d8', amb: ['#2c3542', '#3a4657', '#4a4f66'] },
];

export interface Apariencia {
  /** 1 o 2 ids de tema. El primero manda los colores; ambos alimentan el fondo. */
  temas: string[];
  /** Opacidad de los paneles de vidrio, 30–100. */
  opacidad: number;
  /** Desenfoque detrás del vidrio, 0–30 px. */
  desenfoque: number;
  /** Gotas de agua sobre el vidrio. */
  gotas: boolean;
  /** Intensidad del degradado de fondo, 0–90. */
  fondo: number;
  /** El fondo se mueve (respira lento). */
  movimiento: boolean;
}

const PREFIERE_MENOS_MOVIMIENTO =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const APARIENCIA_DEFECTO: Apariencia = {
  temas: ['onix'],
  opacidad: 92,
  desenfoque: 12,
  gotas: false,
  fondo: 22,
  movimiento: !PREFIERE_MENOS_MOVIMIENTO,
};

const CLAVE = 'gw777.apariencia';

export function cargarApariencia(): Apariencia {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return APARIENCIA_DEFECTO;
    const guardado = JSON.parse(crudo) as Partial<Apariencia>;
    const temas = (guardado.temas?.length ? guardado.temas : APARIENCIA_DEFECTO.temas)
      .filter((id) => TEMAS.some((t) => t.id === id))
      .slice(0, 2);
    return {
      ...APARIENCIA_DEFECTO,
      ...guardado,
      temas: temas.length ? temas : APARIENCIA_DEFECTO.temas,
    };
  } catch {
    return APARIENCIA_DEFECTO;
  }
}

export function guardarApariencia(a: Apariencia) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(a));
  } catch {
    /* modo incógnito o storage lleno: se pierde la preferencia, nada más. */
  }
}

function buscarTema(id: string): Tema {
  return TEMAS.find((t) => t.id === id) || TEMAS[0];
}

/** Escribe la apariencia como custom properties en :root. Efecto inmediato. */
export function aplicarApariencia(a: Apariencia) {
  const r = document.documentElement;
  const A = buscarTema(a.temas[0] || 'onix');
  const B = buscarTema(a.temas[1] || a.temas[0] || 'onix');

  r.style.setProperty('--bg', A.bg);
  r.style.setProperty('--surface', A.surface);
  r.style.setProperty('--surface-alt', A.surfaceAlt);
  r.style.setProperty('--text', A.text);
  r.style.setProperty('--text-dim', A.textDim);
  r.style.setProperty('--accent', A.accent);

  r.style.setProperty('--amb-1', A.amb[0]);
  r.style.setProperty('--amb-2', A.amb[1]);
  r.style.setProperty('--amb-3', A.amb[2]);
  r.style.setProperty('--amb-4', B.amb[0]);
  r.style.setProperty('--amb-5', B.amb[1]);

  r.style.setProperty('--glass-pct', `${a.opacidad}%`);
  r.style.setProperty('--glass-blur', `${a.desenfoque}px`);
  r.style.setProperty('--amb-op', String(a.fondo / 100));
  r.style.setProperty('--gota-op', a.gotas ? '1' : '0');
  r.classList.toggle('sin-movimiento', !a.movimiento);
}

/** Aplica lo guardado. Se llama una vez, apenas arranca la app. */
export function iniciarApariencia() {
  aplicarApariencia(cargarApariencia());
}
