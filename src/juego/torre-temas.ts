// Temas visuales de la Torre. Cosmético: no toca la matemática. Los
// colores de segura / trampa / multiplicador son semánticos.
// `clasico` hereda del panel y es el default.

export interface TemaTorre {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  stageBg: string;
  vars: Record<string, string>;
  /** Color del "zafó" (casilla segura). */
  safe: string;
  /** Color del multiplicador grande. */
  gold: string;
  /** Color de muestra para el selector del editor. */
  acento: string;
  deco: string;
}

const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';

export const TEMAS: TemaTorre[] = [
  {
    id: 'clasico', nombre: 'Clásico', font: null, stageBg: '', vars: {},
    safe: '#37d08b', gold: '#e6b354', acento: '#6b8afd', deco: '',
  },
  {
    id: 'mazmorra', nombre: 'Mazmorra',
    font: { href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1c1206, #0a0806 74%)',
    vars: {
      '--accent': '#e6b354', '--accent-hover': '#f2cd7e', '--accent-text': '#241a03', '--accent-soft': 'rgba(230,179,84,.15)',
      '--border': 'rgba(230,179,84,.26)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f4ecd9', '--text-dim': '#b0a284', '--ok': '#4fd08a', '--danger': '#e5686b',
      '--to-font-display': "'Cinzel', system-ui, serif",
      '--to-btn-bg': 'linear-gradient(180deg,#f2cd7e,#e6b354)', '--to-btn-ink': '#241a03',
    },
    safe: '#4fd08a', gold: '#f2cd7e', acento: '#e6b354',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 40px)"></div>`,
  },
  {
    id: 'neon', nombre: 'Neón',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Chakra+Petch:wght@500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 15% 5%, rgba(255,62,165,.28), transparent 55%), radial-gradient(120% 70% at 90% 95%, rgba(75,224,230,.22), transparent 55%), #0a0712',
    vars: {
      '--accent': '#ff3ea5', '--accent-hover': '#ff64bb', '--accent-text': '#2a0418', '--accent-soft': 'rgba(255,62,165,.16)',
      '--border': 'rgba(255,255,255,.14)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#fce9f5', '--text-dim': '#c79ab6', '--ok': '#4be0c4', '--danger': '#ff6a7d',
      '--to-font-display': "'Orbitron', system-ui, sans-serif",
      '--to-btn-bg': 'linear-gradient(180deg,#ff64bb,#ff3ea5)', '--to-btn-ink': '#fff',
    },
    safe: '#4be0c4', gold: '#ffd24b', acento: '#ff3ea5',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px)"></div>`,
  },
  {
    id: 'bosque', nombre: 'Bosque',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Manrope:wght@500;600;700&display=swap', family: "'Manrope', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 50% -8%, #10251a, #060d09 74%)',
    vars: {
      '--accent': '#5bd08c', '--accent-hover': '#78dba3', '--accent-text': '#04160c', '--accent-soft': 'rgba(91,208,140,.14)',
      '--border': 'rgba(91,208,140,.24)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#e7f4ec', '--text-dim': '#93b4a1', '--ok': '#5bd08c', '--danger': '#ff7a6a',
      '--to-font-display': "'Sora', system-ui, sans-serif",
      '--to-btn-bg': 'linear-gradient(180deg,#78dba3,#5bd08c)', '--to-btn-ink': '#04160c',
    },
    safe: '#8fe6b4', gold: '#e6c96b', acento: '#5bd08c',
    deco: '',
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_TORRE_DEFAULT = 'clasico';

export function temaTorreDe(id: string | undefined | null): TemaTorre {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_TORRE_DEFAULT)!;
}

export function cargarFuenteTorre(tema: TemaTorre): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'to-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
