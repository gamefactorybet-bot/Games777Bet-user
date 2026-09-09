// Temas visuales de Mines. Cosmético: no toca margen ni RTP.
// `clasico` hereda del panel (juegos viejos no cambian de aspecto).

export interface TemaMines {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  stageBg: string;
  vars: Record<string, string>;
  /** Muestra del selector. */
  acento: string;
  /** Casilla segura / mina (colores + emoji por defecto). */
  safe: string;
  mine: string;
  emojiSafe: string;
  emojiMina: string;
  deco: string;
}

const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';

export const TEMAS: TemaMines[] = [
  {
    id: 'clasico', nombre: 'Clásico', font: null, stageBg: '', vars: {},
    acento: '#6b8afd', safe: '#5bbf88', mine: '#e5686b',
    emojiSafe: '💎', emojiMina: '💣', deco: '',
  },
  {
    id: 'vegas', nombre: 'Vegas',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1a1206, #0b0a08 72%)',
    vars: {
      '--accent': '#f5b638', '--accent-hover': '#ffc85a', '--accent-text': '#241a03', '--accent-soft': 'rgba(245,182,56,.15)',
      '--border': 'rgba(245,182,56,.28)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f6efdf', '--text-dim': '#b4a582', '--ok': '#4fd08a', '--danger': '#ff6a5f',
      '--mn-tile': 'rgba(245,182,56,.08)', '--mn-tile-border': 'rgba(245,182,56,.35)',
      '--mn-safe': '#f5b638', '--mn-safe-bg': 'rgba(245,182,56,.18)',
      '--mn-mine': '#ff6a5f', '--mn-mine-bg': 'rgba(255,106,95,.2)',
    },
    acento: '#f5b638', safe: '#f5b638', mine: '#ff6a5f',
    emojiSafe: '⭐', emojiMina: '💀',
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
      '--mn-tile': 'rgba(75,224,230,.08)', '--mn-tile-border': 'rgba(255,62,165,.4)',
      '--mn-safe': '#4be0c4', '--mn-safe-bg': 'rgba(75,224,196,.2)',
      '--mn-mine': '#ff3ea5', '--mn-mine-bg': 'rgba(255,62,165,.22)',
    },
    acento: '#ff3ea5', safe: '#4be0c4', mine: '#ff3ea5',
    emojiSafe: '💠', emojiMina: '💥',
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
      '--mn-tile': 'rgba(56,189,216,.1)', '--mn-tile-border': 'rgba(56,189,216,.35)',
      '--mn-safe': '#3fd0a0', '--mn-safe-bg': 'rgba(63,208,160,.2)',
      '--mn-mine': '#ff7a6a', '--mn-mine-bg': 'rgba(255,122,106,.2)',
    },
    acento: '#38bdd8', safe: '#3fd0a0', mine: '#ff7a6a',
    emojiSafe: '🐚', emojiMina: '💣',
    deco: '',
  },
  {
    id: 'bunker', nombre: 'Bunker',
    font: { href: 'https://fonts.googleapis.com/css2?family=Teko:wght@600;700&family=Barlow:wght@500;600;700&display=swap', family: "'Barlow', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 50% -8%, #1a2418, #0a0e09 74%)',
    vars: {
      '--accent': '#8fbf5a', '--accent-hover': '#a8d16f', '--accent-text': '#12180c', '--accent-soft': 'rgba(143,191,90,.14)',
      '--border': 'rgba(143,191,90,.28)', '--surface-alt': 'rgba(255,255,255,.04)',
      '--text': '#e6eedc', '--text-dim': '#9aab88', '--ok': '#8fbf5a', '--danger': '#d45a3a',
      '--mn-tile': 'rgba(143,191,90,.08)', '--mn-tile-border': 'rgba(143,191,90,.32)',
      '--mn-safe': '#8fbf5a', '--mn-safe-bg': 'rgba(143,191,90,.2)',
      '--mn-mine': '#d45a3a', '--mn-mine-bg': 'rgba(212,90,58,.22)',
    },
    acento: '#8fbf5a', safe: '#8fbf5a', mine: '#d45a3a',
    emojiSafe: '🛡️', emojiMina: '☢️',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 28px)"></div>`,
  },
  {
    id: 'arcade', nombre: 'Arcade',
    font: { href: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 80% at 50% 0%, #1a1040, #0c0818 70%)',
    vars: {
      '--accent': '#7c5cff', '--accent-hover': '#9b82ff', '--accent-text': '#fff', '--accent-soft': 'rgba(124,92,255,.16)',
      '--border': 'rgba(124,92,255,.3)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#f0eaff', '--text-dim': '#a898d4', '--ok': '#3ee0a0', '--danger': '#ff5a8a',
      '--mn-tile': 'rgba(124,92,255,.1)', '--mn-tile-border': 'rgba(124,92,255,.4)',
      '--mn-safe': '#3ee0a0', '--mn-safe-bg': 'rgba(62,224,160,.2)',
      '--mn-mine': '#ff5a8a', '--mn-mine-bg': 'rgba(255,90,138,.22)',
    },
    acento: '#7c5cff', safe: '#3ee0a0', mine: '#ff5a8a',
    emojiSafe: '👾', emojiMina: '☠️',
    deco: '',
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_MINES_DEFAULT = 'clasico';

export function temaMinesDe(id: string | undefined | null): TemaMines {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_MINES_DEFAULT)!;
}

export function cargarFuenteMines(tema: TemaMines): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'mn-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}

/** Aplica paleta / fondo / fuente al escenario. Limpia al desmontar. */
export function aplicarTemaMines(
  el: HTMLElement,
  tema: TemaMines,
  fondoPantalla: boolean,
): () => void {
  cargarFuenteMines(tema);
  const prevBg = el.style.background;
  if (tema.stageBg && !fondoPantalla) el.style.background = tema.stageBg;
  const claves = Object.keys(tema.vars);
  for (const k of claves) el.style.setProperty(k, tema.vars[k]);
  if (tema.font) el.style.setProperty('--mn-body', tema.font.family);
  return () => {
    el.style.background = prevBg;
    for (const k of claves) el.style.removeProperty(k);
    el.style.removeProperty('--mn-body');
  };
}
