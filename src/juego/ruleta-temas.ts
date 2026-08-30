// Temas visuales de la Ruleta de botones. Es puro cosmético: no toca
// la matemática ni el resultado del giro. Cada tema aporta la paleta
// de las 9 tajadas, el fondo del escenario, una capa de decoración y
// un puñado de variables CSS que la "mesa" (`RuletaBotones`) y la
// rueda (`Ruleta`) leen para repintarse.
//
// El id `clasico` es el look original (hereda los colores del panel y
// usa el color propio de cada número); es el valor por defecto para
// que los juegos que ya existen no cambien de aspecto.

export interface TemaRuletaWheel {
  /** Borde exterior de la rueda. */
  border: string;
  /** Puntero de arriba. */
  pointer: string;
  /** Aro interior. */
  ring: string;
  /** Relleno del cubo central. */
  hub: string;
  /** Texto del cubo central. */
  hubInk: string;
  /** Borde del cubo central. */
  hubBorder: string;
  /** `box-shadow` de la rueda (glow incluido). */
  glow: string;
  /** Resaltado de la tajada ganadora. */
  winner: string;
}

export interface TemaRuleta {
  id: string;
  nombre: string;
  /** Fuente de Google a inyectar (`null` = usar la del panel). */
  font: { href: string; family: string } | null;
  /** Paleta de las 9 tajadas, en el orden de `numeros`. `null` = usar
   *  el color propio de cada número (tema clásico). */
  seg: string[] | null;
  /** Fondo del escenario (`el`). `''` = no tocar. */
  stageBg: string;
  /** Variables CSS que se setean en la raíz de la mesa. */
  vars: Record<string, string>;
  wheel: TemaRuletaWheel;
  /** HTML de la capa de decoración (detrás de todo). `''` = sin capa. */
  deco: string;
}

