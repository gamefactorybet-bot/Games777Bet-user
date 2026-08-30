// Temas visuales del Plinko. Cosmético: no toca la matemática. Los
// colores de las cubetas van por multiplicador (semánticos), no por
// tema. `clasico` hereda del panel y es el default.

export interface TemaPlinko {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  stageBg: string;
  vars: Record<string, string>;
  /** Color por defecto de los clavos y de la bolita. */
  clavo: string;
  bola: string;
  deco: string;
}

const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';

export const TEMAS: TemaPlinko[] = [
  {
    id: 'clasico', nombre: 'Clásico', font: null, stageBg: '', vars: {},
    clavo: 'rgba(255,255,255,.5)', bola: '#6b8afd', deco: '',
  },
  {
    id: 'vegas', nombre: 'Vegas',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1a1206, #0b0a08 72%)',
    vars: {
      '--accent': '#f5b638', '--accent-hover': '#ffc85a', '--accent-text': '#241a03', '--accent-soft': 'rgba(245,182,56,.15)',
      '--border': 'rgba(245,182,56,.28)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f6efdf', '--text-dim': '#b4a582', '--ok': '#4fd08a', '--danger': '#ff6a5f',
      '--pk-font-display': "'Orbitron', system-ui, sans-serif",
      '--pk-btn-bg': 'linear-gradient(180deg,#ffc85a,#f5b638)', '--pk-btn-ink': '#241a03',
    },
    clavo: 'rgba(255,255,255,.5)', bola: '#f5b638',
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
      '--pk-font-display': "'Orbitron', system-ui, sans-serif",
      '--pk-btn-bg': 'linear-gradient(180deg,#ff64bb,#ff3ea5)', '--pk-btn-ink': '#fff',
    },
    clavo: 'rgba(120,200,255,.55)', bola: '#4be0e6',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px)"></div>`,
  },
  {
    id: 'cyber', nombre: 'Cyber',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 50% -8%, #0d2318, #060b08 72%)',
    vars: {
      '--accent': '#b6ff3d', '--accent-hover': '#c9ff66', '--accent-text': '#0f2200', '--accent-soft': 'rgba(182,255,61,.13)',
      '--border': 'rgba(182,255,61,.26)', '--surface-alt': 'rgba(182,255,61,.05)',
      '--text': '#e9ffe4', '--text-dim': '#8fb08a', '--ok': '#7bffb0', '--danger': '#ff7a6a',
      '--pk-font-display': "'Orbitron', system-ui, sans-serif",
      '--pk-btn-bg': 'linear-gradient(180deg,#c9ff66,#b6ff3d)', '--pk-btn-ink': '#0f2200',
    },
    clavo: 'rgba(150,255,190,.5)', bola: '#b6ff3d',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(182,255,61,.05) 0 1px,transparent 1px 4px)"></div>`,
  },
  {
    id: 'oceano', nombre: 'Océano',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Manrope:wght@500;600;700&display=swap', family: "'Manrope', system-ui, sans-serif" },
    stageBg: 'linear-gradient(180deg, #0b2b3f, #071722 78%)',
    vars: {
      '--accent': '#38bdd8', '--accent-hover': '#54cee6', '--accent-text': '#04161c', '--accent-soft': 'rgba(56,189,216,.14)',
      '--border': 'rgba(56,189,216,.24)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#e6f4f8', '--text-dim': '#8fb3bf', '--ok': '#3fd0a0', '--danger': '#ff7a6a',
      '--pk-font-display': "'Sora', system-ui, sans-serif",
      '--pk-btn-bg': 'linear-gradient(180deg,#54cee6,#38bdd8)', '--pk-btn-ink': '#04161c',
    },
    clavo: 'rgba(180,230,240,.5)', bola: '#8fe0ef',
    deco: '',
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_PLINKO_DEFAULT = 'clasico';

export function temaPlinkoDe(id: string | undefined | null): TemaPlinko {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_PLINKO_DEFAULT)!;
}

export function cargarFuentePlinko(tema: TemaPlinko): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'pk-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
