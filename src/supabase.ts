import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env');
}

// persistSession + autoRefreshToken vienen en true por defecto, pero los
// dejamos explícitos para que quede documentado:
// - persistSession: guarda el token en localStorage del navegador
// - autoRefreshToken: lo renueva solo antes de que venza
// - detectSessionInUrl: false — no hay flujo OAuth con redirect acá
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
