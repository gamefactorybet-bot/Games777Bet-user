// Sonidos base de fábrica. Sin archivos: se sintetizan WAV cortos.
// Si el juego subió un mp3/ogg para ese tipo, se usa el archivo.
// No hay música de fondo por defecto (eso sí tiene que ser del juego).

export type TipoSfx = 'giro' | 'premio_chico' | 'premio_grande' | 'perder';

const SR = 22050;
const cache: Partial<Record<TipoSfx, HTMLAudioElement>> = {};

function env(i: number, n: number, a = 0.02, r = 0.35): number {
  const at = Math.max(1, a * n), re = Math.max(1, r * n);
  if (i < at) return i / at;
  if (i > n - re) return Math.max(0, (n - i) / re);
  return 1;
}

function tono(dur: number, freq: number, vol: number, tipo: 'sine' | 'square' | 'tri' = 'sine', slide = 0): Float32Array {
  const n = Math.max(1, Math.round(dur * SR));
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 + slide * (i / n));
    const ph = 2 * Math.PI * f * t;
    const w = tipo === 'square' ? (Math.sin(ph) >= 0 ? 1 : -1)
      : tipo === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph))
        : Math.sin(ph);
    s[i] = w * vol * env(i, n);
  }
  return s;
}

function ruido(dur: number, vol: number): Float32Array {
  const n = Math.max(1, Math.round(dur * SR));
  const s = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = last * 0.7 + (Math.random() * 2 - 1) * 0.3;
    s[i] = last * vol * env(i, n, 0.01, 0.5);
  }
  return s;
}

function mix(parts: { s: Float32Array; at: number }[]): Float32Array {
  let n = 0;
  for (const p of parts) n = Math.max(n, p.at + p.s.length);
  const o = new Float32Array(n);
  for (const p of parts) {
    for (let i = 0; i < p.s.length; i++) o[p.at + i] += p.s[i];
  }
  for (let i = 0; i < n; i++) o[i] = Math.max(-1, Math.min(1, o[i]));
  return o;
}

function wavUri(samples: Float32Array): string {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return 'data:audio/wav;base64,' + btoa(bin);
}

function samplesDe(tipo: TipoSfx): Float32Array {
  const at = (sec: number) => Math.round(sec * SR);
  if (tipo === 'giro') {
    return mix([
      { at: 0, s: ruido(0.09, 0.28) },
      { at: 0, s: tono(0.16, 190, 0.38, 'sine', -0.35) },
      { at: at(0.04), s: tono(0.08, 520, 0.12, 'tri', -0.4) },
    ]);
  }
  if (tipo === 'premio_chico') {
    return mix([
      { at: 0, s: tono(0.16, 523, 0.32, 'tri') },
      { at: at(0.09), s: tono(0.18, 659, 0.3, 'tri') },
      { at: at(0.18), s: tono(0.28, 784, 0.34, 'sine') },
    ]);
  }
  if (tipo === 'premio_grande') {
    return mix([
      { at: 0, s: tono(0.18, 523, 0.3, 'tri') },
      { at: at(0.1), s: tono(0.18, 659, 0.3, 'tri') },
      { at: at(0.2), s: tono(0.2, 784, 0.32, 'sine') },
      { at: at(0.34), s: tono(0.42, 1046, 0.36, 'sine') },
      { at: at(0.34), s: tono(0.42, 523, 0.14, 'sine') },
    ]);
  }
  return mix([
    { at: 0, s: tono(0.18, 392, 0.3, 'tri', -0.12) },
    { at: at(0.12), s: tono(0.22, 311, 0.28, 'sine', -0.18) },
    { at: at(0.26), s: tono(0.32, 196, 0.34, 'sine', -0.25) },
  ]);
}

export function audioBase(tipo: TipoSfx): HTMLAudioElement {
  if (!cache[tipo]) {
    const a = new Audio(wavUri(samplesDe(tipo)));
    a.preload = 'auto';
    cache[tipo] = a;
  }
  return cache[tipo]!;
}

export type AudiosJuego = Partial<Record<string, HTMLAudioElement>>;

function esInstant(motor: string): boolean {
  return /^(limbo|dice|sieteud)/.test(motor || '');
}

/** audios listos para tocar: custom si hay, si no el kit base. */
export function audiosDe(
  sonidos: { tipo: string; archivo_url?: string | null }[] | null | undefined,
  motor = '',
): AudiosJuego {
  const out: AudiosJuego = {
    giro: audioBase('giro'),
    premio_chico: audioBase('premio_chico'),
    premio_grande: audioBase(esInstant(motor) ? 'perder' : 'premio_grande'),
    perder: audioBase('perder'),
  };
  for (const s of sonidos || []) {
    if (!s?.tipo || !s.archivo_url) continue;
    const a = new Audio(s.archivo_url);
    if (s.tipo === 'musica_fondo') { a.loop = true; a.volume = 0.45; }
    out[s.tipo] = a;
  }
  return out;
}

export function tocar(audios: AudiosJuego | null | undefined, tipo: string): void {
  const a = audios?.[tipo];
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
    void a.play();
  } catch { /* autoplay bloqueado hasta un toque */ }
}

export function tocarPremio(audios: AudiosJuego | null | undefined, premio: number, apuesta = 1): void {
  if (premio <= 0) { tocar(audios, 'perder'); return; }
  tocar(audios, premio >= apuesta * 5 ? 'premio_grande' : 'premio_chico');
}