// ---- helpers de decoración ----
function estrellas(n: number, seed: number): string {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  let o = '';
  for (let i = 0; i < n; i++) {
    const x = (rnd() * 100).toFixed(1);
    const y = (rnd() * 100).toFixed(1);
    const r = (0.3 + rnd() * 1.3).toFixed(2);
    const op = (0.2 + rnd() * 0.6).toFixed(2);
    o += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${op}"/>`;
  }
  return o;
}
const capaAbs = 'position:absolute;inset:0;width:100%;height:100%';
const svgAbs = `<svg style="${capaAbs}" viewBox="0 0 420 860" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;

function greca(c: string): string {
  let d = '';
  for (let x = -20; x < 440; x += 40) d += `M${x} 10 h20 v10 h-10 v10 h20 v-30 `;
  return `${svgAbs}<g stroke="${c}" stroke-width="2" fill="none" opacity=".3">
    <path d="${d}" transform="translate(0,6)"/>
    <path d="${d}" transform="translate(0,822) scale(1,-1)"/></g></svg>`;
}
const brackets = (c: string) => `${svgAbs}<path d="M18 46 L18 18 L46 18 M402 18 L402 46 M18 814 L18 842 L46 842 M402 842 L402 814"
  fill="none" stroke="${c}" stroke-width="1.5" opacity=".5"/></svg>`;

// Base de `wheel` para no repetir: cada tema pisa lo que necesita.
const w = (o: Partial<TemaRuletaWheel>): TemaRuletaWheel => ({
  border: '#0c0e12',
  pointer: '#e7eaef',
  ring: 'rgba(255,255,255,.12)',
  hub: 'transparent',
  hubInk: 'transparent',
  hubBorder: 'transparent',
  glow: 'none',
  winner: 'rgba(255,255,255,.28)',
  ...o,
});

export const TEMAS: TemaRuleta[] = [
  {
    id: 'clasico',
    nombre: 'Clásico',
    font: null,
    seg: null,
    stageBg: '',
    vars: {},
    wheel: w({}),
    deco: '',
  },
  {
    id: 'neon',
    nombre: 'Neón Vegas',
    font: { href: 'https://fonts.googleapis.com/css2?family=Bungee&family=Oxanium:wght@400;600;700;800&display=swap', family: "'Oxanium', system-ui, sans-serif" },
    seg: ['#2b2545', '#3a2d78', '#5a37c4', '#8438e0', '#c33ce0', '#ef3ba6', '#ff5fb0', '#ff3b6b', '#ffd23b'],
    stageBg: 'radial-gradient(120% 70% at 12% 6%, rgba(239,59,166,.3), transparent 55%), radial-gradient(120% 70% at 90% 96%, rgba(63,214,224,.24), transparent 55%), #0a0912',
    vars: {
      '--accent': '#ef3ba6', '--accent-hover': '#ff5fb0', '--accent-soft': 'rgba(239,59,166,.16)',
      '--border': 'rgba(255,255,255,.14)', '--surface-alt': 'rgba(255,255,255,.05)',
      '--text': '#f3edff', '--text-dim': '#9a8fc0', '--ok': '#3fe0c4', '--danger': '#ff6b8a',
      '--rb-font-display': "'Bungee', system-ui, sans-serif",
      '--rb-gold': '#ffd23b', '--rb-gold-soft': 'rgba(255,210,59,.14)',
      '--rb-spin-bg': 'linear-gradient(180deg,#ff5fb0,#ef3ba6)', '--rb-spin-ink': '#fff',
      '--rb-spin-shadow': '0 0 26px rgba(239,59,166,.6), 0 8px 20px rgba(0,0,0,.45)',
    },
    wheel: w({
      border: '#1c1636', pointer: '#3fe0c4', ring: 'rgba(63,224,224,.28)',
      hub: 'radial-gradient(circle at 35% 30%, #2a1c48, #0d0820)', hubInk: '#ff5fb0', hubBorder: 'rgba(239,59,166,.55)',
      glow: '0 0 0 6px #140f28, 0 0 44px rgba(239,59,166,.5), 0 24px 60px rgba(0,0,0,.6)',
    }),
    deco: `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 34px)"></div>`,
  },
  {
    id: 'oro',
    nombre: 'Oro Clásico',
    font: { href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=EB+Garamond:wght@400;500;600;700&display=swap', family: "'EB Garamond', Georgia, serif" },
    seg: ['#14241d', '#7a1f1f', '#14241d', '#7a1f1f', '#5a4a1e', '#8a6a24', '#a9862a', '#caa23c', '#f2d888'],
    stageBg: 'radial-gradient(130% 80% at 50% 0%, #14513d, #0b2c22 70%)',
    vars: {
      '--accent': '#caa23c', '--accent-hover': '#e0bb55', '--accent-soft': 'rgba(202,162,60,.16)',
      '--border': 'rgba(202,162,60,.32)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#f4ecd8', '--text-dim': '#9db8a6', '--ok': '#7fd6a0', '--danger': '#e5686b',
      '--rb-font-display': "'Cinzel', Georgia, serif",
      '--rb-gold': '#e9c96a', '--rb-gold-soft': 'rgba(233,201,106,.14)',
      '--rb-spin-bg': 'linear-gradient(180deg,#e9c96a,#b98a2e)', '--rb-spin-ink': '#241a08',
      '--rb-spin-shadow': '0 10px 24px rgba(0,0,0,.45)',
    },
    wheel: w({
      border: '#0a251d', pointer: '#e9c96a', ring: 'rgba(233,201,106,.4)',
      hub: 'radial-gradient(circle at 35% 30%, #1c5140, #0a251d)', hubInk: '#e9c96a', hubBorder: 'rgba(233,201,106,.6)',
      glow: '0 0 0 7px #0a251d, 0 0 0 9px rgba(233,201,106,.55), 0 26px 60px rgba(0,0,0,.55)',
      winner: 'rgba(233,201,106,.35)',
    }),
    deco: `<div style="${capaAbs};margin:10px;border:2px solid rgba(233,201,106,.35);border-radius:12px"></div>
           <div style="${capaAbs};margin:16px;border:1px solid rgba(233,201,106,.18);border-radius:10px"></div>`,
  },
  {
    id: 'cyber',
    nombre: 'Cyber HUD',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap', family: "'Rajdhani', system-ui, sans-serif" },
    seg: ['#123047', '#154b5e', '#1b6b6b', '#1f8a72', '#2fae6b', '#5bd45b', '#9be04a', '#d6e04a', '#eaff5c'],
    stageBg: 'radial-gradient(120% 70% at 50% -8%, #0d2338, #060b14 70%)',
    vars: {
      '--accent': '#2fd6c4', '--accent-hover': '#5be4d6', '--accent-soft': 'rgba(47,214,196,.14)',
      '--border': 'rgba(91,212,212,.28)', '--surface-alt': 'rgba(91,212,212,.05)',
      '--text': '#dff3f5', '--text-dim': '#6f93a0', '--ok': '#7bffb0', '--danger': '#ff7a7a',
      '--rb-font-display': "'Orbitron', system-ui, sans-serif",
      '--rb-gold': '#eaff5c', '--rb-gold-soft': 'rgba(234,255,92,.1)',
      '--rb-spin-bg': 'linear-gradient(180deg,#2fd6c4,#1a9e94)', '--rb-spin-ink': '#02110f',
      '--rb-spin-shadow': '0 0 22px rgba(47,214,196,.5), 0 8px 16px rgba(0,0,0,.5)',
      '--rb-radius': '3px',
    },
    wheel: w({
      border: '#0a1a24', pointer: '#eaff5c', ring: 'rgba(91,212,212,.35)',
      hub: 'radial-gradient(circle at 35% 30%, #123a44, #05131a)', hubInk: '#5bd4d4', hubBorder: 'rgba(91,212,212,.6)',
      glow: '0 0 0 4px #0a1a24, 0 0 0 5px rgba(91,212,212,.4), 0 0 40px rgba(47,214,196,.3), 0 22px 50px rgba(0,0,0,.6)',
    }),
    deco: brackets('#5bd4d4') + `<div style="${capaAbs};background-image:repeating-linear-gradient(0deg,rgba(91,212,212,.06) 0 1px,transparent 1px 4px)"></div>`,
  },
  {
    id: 'minimal',
    nombre: 'Minimal Claro',
    font: { href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap', family: "'Space Grotesk', system-ui, sans-serif" },
    seg: ['#e8e3d8', '#e0cbb8', '#d7b49a', '#cd9a7c', '#c48360', '#bb6f4a', '#b05a37', '#9c4a2c', '#7c3720'],
    stageBg: '#f6f4ef',
    vars: {
      '--accent': '#b05a37', '--accent-hover': '#c26a45', '--accent-text': '#ffffff', '--accent-soft': 'rgba(176,90,55,.1)',
      '--border': 'rgba(33,31,28,.14)', '--surface-alt': '#ffffff',
      '--text': '#211f1c', '--text-dim': '#8a8478', '--ok': '#3f7d4f', '--danger': '#b3261e',
      '--rb-font-display': "'Space Grotesk', system-ui, sans-serif",
      '--rb-gold': '#9a6b1f', '--rb-gold-soft': 'rgba(154,107,31,.12)',
      '--rb-spin-bg': '#211f1c', '--rb-spin-ink': '#f6f4ef',
      '--rb-spin-shadow': '0 12px 26px rgba(33,31,28,.2)',
      '--rb-btn-bg': '#ffffff', '--rb-radius': '12px',
    },
    wheel: w({
      border: '#ffffff', pointer: '#211f1c', ring: 'rgba(33,31,28,.1)',
      hub: '#ffffff', hubInk: '#b05a37', hubBorder: 'rgba(33,31,28,.16)',
      glow: '0 0 0 8px #ffffff, 0 18px 44px rgba(33,31,28,.16)',
      winner: 'rgba(33,31,28,.14)',
    }),
    deco: `<div style="position:absolute;left:50%;top:150px;width:520px;height:520px;transform:translateX(-50%);border:1px solid rgba(33,31,28,.06);border-radius:50%"></div>`,
  },
  {
    id: 'synthwave',
    nombre: 'Synthwave 80s',
    font: { href: 'https://fonts.googleapis.com/css2?family=Audiowide&family=Chakra+Petch:wght@400;500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    seg: ['#2c1566', '#4a1f9e', '#7a2be2', '#b03cd9', '#e03fa4', '#ff4f6d', '#ff7f3d', '#ffb23d', '#ffe25c'],
    stageBg: 'linear-gradient(180deg, #2a1150 0%, #6a1f78 45%, #d1466a 72%, #ff8a4c 100%)',
    vars: {
      '--accent': '#ff3fa4', '--accent-hover': '#ff63ba', '--accent-soft': 'rgba(255,63,164,.16)',
      '--border': 'rgba(255,255,255,.2)', '--surface-alt': 'rgba(255,255,255,.06)',
      '--text': '#fdeaff', '--text-dim': '#c39ad6', '--ok': '#5ffbd0', '--danger': '#ff6b8a',
      '--rb-font-display': "'Audiowide', system-ui, sans-serif",
      '--rb-gold': '#ffe25c', '--rb-gold-soft': 'rgba(255,226,92,.14)',
      '--rb-spin-bg': 'linear-gradient(180deg,#ffe25c,#ff7f3d)', '--rb-spin-ink': '#26041a',
      '--rb-spin-shadow': '0 0 24px rgba(255,127,61,.55), 0 8px 18px rgba(0,0,0,.4)',
      '--rb-radius': '4px',
    },
    wheel: w({
      border: '#1a0b33', pointer: '#5ffbd0', ring: 'rgba(95,251,208,.4)',
      hub: 'linear-gradient(180deg, #ff9a4c, #ff3fa4)', hubInk: '#26041a', hubBorder: 'rgba(255,226,92,.7)',
      glow: '0 0 0 5px #1a0b33, 0 0 0 6px rgba(255,63,164,.6), 0 0 46px rgba(255,138,76,.45), 0 22px 54px rgba(0,0,0,.5)',
    }),
    deco: `${svgAbs}<g stroke="rgba(95,251,208,.32)" stroke-width="1" fill="none">
        <line x1="0" y1="712" x2="420" y2="712"/><line x1="-160" y1="860" x2="150" y2="712"/>
        <line x1="70" y1="860" x2="185" y2="712"/><line x1="350" y1="860" x2="235" y2="712"/>
        <line x1="580" y1="860" x2="270" y2="712"/><line x1="0" y1="774" x2="420" y2="774"/>
        <line x1="0" y1="820" x2="420" y2="820"/></g></svg>
      <div style="position:absolute;left:50%;top:80px;width:320px;height:320px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle at 50% 40%, rgba(255,226,92,.32), rgba(255,63,164,.1) 60%, transparent 72%)"></div>`,
  },
  {
    id: 'candy',
    nombre: 'Candy Pop',
    font: { href: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap', family: "'Nunito', system-ui, sans-serif" },
    seg: ['#c7e7d6', '#a9dcec', '#8ecae6', '#ffd6a5', '#ffb5a7', '#ff8fab', '#fca311', '#f9c74f', '#ef476f'],
    stageBg: 'radial-gradient(80% 55% at 15% 8%, #d6f5ff, transparent 60%), radial-gradient(80% 55% at 90% 20%, #ffe3ef, transparent 60%), #e9fbf1',
    vars: {
      '--accent': '#ff6fa5', '--accent-hover': '#ff88b6', '--accent-text': '#ffffff', '--accent-soft': 'rgba(255,111,165,.14)',
      '--border': 'rgba(47,59,69,.12)', '--surface-alt': '#ffffff',
      '--text': '#2f3b45', '--text-dim': '#7f9aa5', '--ok': '#2aa775', '--danger': '#e63950',
      '--rb-font-display': "'Baloo 2', system-ui, sans-serif",
      '--rb-gold': '#c9800a', '--rb-gold-soft': 'rgba(249,168,37,.16)',
      '--rb-spin-bg': 'linear-gradient(180deg,#ff8fbf,#ff6fa5)', '--rb-spin-ink': '#ffffff',
      '--rb-spin-shadow': '0 12px 26px rgba(255,111,165,.4)',
      '--rb-btn-bg': '#ffffff', '--rb-radius': '16px',
    },
    wheel: w({
      border: '#ffffff', pointer: '#ff6fa5', ring: 'rgba(255,255,255,.6)',
      hub: 'radial-gradient(circle at 35% 30%, #ffffff, #ffe3ef)', hubInk: '#ff6fa5', hubBorder: 'rgba(255,111,165,.4)',
      glow: '0 0 0 10px #ffffff, 0 20px 40px rgba(47,59,69,.14)',
      winner: 'rgba(47,59,69,.16)',
    }),
    deco: `<div style="position:absolute;left:-60px;top:400px;width:200px;height:200px;background:rgba(142,202,230,.25);filter:blur(40px);border-radius:50%"></div>
           <div style="position:absolute;right:-50px;top:120px;width:180px;height:180px;background:rgba(255,143,171,.25);filter:blur(40px);border-radius:50%"></div>`,
  },
  {
    id: 'noir',
    nombre: 'Noir de Lujo',
    font: { href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&display=swap', family: "'Jost', system-ui, sans-serif" },
    seg: ['#1a1a1c', '#242427', '#2f2f33', '#3b3b40', '#4a4a50', '#5c5c63', '#727279', '#9a9099', '#d8c79a'],
    stageBg: 'linear-gradient(115deg, #141416 0%, #0a0a0b 55%, #101011 100%)',
    vars: {
      '--accent': '#d8c79a', '--accent-hover': '#e6d7ae', '--accent-text': '#1a1508', '--accent-soft': 'rgba(216,199,154,.12)',
      '--border': 'rgba(216,199,154,.18)', '--surface-alt': 'rgba(255,255,255,.028)',
      '--text': '#ece9e2', '--text-dim': '#7c7a74', '--ok': '#a7b8a0', '--danger': '#c77',
      '--rb-font-display': "'Cormorant Garamond', Georgia, serif",
      '--rb-gold': '#d8c79a', '--rb-gold-soft': 'rgba(216,199,154,.08)',
      '--rb-spin-bg': 'linear-gradient(180deg,#e3d3a4,#b7a06a)', '--rb-spin-ink': '#1a1508',
      '--rb-spin-shadow': '0 10px 26px rgba(0,0,0,.6)',
      '--rb-radius': '2px',
    },
    wheel: w({
      border: '#161616', pointer: '#d8c79a', ring: 'rgba(216,199,154,.22)',
      hub: 'radial-gradient(circle at 35% 30%, #26241f, #0b0b0c)', hubInk: '#d8c79a', hubBorder: 'rgba(216,199,154,.4)',
      glow: '0 0 0 6px #131313, 0 0 0 7px rgba(216,199,154,.25), 0 24px 60px rgba(0,0,0,.7)',
      winner: 'rgba(216,199,154,.3)',
    }),
    deco: `<div style="${capaAbs};background:linear-gradient(100deg, transparent 30%, rgba(255,255,255,.03) 50%, transparent 70%)"></div>
           <div style="${capaAbs};margin:9px;border:1px solid rgba(216,199,154,.14)"></div>`,
  },
  {
    id: 'azteca',
    nombre: 'Oro Azteca',
    font: { href: 'https://fonts.googleapis.com/css2?family=Marcellus+SC&family=Mukta:wght@400;500;600;700&display=swap', family: "'Mukta', system-ui, sans-serif" },
    seg: ['#123f36', '#1b5a4a', '#2b7a5f', '#3f8f5a', '#b6923f', '#d98f3d', '#c05a2e', '#a83e28', '#e8c98f'],
    stageBg: 'radial-gradient(120% 70% at 50% 0%, #16544a, #0c2f2a 72%)',
    vars: {
      '--accent': '#d98f3d', '--accent-hover': '#e6a052', '--accent-text': '#2a1608', '--accent-soft': 'rgba(217,143,61,.16)',
      '--border': 'rgba(232,201,143,.3)', '--surface-alt': 'rgba(232,201,143,.06)',
      '--text': '#f1e7d2', '--text-dim': '#9db7a8', '--ok': '#79c99a', '--danger': '#e5686b',
      '--rb-font-display': "'Marcellus SC', Georgia, serif",
      '--rb-gold': '#e8c98f', '--rb-gold-soft': 'rgba(232,201,143,.13)',
      '--rb-spin-bg': 'linear-gradient(180deg,#e0a54e,#b9702c)', '--rb-spin-ink': '#2a1608',
      '--rb-spin-shadow': '0 10px 24px rgba(0,0,0,.5)',
    },
    wheel: w({
      border: '#0a2621', pointer: '#e8c98f', ring: 'rgba(232,201,143,.38)',
      hub: 'radial-gradient(circle at 35% 30%, #1d6152, #0a2621)', hubInk: '#e8c98f', hubBorder: 'rgba(232,201,143,.55)',
      glow: '0 0 0 7px #0a2621, 0 0 0 10px rgba(232,201,143,.4), 0 24px 56px rgba(0,0,0,.55)',
      winner: 'rgba(232,201,143,.32)',
    }),
    deco: greca('#e8c98f'),
  },
  {
    id: 'cosmico',
    nombre: 'Cósmico',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&display=swap', family: "'Sora', system-ui, sans-serif" },
    seg: ['#161a3a', '#25275e', '#3a2f8a', '#5a3fb0', '#8a4fd6', '#b25fe0', '#e05fd6', '#5fd6e0', '#e6ecff'],
    stageBg: 'radial-gradient(90% 55% at 20% 12%, rgba(138,79,214,.34), transparent 60%), radial-gradient(90% 55% at 85% 30%, rgba(95,214,224,.22), transparent 60%), #05060f',
    vars: {
      '--accent': '#8a4fd6', '--accent-hover': '#9a63e2', '--accent-text': '#ffffff', '--accent-soft': 'rgba(138,79,214,.18)',
      '--border': 'rgba(255,255,255,.12)', '--surface-alt': 'rgba(255,255,255,.04)',
      '--text': '#e9ecff', '--text-dim': '#8a8fc0', '--ok': '#5fe0d0', '--danger': '#ff6b8a',
      '--rb-font-display': "'Sora', system-ui, sans-serif",
      '--rb-gold': '#ffd98a', '--rb-gold-soft': 'rgba(255,217,138,.11)',
      '--rb-spin-bg': 'linear-gradient(180deg,#9a5fe6,#6a3fc0)', '--rb-spin-ink': '#ffffff',
      '--rb-spin-shadow': '0 0 28px rgba(138,79,214,.55), 0 8px 20px rgba(0,0,0,.5)',
    },
    wheel: w({
      border: '#0b0a1c', pointer: '#5fd6e0', ring: 'rgba(201,176,255,.3)',
      hub: 'radial-gradient(circle at 35% 30%, #2a2160, #07030f)', hubInk: '#c9b0ff', hubBorder: 'rgba(178,95,224,.5)',
      glow: '0 0 0 6px #0b0a1c, 0 0 60px rgba(138,79,214,.5), 0 0 120px rgba(95,214,224,.2), 0 24px 60px rgba(0,0,0,.6)',
    }),
    deco: `<svg style="${capaAbs}" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${estrellas(60, 7)}</svg>`,
  },
  {
    id: 'diamante',
    nombre: 'Hielo y Diamante',
    font: { href: 'https://fonts.googleapis.com/css2?family=Michroma&family=Chakra+Petch:wght@400;500;600;700&display=swap', family: "'Chakra Petch', system-ui, sans-serif" },
    seg: ['#16303f', '#1d4457', '#265d70', '#2f7d8f', '#3fa3b0', '#5fc6cf', '#9be0e6', '#cfeef2', '#eafcff'],
    stageBg: 'radial-gradient(120% 70% at 50% -8%, #12303f, #08131c 72%)',
    vars: {
      '--accent': '#3fb6c4', '--accent-hover': '#5cc9d5', '--accent-text': '#03151a', '--accent-soft': 'rgba(63,182,196,.14)',
      '--border': 'rgba(159,224,230,.24)', '--surface-alt': 'rgba(159,224,230,.05)',
      '--text': '#e6f6fa', '--text-dim': '#7fa0ad', '--ok': '#7bffe0', '--danger': '#ff7a7a',
      '--rb-font-display': "'Michroma', system-ui, sans-serif",
      '--rb-gold': '#dff6ff', '--rb-gold-soft': 'rgba(223,246,255,.1)',
      '--rb-spin-bg': 'linear-gradient(180deg,#7fd6df,#3fa3b0)', '--rb-spin-ink': '#03151a',
      '--rb-spin-shadow': '0 0 22px rgba(95,198,207,.45), 0 8px 16px rgba(0,0,0,.5)',
      '--rb-radius': '2px',
    },
    wheel: w({
      border: '#0a1c25', pointer: '#eafcff', ring: 'rgba(159,224,230,.4)',
      hub: 'linear-gradient(135deg, #1a4453, #0a1c25)', hubInk: '#9be0e6', hubBorder: 'rgba(159,224,230,.55)',
      glow: '0 0 0 4px #0a1c25, 0 0 0 5px rgba(159,224,230,.4), 0 0 44px rgba(95,198,207,.35), 0 22px 52px rgba(0,0,0,.6)',
    }),
    deco: `${svgAbs}<g fill="none" stroke="rgba(159,224,230,.16)" stroke-width="1">
        <polygon points="210,120 320,215 278,350 142,350 100,215"/>
        <polygon points="210,162 268,225 246,320 174,320 152,225"/>
        <line x1="210" y1="120" x2="210" y2="162"/><line x1="100" y1="215" x2="152" y2="225"/>
        <line x1="320" y1="215" x2="268" y2="225"/><line x1="142" y1="350" x2="174" y2="320"/>
        <line x1="278" y1="350" x2="246" y2="320"/></g></svg>`,
  },
  {
    id: 'fuego',
    nombre: 'Fuego',
    font: { href: 'https://fonts.googleapis.com/css2?family=Teko:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap', family: "'Barlow', system-ui, sans-serif" },
    seg: ['#2a1512', '#4a1c14', '#7c2a16', '#a83a18', '#d1521c', '#e87322', '#f59a2e', '#ffc23d', '#ffe89b'],
    stageBg: 'radial-gradient(70% 45% at 50% 34%, rgba(232,115,34,.3), transparent 60%), linear-gradient(180deg, #17110f, #0d0908)',
    vars: {
      '--accent': '#e87322', '--accent-hover': '#f5883a', '--accent-text': '#1c0d03', '--accent-soft': 'rgba(232,115,34,.16)',
      '--border': 'rgba(245,154,46,.26)', '--surface-alt': 'rgba(245,154,46,.05)',
      '--text': '#f7ece2', '--text-dim': '#a58a7c', '--ok': '#ffcf7a', '--danger': '#ff6b5a',
      '--rb-font-display': "'Teko', system-ui, sans-serif",
      '--rb-gold': '#ffc23d', '--rb-gold-soft': 'rgba(255,194,61,.13)',
      '--rb-spin-bg': 'linear-gradient(180deg,#ffb038,#e05a1c)', '--rb-spin-ink': '#1c0d03',
      '--rb-spin-shadow': '0 0 26px rgba(232,115,34,.6), 0 8px 18px rgba(0,0,0,.5)',
      '--rb-radius': '4px',
    },
    wheel: w({
      border: '#170f0c', pointer: '#ffc23d', ring: 'rgba(255,194,61,.34)',
      hub: 'radial-gradient(circle at 40% 30%, #3a2014, #170d08)', hubInk: '#ffc23d', hubBorder: 'rgba(255,194,61,.55)',
      glow: '0 0 0 5px #170f0c, 0 0 50px rgba(232,115,34,.55), 0 0 100px rgba(209,82,28,.28), 0 22px 54px rgba(0,0,0,.6)',
      winner: 'rgba(255,194,61,.32)',
    }),
    deco: `<div style="position:absolute;left:50%;top:90px;width:340px;height:340px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(232,115,34,.34),transparent 66%)"></div>`,
  },
  {
    id: 'esmeralda',
    nombre: 'Esmeralda Moderno',
    font: { href: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap', family: "'Manrope', system-ui, sans-serif" },
    seg: ['#12463b', '#1a5c4c', '#22735e', '#2b8a6f', '#37a17f', '#57c99a', '#8fe0bf', '#ffd8a8', '#ff8c66'],
    stageBg: 'linear-gradient(180deg, #114438, #0c352c)',
    vars: {
      '--accent': '#37a17f', '--accent-hover': '#45b58f', '--accent-text': '#03140f', '--accent-soft': 'rgba(55,161,127,.16)',
      '--border': 'rgba(255,255,255,.1)', '--surface-alt': 'rgba(255,255,255,.045)',
      '--text': '#eafaf3', '--text-dim': '#8fb7a9', '--ok': '#8fe0bf', '--danger': '#ff8c66',
      '--rb-font-display': "'Sora', system-ui, sans-serif",
      '--rb-gold': '#ffb499', '--rb-gold-soft': 'rgba(255,140,102,.12)',
      '--rb-spin-bg': 'linear-gradient(180deg,#45b58f,#2b8a6f)', '--rb-spin-ink': '#03140f',
      '--rb-spin-shadow': '0 12px 26px rgba(0,0,0,.4)',
      '--rb-radius': '14px',
    },
    wheel: w({
      border: '#082019', pointer: '#ff8c66', ring: 'rgba(143,224,191,.28)',
      hub: 'radial-gradient(circle at 35% 30%, #1a5c4c, #082019)', hubInk: '#8fe0bf', hubBorder: 'rgba(143,224,191,.45)',
      glow: '0 0 0 8px #0a271f, 0 20px 48px rgba(0,0,0,.5)',
    }),
    deco: `<div style="position:absolute;left:50%;top:130px;width:560px;height:560px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.05);border-radius:50%"></div>`,
  },
];

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));

export const TEMA_DEFAULT = 'clasico';

export function temaDe(id: string | undefined | null): TemaRuleta {
  return POR_ID.get(id || '') || POR_ID.get(TEMA_DEFAULT)!;
}

/** Inyecta el `<link>` de Google Fonts del tema (una sola vez). */
export function cargarFuenteTema(tema: TemaRuleta): void {
  if (!tema.font || typeof document === 'undefined') return;
  const id = 'rb-font-' + tema.id;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = tema.font.href;
  document.head.appendChild(link);
}
