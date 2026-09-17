import { createClient } from '@supabase/supabase-js';

// Este cliente usa la Service Role Key: bypassea RLS. SOLO se
// importa desde archivos de /api (servidor) — nunca debe llegar al
// bundle del navegador. La URL reusa la misma variable que ya usa
// el frontend; la key es nueva, server-only, sin prefijo VITE_.
export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Mensaje claro si Supabase rechaza la service role de Vercel. */
export function errorAdmin(err) {
  const raw = err && (err.message || String(err));
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VITE_SUPABASE_URL) {
    return 'Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las env de Vercel.';
  }
  if (/unregistered api key/i.test(raw || '')) {
    return 'SUPABASE_SERVICE_ROLE_KEY en Vercel no es de este proyecto. En Supabase → Project Settings → API copiá la service_role (secret) del mismo proyecto que VITE_SUPABASE_URL, pegala en Vercel y redesplegá.';
  }
  return raw || 'Error de Supabase';
}
