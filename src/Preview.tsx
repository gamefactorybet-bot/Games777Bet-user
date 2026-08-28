import { useEffect } from 'react';
// Transitorio (Fase 3): la vista previa sigue siendo el overlay
// imperativo de preview.js. En la Fase 4 este componente pasa a montar
// el <Escenario> + panel de ajuste en React. La firma ya es la
// definitiva para no tocar a los consumidores (Editor, Catálogo).
import { renderPreview } from './preview.js';
import type { Efecto, Juego, Simbolo, Sonido } from './types.ts';

interface PreviewProps {
  juego: Juego;
  simbolos: Simbolo[];
  sonidos: Sonido[];
  efectos: Efecto[];
  onClose: () => void;
}

export function Preview({ juego, simbolos, sonidos, efectos, onClose }: PreviewProps) {
  useEffect(() => {
    renderPreview({ juego, simbolos, sonidos, efectos });
    // El overlay legacy maneja su propio botón "✕ Cerrar" y vive fuera
    // del árbol de React, así que soltamos el estado ya.
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
