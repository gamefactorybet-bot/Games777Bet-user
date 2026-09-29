export type Cara = 'estudio' | 'jugar' | 'ambos';

function normalizar(host: string) {
  return host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[:/].*$/, '');
}

function lista(...valores: Array<string | undefined>) {
  const out: string[] = [];
  for (const valor of valores) {
    for (const parte of String(valor || '').split(',')) {
      const h = normalizar(parte);
      if (h && !out.includes(h)) out.push(h);
    }
  }
  return out;
}

export function caraDe(host: string = typeof location !== 'undefined' ? location.hostname : ''): Cara {
  const fija = String(import.meta.env.VITE_CARA || '').trim().toLowerCase();
  if (fija === 'estudio' || fija === 'jugar') return fija;
  const h = normalizar(host);
  const estudio = lista(import.meta.env.VITE_DOMINIO_ESTUDIO);
  const jugar = lista(import.meta.env.VITE_DOMINIO_JUGAR);
  if (h && estudio.includes(h)) return 'estudio';
  if (h && jugar.includes(h)) return 'jugar';
  return 'ambos';
}
