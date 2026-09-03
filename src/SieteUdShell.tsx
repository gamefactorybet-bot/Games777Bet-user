import { useEffect, type ReactNode } from 'react';
import { PantallaCarga } from './PantallaCarga.tsx';
import { cargarFuenteInstant, type TemaInstant } from './juego/instant-temas.ts';
import { estiloFondo } from './juego/sieteud.ts';
import type { AjusteImg } from './types.ts';

// Marco de 7 Up 7 Down: capa de fondo full-bleed + tema + nombre +
// pantalla de carga. Llena su contenedor (position:absolute; inset:0),
// así el que llama decide si eso es la pantalla del celular o un marco
// de teléfono en la Vista previa.
export function SieteUdShell({
  nombre, mostrarNombre = true, tema, fondoUrl, fondoAjuste,
  cargando, cargaImagen, children,
}: {
  nombre: string;
  mostrarNombre?: boolean;
  tema: TemaInstant;
  fondoUrl: string | null;
  fondoAjuste: AjusteImg;
  cargando?: boolean;
  cargaImagen?: string | null;
  children: ReactNode;
}) {
  useEffect(() => { cargarFuenteInstant(tema); }, [tema]);

  const vars: Record<string, string> = { ...tema.vars };
  if (tema.font) vars['--in-body'] = tema.font.family;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: tema.stageBg || 'var(--bg)',
      fontFamily: 'var(--in-body, inherit)',
      ...(vars as object),
    }}>
      {fondoUrl && <div aria-hidden style={estiloFondo(fondoUrl, fondoAjuste)} />}

      {mostrarNombre && nombre && (
        <p style={{
          position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', margin: 0, zIndex: 3,
          fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-dim)',
          textShadow: '0 1px 6px rgba(0,0,0,.6)',
        }}>{nombre}</p>
      )}

      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>{children}</div>

      {cargando && (
        <PantallaCarga imagen={cargaImagen ?? null} nombre={nombre} hechos={0} total={1} visible />
      )}
    </div>
  );
}
