// Temas visuales del Crash. Puro cosmético: no toca la matemática.
// Cada tema aporta paleta, variables CSS, fuente de Google y una capa
// de decoración de fondo. `clasico` = look sobrio que hereda del panel
// y es el valor por defecto (los juegos que ya existen no cambian).

export interface TemaCrash {
  id: string;
  nombre: string;
  font: { href: string; family: string } | null;
  /** Fondo del escenario (`el`). '' = no tocar. */
  stageBg: string;
  /** Variables CSS que se setean en la raíz de la mesa. */
  vars: Record<string, string>;
  /** Color por defecto del objeto que vuela (si el juego no fijó uno). */
  objeto: string;
  /** Color por defecto de la curva / número. */
  trazo: string;
  /** HTML de la capa de decoración (detrás de todo). '' = sin capa. */
  deco: string;
}

const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';

export const TEMAS: TemaCrash[] = [
  {
    id: 'clasico',
    nombre: 'Clásico',
    font: null,
    stageBg: '',
    vars: {},
    objeto: '#e8b13d',
    trazo: '#6b8afd',
    deco: '',
  },
  {
    id: 'vegas',
    nombre: 'Vegas',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(130% 70% at 50% 0%, #1a1206, #0b0a08 72%)',
    vars: {
      '--accent': '#f5b638', '--accent-hover': '#ffc85a', '--accent-text': '#241a03', '--accent-soft': 'rgba(245,182,56,.15)',
      '--border': 'rgba(245,182,56,.28)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f6efdf', '--text-dim': '#b4a582', '--ok': '#4fd08a', '--danger': '#ff6a5f',
      '--cr-font-display': "'Orbitron', system-ui, sans-serif",
      '--cr-num': '#f5b638', '--cr-glow': 'rgba(245,182,56,.4)',
      '--cr-grid': 'rgba(255,255,255,.05)',
      '--cr-btn-bg': 'linear-gradient(180deg,#ffc85a,#f5b638)', '--cr-btn-ink': '#241a03',
    },
    objeto: '#f5b638',
    trazo: '#f5b638',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 46px)"></div>`,
  },
  {
    id: 'neon',
    nombre: 'Neón',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Chakra+Petch:wght@500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 15% 5%, rgba(255,62,165,.28), transparent 55%), radial-gradient(120% 70% at 90% 95%, rgba(75,224,230,.22), transparent 55%), #0a0712',
    vars: {
      '--accent': '#ff3ea5', '--accent-hover': '#ff64bb', '--accent-text': '#2a0418', '--accent-soft': 'rgba(255,62,165,.16)',
      '--border': 'rgba(255,255,255,.14)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#fce9f5', '--text-dim': '#c79ab6', '--ok': '#4be0c4', '--danger': '#ff6a7d',
      '--cr-font-display': "'Orbitron', system-ui, sans-serif",
      '--cr-num': '#4be0e6', '--cr-glow': 'rgba(255,62,165,.42)',
      '--cr-grid': 'rgba(120,180,255,.07)',
      '--cr-btn-bg': 'linear-gradient(180deg,#ff64bb,#ff3ea5)', '--cr-btn-ink': '#fff',
    },
    objeto: '#4be0e6',
    trazo: '#ff3ea5',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 34px)"></div>`,
  },
  {
    id: 'cielo',
    nombre: 'Cielo',
    font: { href: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@500;700;800&display=swap', family: "'Nunito', system-ui, sans-serif" },
    stageBg: 'linear-gradient(180deg, #8fc7f5 0%, #c9e6fb 55%, #e9f5ff 100%)',
    vars: {
      '--accent': '#2f7de0', '--accent-hover': '#4a90e8', '--accent-text': '#ffffff', '--accent-soft': 'rgba(47,125,224,.14)',
      '--border': 'rgba(20,45,85,.16)', '--surface-alt': 'rgba(255,255,255,.65)',
      '--text': '#14263f', '--text-dim': '#496485', '--ok': '#2aa775', '--danger': '#e0574f',
      '--cr-font-display': "'Baloo 2', system-ui, sans-serif",
      '--cr-num': '#1e5fb8', '--cr-glow': 'rgba(47,125,224,.3)',
      '--cr-grid': 'rgba(20,45,85,.07)',
      '--cr-btn-bg': 'linear-gradient(180deg,#4a90e8,#2f7de0)', '--cr-btn-ink': '#fff',
    },
    objeto: '#ffffff',
    trazo: '#2f7de0',
    deco: `<div style="position:absolute;left:-40px;top:60px;width:150px;height:70px;background:rgba(255,255,255,.55);filter:blur(14px);border-radius:50%"></div>
           <div style="position:absolute;right:-30px;top:180px;width:120px;height:56px;background:rgba(255,255,255,.5);filter:blur(14px);border-radius:50%"></div>`,
  },
  {
    id: 'cyber',
    nombre: 'Cyber',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    stageBg: 'radial-gradient(120% 70% at 50% -8%, #0d2318, #060b08 72%)',
    vars: {
      '--accent': '#b6ff3d', '--accent-hover': '#c9ff66', '--accent-text': '#0f2200', '--accent-soft': 'rgba(182,255,61,.13)',
      '--border': 'rgba(182,255,61,.26)', '--surface-alt': 'rgba(182,255,61,.05)',
      '--text': '#e9ffe4', '--text-dim': '#8fb08a', '--ok': '#7bffb0', '--danger': '#ff7a6a',
      '--cr-font-display': "'Orbitron', system-ui, sans-serif",
      '--cr-num': '#b6ff3d', '--cr-glow': 'rgba(182,255,61,.34)',
      '--cr-grid': 'rgba(120,255,180,.07)',
      '--cr-btn-bg': 'linear-gradient(180deg,#c9ff66,#b6ff3d)', '--cr-btn-ink': '#0f2200',
    },
    objeto: '#b6ff3d',
    trazo: '#b6ff3d',
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(182,255,61,.05) 0 1px,transparent 1px 4px)"></div>`,
  },
  {
    id: 'fuego',
    nombre: 'Fuego',
    font: { href: 'https://fonts.googleapis.com/css2?family=Teko:wght@600;700&family=Barlow:wght@500;600;700&display=swap', family: "'Barlow', system-ui, sans-serif" },
    stageBg: 'radial-gradient(70% 45% at 50% 78%, rgba(232,115,34,.32), transparent 60%), linear-gradient(180deg, #17110f, #0d0908)',
    vars: {
      '--accent': '#e87322', '--accent-hover': '#f5883a', '--accent-text': '#1c0d03', '--accent-soft': 'rgba(232,115,34,.16)',
      '--border': 'rgba(245,154,46,.26)', '--surface-alt': 'rgba(245,154,46,.05)',
      '--text': '#f7ece2', '--text-dim': '#a58a7c', '--ok': '#ffcf7a', '--danger': '#ff5a48',
      '--cr-font-display': "'Teko', system-ui, sans-serif",
      '--cr-num': '#ffc23d', '--cr-glow': 'rgba(232,115,34,.5)',
      '--cr-grid': 'rgba(255,194,61,.06)',
      '--cr-btn-bg': 'linear-gradient(180deg,#ffb038,#e05a1c)', '--cr-btn-ink': '#1c0d03',
    },
    objeto: '#ffc23d',
    trazo: '#e87322',
    deco: `<div style="position:absolute;left:50%;bottom:-40px;width:340px;height:220px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(232,115,34,.4),transparent 66%)"></div>`,
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));
export const TEMA_CRASH_DEFAULT = 'clasico';

export function temaCrashDe(id: string | undefined | null): TemaCrash {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_CRASH_DEFAULT)!;
}

export function cargarFuenteCrash(tema: TemaCrash): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'cr-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
