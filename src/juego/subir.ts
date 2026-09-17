// Subida de un archivo al bucket `assets` de Supabase, devolviendo su
// URL pública. Compartido entre el editor y la vista previa (antes
// estaba copiado en `editor.js` y `preview.js`).

import { supabase } from '../supabase.ts';

export async function subirArchivo(archivo: File, carpeta: string): Promise<string | null> {
  const seguro = archivo.name.replace(/[^\w.\-]+/g, '_');
  const ruta = `${carpeta}/${Date.now()}-${seguro}`;
  const { error } = await supabase.storage.from('assets').upload(ruta, archivo, {
    upsert: true,
    contentType: archivo.type || undefined,
  });
  if (error) { alert('No se pudo subir: ' + error.message); return null; }
  const { data } = supabase.storage.from('assets').getPublicUrl(ruta);
  return data.publicUrl;
}
