// Audio sintético de la mesa de dados. Sin archivos: Web Audio genera
// el whoosh del tiro, los clacks (según el material), el aterrizaje en
// el fieltro y el sting de ganar / Lucky 7 / perder. Se desbloquea en
// el tap de "Tirar" (gesto del usuario) para iOS.

import type { MaterialDado } from './dados3d.ts';

export interface AudioDados {
  unlock: () => void;
  setMaterial: (m: MaterialDado) => void;
  lanzar: () => void;
  rebote: (fuerza: number) => void;
  choque: (fuerza: number) => void;
  aterrizaje: (fuerza: number) => void;
  clavar: () => void;
  gano: (lucky7: boolean) => void;
  perdio: () => void;
  destruir: () => void;
}

interface RecetaSonido {
  bp: number;
  q: number;
  dur: number;
  ring: number;
  ringF: number;
  body: number;
}

const RECETA: Record<MaterialDado, RecetaSonido> = {
  marfil: { bp: 1080, q: 3.2, dur: 0.05, ring: 0.07, ringF: 760, body: 0.9 },
  oro: { bp: 1580, q: 5.4, dur: 0.042, ring: 0.13, ringF: 1220, body: 0.7 },
  cromo: { bp: 2140, q: 7.2, dur: 0.036, ring: 0.15, ringF: 1680, body: 0.55 },
  cristal: { bp: 2580, q: 9.4, dur: 0.04, ring: 0.24, ringF: 2140, body: 0.4 },
  rubi: { bp: 2360, q: 8.2, dur: 0.04, ring: 0.2, ringF: 1880, body: 0.45 },
  onix: { bp: 720, q: 2.4, dur: 0.062, ring: 0.05, ringF: 410, body: 1.15 },
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function haptic(ms: number | number[]) {
  try { navigator.vibrate?.(ms as number); } catch { /* ignore */ }
}

export function crearAudioDados(material: MaterialDado = 'marfil'): AudioDados {
  const AC = typeof window !== 'undefined'
    ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : null;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let receta = RECETA[material] || RECETA.marfil;
  let lastClick = 0;
  let vivo = true;

  function ensure(): AudioContext | null {
    if (!vivo || !AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.42;
        master.connect(ctx.destination);
        noise = makeNoise(ctx);
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function dest(): AudioNode | null {
    return master;
  }

  function tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number, slide?: number) {
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function burst(fuerza: number, extra?: { bp?: number; dur?: number; ring?: number; ringF?: number; q?: number }) {
    if (!ctx || !master || !noise) return;
    const t = ctx.currentTime;
    if (t - lastClick < 0.028) return;
    lastClick = t;
    const r = receta;
    const f = clamp(fuerza, 0.05, 1);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = extra?.bp ?? r.bp;
    bp.Q.value = extra?.q ?? r.q;
    const g = ctx.createGain();
    const dur = extra?.dur ?? r.dur;
    g.gain.setValueAtTime(f * 0.38 * r.body, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
    const ring = extra?.ring ?? r.ring;
    const ringF = extra?.ringF ?? r.ringF;
    if (ring > 0.02) tone(ringF * (0.94 + Math.random() * 0.12), t, ring, 'sine', f * 0.07 * r.body);
  }

  return {
    unlock() { ensure(); },
    setMaterial(m) { receta = RECETA[m] || RECETA.marfil; },
    lanzar() {
      const c = ensure(); if (!c || !master || !noise) return;
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = noise;
      const hp = c.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(2200, t);
      hp.frequency.exponentialRampToValueAtTime(380, t + 0.28);
      hp.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      src.connect(hp); hp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.34);
      tone(180, t, 0.08, 'sine', 0.05, 90);
      haptic(12);
    },
    rebote(fuerza) {
      if (fuerza < 0.07) return;
      burst(fuerza);
      if (fuerza > 0.45) haptic(8);
    },
    choque(fuerza) {
      if (fuerza < 0.08) return;
      burst(fuerza * 0.9, { bp: receta.bp * 1.25, dur: receta.dur * 0.75, ring: receta.ring * 0.7 });
    },
    aterrizaje(fuerza) {
      if (fuerza < 0.08) return;
      burst(fuerza, { bp: receta.bp * 0.55, q: 1.8, dur: 0.07 + fuerza * 0.04, ring: receta.ring * 0.4, ringF: receta.ringF * 0.55 });
      const c = ctx; if (!c || !master || !noise) return;
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = noise;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 220;
      const g = c.createGain();
      g.gain.setValueAtTime(fuerza * 0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.12);
      if (fuerza > 0.35) haptic(10);
    },
    clavar() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      burst(0.22, { bp: receta.bp * 0.8, dur: 0.04, ring: 0.05 });
      tone(receta.ringF * 0.45, t + 0.05, 0.07, 'sine', 0.035);
    },
    gano(lucky7) {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      tone(523.25, t, 0.14, 'triangle', 0.11);
      tone(659.25, t + 0.09, 0.16, 'triangle', 0.12);
      tone(783.99, t + 0.18, 0.28, 'triangle', 0.14);
      if (lucky7) {
        tone(1046.5, t + 0.3, 0.42, 'sine', 0.11);
        tone(1568, t + 0.34, 0.22, 'sine', 0.05);
        burst(0.35, { bp: 2800, q: 6, dur: 0.12, ring: 0.18, ringF: 2093 });
        haptic([18, 40, 18, 40, 36]);
      } else {
        haptic([16, 40, 28]);
      }
    },
    perdio() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      tone(196, t, 0.16, 'sine', 0.08, 150);
      tone(147, t + 0.11, 0.26, 'sine', 0.07, 110);
      haptic(24);
    },
    destruir() {
      vivo = false;
      if (ctx) {
        const c = ctx;
        ctx = null; master = null; noise = null;
        void c.close();
      }
    },
  };
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.45), ctx.sampleRate);
  const d = n.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = last * 0.86 + w * 0.14;
    d[i] = last * 0.7 + w * 0.3;
  }
  return n;
}
