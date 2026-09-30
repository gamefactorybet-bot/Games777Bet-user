import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caraDeHost } from './api/_lib/dominio.js';

const raiz = dirname(fileURLToPath(import.meta.url));

/**
 * Lee el .env sin depender de dotenv.
 * Las variables sin prefijo VITE_ (como SUPABASE_SERVICE_ROLE_KEY o
 * WIN777_PROVEEDOR_SECRETO) no las expone Vite al cliente, así que las
 * cargamos a process.env para que las funciones de /api las vean igual
 * que en Vercel.
 */
function cargarArchivoEnv(archivo) {
  if (!existsSync(archivo)) return;
  for (const linea of readFileSync(archivo, 'utf-8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte === -1) continue;
    const clave = limpia.slice(0, corte).trim();
    const valor = limpia.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[clave]) process.env[clave] = valor;
  }
}

function cargarEnv() {
  cargarArchivoEnv(resolve(raiz, '.env'));
  // vite build / Vercel: la cara del repo (jugar | estudio) vive acá.
  // `vite` de desarrollo no lo carga, así conviven /estudio y /jugar.
  const esBuild = process.argv.includes('build') || process.env.NODE_ENV === 'production';
  if (esBuild) cargarArchivoEnv(resolve(raiz, '.env.production'));
}

/**
 * Devuelve true si ya respondió (redirect) y no hay que seguir.
 * Reescribe /jugar y /estudio a los .html. En local / abre el estudio;
 * en el dominio de jugadores / queda vacío.
 */
function ruteoCaras(req, res, next) {
  if (!req.url) return false;
  const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const soloRuta = req.url.split('?')[0];
  const cara = caraDeHost(req.headers.host);

  if (cara === 'jugar' && /^\/estudio(\.html)?\/?$/.test(soloRuta)) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
    return true;
  }
  if (cara === 'estudio' && /^\/jugar(\.html)?(\/[^/]+)?\/?$/.test(soloRuta)) {
    res.statusCode = 302;
    res.setHeader('Location', '/estudio');
    res.end();
    return true;
  }

  if (soloRuta === '/jugar' || soloRuta === '/jugar/' || /^\/jugar\/[^/]+\/?$/.test(soloRuta)) {
    req.url = '/jugar.html' + query;
    next();
    return true;
  }
  if (soloRuta === '/estudio' || soloRuta === '/estudio/') {
    req.url = '/estudio.html' + query;
    next();
    return true;
  }

  if (cara !== 'jugar' && (soloRuta === '/' || soloRuta === '/index.html')) {
    res.statusCode = 302;
    res.setHeader('Location', '/estudio');
    res.end();
    return true;
  }

  return false;
}

/**
 * Corre las funciones serverless de /api durante `npm run dev`.
 * Replica lo justo del entorno de Vercel: req.body ya parseado,
 * req.query, y los helpers res.status().json().
 * En producción esto no se usa — ahí las corre Vercel de verdad.
 */
function apiLocal() {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (ruteoCaras(req, res, next)) return;

        if (!req.url.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        const nombre = url.pathname.replace('/api/', '');
        const archivo = resolve(raiz, 'api', `${nombre}.js`);

        if (!existsSync(archivo)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `No existe /api/${nombre}` }));
          return;
        }

        try {
          let body = {};
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const crudo = Buffer.concat(chunks).toString();
            body = crudo ? JSON.parse(crudo) : {};
          }

          req.body = body;
          req.query = Object.fromEntries(url.searchParams);
          req.headers.authorization = req.headers.authorization || '';

          res.status = (codigo) => {
            res.statusCode = codigo;
            return res;
          };
          res.json = (datos) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(datos));
            return res;
          };

          const modulo = await server.ssrLoadModule(`/api/${nombre}.js`);
          await modulo.default(req, res);
        } catch (err) {
          console.error(`[api/${nombre}]`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Error interno' }));
          }
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (ruteoCaras(req, res, next)) return;
        next();
      });
    },
  };
}

cargarEnv();

const caraBuild = (process.env.VITE_CARA || '').trim().toLowerCase();
const entradas = { publico: resolve(raiz, 'index.html') };
if (caraBuild !== 'jugar') entradas.estudio = resolve(raiz, 'estudio.html');
if (caraBuild !== 'estudio') entradas.jugar = resolve(raiz, 'jugar.html');

function inyectarDominios() {
  return {
    name: 'inyectar-dominios',
    transformIndexHtml(html) {
      return html
        .split('__CARA__').join(process.env.VITE_CARA || '')
        .split('__DOMINIO_JUGAR__').join(process.env.VITE_DOMINIO_JUGAR || '')
        .split('__DOMINIO_ESTUDIO__').join(process.env.VITE_DOMINIO_ESTUDIO || '');
    },
  };
}

export default defineConfig({
  plugins: [react(), apiLocal(), inyectarDominios()],
  server: { port: 5174, allowedHosts: true },
  preview: { allowedHosts: true },
  build: {
    rollupOptions: {
      input: entradas,
    },
  },
});
