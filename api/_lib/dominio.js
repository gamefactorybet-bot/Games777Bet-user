// Dos proyectos Vercel, un solo Git. Cada proyecto lleva VITE_CARA
// (jugar | estudio) y muestra solo esa cara. Si VITE_CARA no está,
// se decide por el host (VITE_DOMINIO_JUGAR / VITE_DOMINIO_ESTUDIO).
// En local, sin esos env, cara = "ambos": /estudio y /jugar conviven.

export function caraFija(env = process.env) {
  const v = String(env.VITE_CARA || env.CARA || '').trim().toLowerCase();
  if (v === 'estudio' || v === 'jugar') return v;
  return null;
}

export function normalizarHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[:/].*$/, '');
}

export function hostsDe(...valores) {
  const out = [];
  for (const valor of valores) {
    for (const parte of String(valor || '').split(',')) {
      const h = normalizarHost(parte);
      if (h && !out.includes(h)) out.push(h);
    }
  }
  return out;
}

/** @returns {'estudio' | 'jugar' | 'ambos'} */
export function caraDeHost(host, env = process.env) {
  const fija = caraFija(env);
  if (fija) return fija;
  const h = normalizarHost(host);
  const estudio = hostsDe(env.VITE_DOMINIO_ESTUDIO, env.DOMINIO_ESTUDIO);
  const jugar = hostsDe(env.VITE_DOMINIO_JUGAR, env.DOMINIO_JUGAR);
  if (h && estudio.includes(h)) return 'estudio';
  if (h && jugar.includes(h)) return 'jugar';
  return 'ambos';
}

// El catálogo publica el dominio por el que lo llamaron. Así un cambio
// de dominio no obliga a reescribir VITE_DOMINIO_JUGAR. Esa variable
// solo cubre un pedido sin host público (local o una tarea interna).
export function origenJugar(reqHost, env = process.env) {
  const crudo = String(reqHost || '').split(',')[0].trim();
  const h = normalizarHost(crudo);
  if (h && h !== 'localhost' && !h.startsWith('127.')) return `https://${h}`;
  if (h === 'localhost' || h.startsWith('127.')) return `http://${crudo}`;
  const primero = hostsDe(env.VITE_DOMINIO_JUGAR, env.DOMINIO_JUGAR)[0];
  if (primero) return `https://${primero}`;
  return 'http://localhost';
}
