// Temas visuales del Keno. Cosmético: no toca la matemática. Los
// colores de acierto / bola / fallo son semánticos (no por tema).
// `clasico` hereda del panel y es el default.

export interface TemaKeno {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  stageBg: string;
  vars: Record<string, string>;
  /** Color de la bola que sale del bolillero. */
  bola: string;
  /** Color del acierto (número marcado que salió). */
  acierto: string;
  /** Color de muestra para el selector de temas del editor. */
  acento: string;
  deco: string;
}

const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';

export const TEMAS: TemaKeno[] = [
  {
    id: 'clasico', nombre: 'Clásico', font: null, stageBg: '', vars: {},
    bola: '#e6b354', acierto: '#37d08b', acento: '#6b8afd', deco: '',
  },
  {
    id: 'vegas', nombre: 'Vegas',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1a1206, #0b0a08 72%)',
    vars: {
      '--accent': '#f5b638', '--accent-hover': '#ffc85a', '--accent-text': '#241a03', '--accent-soft': 'rgba(245,182,56,.15)',
      '--border': 'rgba(245,182,56,.28)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f6efdf', '--text-dim': '#b4a582', '--ok': '#4fd08a', '--danger': '#ff6a5f',
      '--kn-font-display': "'Orbitron', system-ui, sans-serif",
      '--kn-btn-bg': 'linear-gradient(180deg,#ffc85a,#f5b638)', '--kn-btn-ink': '#241a03',
    },
    bola: '#f5b638', acierto: '#4fd08a', acento: '#f5b638',
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
      '--kn-font-display': "'Orbitron', system-ui, sans-serif",
      '--kn-btn-bg': 'linear-gradient(180deg,#ff64bb,#ff3ea5)', '--kn-btn-ink': '#fff',
    },
    bola: '#4be0e6', acierto: '#4be0c4', acento: '#ff3ea5',
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
      '--kn-font-display': "'Sora', system-ui, sans-serif",
      '--kn-btn-bg': 'linear-gradient(180deg,#54cee6,#38bdd8)', '--kn-btn-ink': '#04161c',
    },
    bola: '#8fe0ef', acierto: '#3fd0a0', acento: '#38bdd8',
    deco: '',
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_KENO_DEFAULT = 'clasico';

export function temaKenoDe(id: string | undefined | null): TemaKeno {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_KENO_DEFAULT)!;
}

export function cargarFuenteKeno(tema: TemaKeno): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'kn-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
