import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));

/**
 * Lee el .env sin depender de dotenv.
 * Las variables sin prefijo VITE_ (como SUPABASE_SERVICE_ROLE_KEY o
 * WIN777_PROVEEDOR_SECRETO) no las expone Vite al cliente, así que las
 * cargamos a process.env para que las funciones de /api las vean igual
 * que en Vercel.
 */
function cargarEnv() {
  const archivo = resolve(raiz, '.env');
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
        // URL limpia: /jugar -> /jugar.html, así el link que se lanza
        // desde win777 no lleva extensión.
        const soloRuta = req.url.split('?')[0];
        if (soloRuta === '/jugar' || soloRuta === '/jugar/') {
          req.url = '/jugar.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
          return next();
        }

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
  };
}

cargarEnv();

export default defineConfig({
  plugins: [react(), apiLocal()],
  server: { port: 5174 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(raiz, 'index.html'),
        jugar: resolve(raiz, 'jugar.html'),
      },
    },
  },
});
