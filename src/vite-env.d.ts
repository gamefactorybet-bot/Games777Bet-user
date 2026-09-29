/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CARA?: string;
  readonly VITE_DOMINIO_JUGAR?: string;
  readonly VITE_DOMINIO_ESTUDIO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
