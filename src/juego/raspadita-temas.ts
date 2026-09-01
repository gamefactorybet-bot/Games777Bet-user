// Temas visuales de la raspadita. Cosmético: no toca la matemática.
// `clasico` hereda del panel y es el default.

export interface TemaRaspa {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  /** Fondo del área de juego (si el juego no subió uno propio). */
  stageBg: string;
  vars: Record<string, string>;
  /** Color de la cobertura que se raspa, si el juego no eligió uno. */
  cobertura: string;
  /** Color del borde/realce de una celda ganadora. */
  ganar: string;
  deco: string;
}

const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';

export const TEMAS: TemaRaspa[] = [
  {
    id: 'clasico', nombre: 'Clásico', font: null, stageBg: '', vars: {},
    cobertura: '#6b7280', ganar: '#e8c583', deco: '',
  },
  {
    id: 'dorado', nombre: 'Dorado',
    font: { href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1c1406, #0b0a08 72%)',
    vars: {
      '--accent': '#e8c583', '--accent-hover': '#f3d69c', '--accent-text': '#241a03', '--accent-soft': 'rgba(232,197,131,.16)',
      '--border': 'rgba(232,197,131,.28)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f6efdf', '--text-dim': '#b4a582', '--ok': '#4fd08a', '--danger': '#ff6a5f',
      '--rs-font-display': "'Cinzel', serif",
      '--rs-btn-bg': 'linear-gradient(180deg,#f3d69c,#e8c583)', '--rs-btn-ink': '#241a03',
    },
    cobertura: '#8a7a4e', ganar: '#ffd77a',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 46px)"></div>`,
  },
  {
    id: 'neon', nombre: 'Neón',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Chakra+Petch:wght@500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 15% 5%, rgba(255,62,165,.28), transparent 55%), radial-gradient(120% 70% at 90% 95%, rgba(75,224,230,.22), transparent 55%), #0a0712',
    vars: {
      '--accent': '#ff3ea5', '--accent-hover': '#ff64bb', '--accent-text': '#2a0418', '--accent-soft': 'rgba(255,62,165,.16)',
      '--border': 'rgba(255,255,255,.14)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#fce9f5', '--text-dim': '#c79ab6', '--ok': '#4be0c4', '--danger': '#ff6a7d',
      '--rs-font-display': "'Orbitron', system-ui, sans-serif",
      '--rs-btn-bg': 'linear-gradient(180deg,#ff64bb,#ff3ea5)', '--rs-btn-ink': '#fff',
    },
    cobertura: '#4a3350', ganar: '#4be0e6',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px)"></div>`,
  },
  {
    id: 'oceano', nombre: 'Océano',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Manrope:wght@500;600;700&display=swap', family: "'Manrope', system-ui, sans-serif" },
    stageBg: 'linear-gradient(180deg, #0b2b3f, #071722 78%)',
    vars: {
      '--accent': '#38bdd8', '--accent-hover': '#54cee6', '--accent-text': '#04161c', '--accent-soft': 'rgba(56,189,216,.14)',
      '--border': 'rgba(56,189,216,.24)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#e6f4f8', '--text-dim': '#8fb3bf', '--ok': '#3fd0a0', '--danger': '#ff7a6a',
      '--rs-font-display': "'Sora', system-ui, sans-serif",
      '--rs-btn-bg': 'linear-gradient(180deg,#54cee6,#38bdd8)', '--rs-btn-ink': '#04161c',
    },
    cobertura: '#38566b', ganar: '#8fe0ef', deco: '',
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_RASPA_DEFAULT = 'clasico';

export function temaRaspaDe(id: string | undefined | null): TemaRaspa {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_RASPA_DEFAULT)!;
}

export function cargarFuenteRaspa(tema: TemaRaspa): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'rs-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
