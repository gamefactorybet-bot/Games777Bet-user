// Temas visuales compartidos por los juegos instantáneos (Limbo, Dice).
// Cosmético: no tocan la matemática. `clasico` hereda del panel.

export interface TemaInstant {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  stageBg: string;
  vars: Record<string, string>;
  /** Color del acento / número (si no hay tema custom). */
  acento: string;
}

export const TEMAS: TemaInstant[] = [
  {
    id: 'clasico', nombre: 'Clásico', font: null, stageBg: '', vars: {},
    acento: '#6b8afd',
  },
  {
    id: 'dorado', nombre: 'Dorado',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1c1406, #0b0a08 72%)',
    vars: {
      '--accent': '#e8c583', '--accent-hover': '#f3d69c', '--accent-text': '#241a03', '--accent-soft': 'rgba(232,197,131,.16)',
      '--border': 'rgba(232,197,131,.28)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f6efdf', '--text-dim': '#b4a582', '--ok': '#4fd08a', '--danger': '#ff6a5f',
      '--in-num': "'Sora', system-ui, sans-serif",
    },
    acento: '#e8c583',
  },
  {
    id: 'neon', nombre: 'Neón',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Chakra+Petch:wght@500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 15% 5%, rgba(255,62,165,.28), transparent 55%), radial-gradient(120% 70% at 90% 95%, rgba(75,224,230,.22), transparent 55%), #0a0712',
    vars: {
      '--accent': '#ff3ea5', '--accent-hover': '#ff64bb', '--accent-text': '#2a0418', '--accent-soft': 'rgba(255,62,165,.16)',
      '--border': 'rgba(255,255,255,.14)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#fce9f5', '--text-dim': '#c79ab6', '--ok': '#4be0c4', '--danger': '#ff6a7d',
      '--in-num': "'Orbitron', system-ui, sans-serif",
    },
    acento: '#ff3ea5',
  },
  {
    id: 'oceano', nombre: 'Océano',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Manrope:wght@500;600;700&display=swap', family: "'Manrope', system-ui, sans-serif" },
    stageBg: 'linear-gradient(180deg, #0b2b3f, #071722 78%)',
    vars: {
      '--accent': '#38bdd8', '--accent-hover': '#54cee6', '--accent-text': '#04161c', '--accent-soft': 'rgba(56,189,216,.14)',
      '--border': 'rgba(56,189,216,.24)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#e6f4f8', '--text-dim': '#8fb3bf', '--ok': '#3fd0a0', '--danger': '#ff7a6a',
      '--in-num': "'Sora', system-ui, sans-serif",
    },
    acento: '#38bdd8',
  },
  {
    id: 'casino', nombre: 'Casino', font: null,
    stageBg: 'radial-gradient(130% 75% at 50% 0%, #10321f, #0a1c12 74%)',
    vars: {
      '--accent': '#3bb46e', '--accent-hover': '#5cd08a', '--accent-text': '#04160c', '--accent-soft': 'rgba(59,180,110,.16)',
      '--border': 'rgba(59,180,110,.26)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#e9f3ec', '--text-dim': '#98b6a4', '--ok': '#4fd08a', '--danger': '#ff6a5f',
    },
    acento: '#3bb46e',
  },
  {
    id: 'rubi', nombre: 'Rubí', font: null,
    stageBg: 'radial-gradient(130% 75% at 50% 0%, #331116, #1a0a0d 74%)',
    vars: {
      '--accent': '#d64450', '--accent-hover': '#e8737c', '--accent-text': '#210306', '--accent-soft': 'rgba(214,68,80,.16)',
      '--border': 'rgba(214,68,80,.26)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#f6e9eb', '--text-dim': '#c79aa0', '--ok': '#4fd08a', '--danger': '#ff8a5f',
    },
    acento: '#d64450',
  },
  {
    id: 'zafiro', nombre: 'Zafiro', font: null,
    stageBg: 'radial-gradient(130% 75% at 50% 0%, #142650, #0a1330 74%)',
    vars: {
      '--accent': '#4f7ff0', '--accent-hover': '#89a6ff', '--accent-text': '#040c22', '--accent-soft': 'rgba(79,127,240,.16)',
      '--border': 'rgba(79,127,240,.26)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#e8eefc', '--text-dim': '#9aabca', '--ok': '#4fd0b0', '--danger': '#ff7a6a',
    },
    acento: '#4f7ff0',
  },
  {
    id: 'amatista', nombre: 'Amatista', font: null,
    stageBg: 'radial-gradient(130% 75% at 50% 0%, #2a1a45, #160b28 74%)',
    vars: {
      '--accent': '#9a6fe0', '--accent-hover': '#b895ec', '--accent-text': '#150324', '--accent-soft': 'rgba(154,111,224,.16)',
      '--border': 'rgba(154,111,224,.26)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#efe8fb', '--text-dim': '#b3a3cc', '--ok': '#4fd0a0', '--danger': '#ff7a6a',
    },
    acento: '#9a6fe0',
  },
  {
    id: 'grafito', nombre: 'Grafito', font: null,
    stageBg: 'linear-gradient(180deg, #1c1e22, #101113 82%)',
    vars: {
      '--accent': '#9aa3b0', '--accent-hover': '#c2c9d4', '--accent-text': '#0d0f12', '--accent-soft': 'rgba(154,163,176,.16)',
      '--border': 'rgba(255,255,255,.12)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#eceef2', '--text-dim': '#9aa0aa', '--ok': '#4fd08a', '--danger': '#ff6a5f',
    },
    acento: '#9aa3b0',
  },
  {
    id: 'arena', nombre: 'Arena', font: null,
    stageBg: 'radial-gradient(130% 75% at 50% 0%, #2a2013, #17100a 74%)',
    vars: {
      '--accent': '#c9a24a', '--accent-hover': '#ddbd74', '--accent-text': '#1c1305', '--accent-soft': 'rgba(201,162,74,.16)',
      '--border': 'rgba(201,162,74,.26)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f2ead9', '--text-dim': '#b6a888', '--ok': '#4fd08a', '--danger': '#ff6a5f',
    },
    acento: '#c9a24a',
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_INSTANT_DEFAULT = 'clasico';

export function temaInstantDe(id: string | undefined | null): TemaInstant {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_INSTANT_DEFAULT)!;
}

export function cargarFuenteInstant(tema: TemaInstant): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'in-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
