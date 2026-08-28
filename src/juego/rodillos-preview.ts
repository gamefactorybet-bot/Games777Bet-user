// Motor de rodillos de la VISTA PREVIA — animación con transición CSS
// (`cubic-bezier`), portado de `preview.js`. Es distinto del de la
// pantalla real del jugador (`rodillos-jugar.ts`, física con rAF): la
// vista previa no compite con la latencia del servidor, así que la
// transición CSS alcanza y es más simple.

import { animarSimboloGanador, detenerAnimacionesSimbolos, detenerAnimacionesJuego } from '../lottie.ts';
import type { MotorModulo, NivelPremio, ResultadoGiro, Simbolo } from '../types.ts';
import type { Escenario } from './escenario.ts';

// Cuánto "relleno" tiene cada cinta antes de los símbolos finales.
const RELLENO = 18;

function celdaHtml(s: Simbolo, iconoTamano = 60): string {
  if (s.icono_url) return `<img src="${s.icono_url}" style="width:${iconoTamano}%; height:${iconoTamano}%; object-fit:contain" />`;
  return `<span style="font-size:11px; color:#8fae9a">${s.nombre}</span>`;
}

export interface RodillosPreview {
  pintarGrillaInicial(): void;
  girar(resultadoForzado: ResultadoGiro | null): Promise<void>;
}

export function crearRodillosPreview(
  escenario: Escenario,
  motor: MotorModulo,
  simbolos: Simbolo[],
): RodillosPreview {
  const { COLUMNAS, FILA_PAGO } = motor;
  const { cintas, efectoPremio } = escenario;

  // Misma progresión de siempre (1400ms + 400ms por rodillo).
  const DURACION_COLUMNA = Array.from({ length: COLUMNAS }, (_, i) => 1400 + i * 400);

  const crearCeldaCinta = (simbolo: Simbolo, tamano: number): HTMLElement => {
    const div = document.createElement('div');
    div.style.cssText = `width:${tamano}px; height:${tamano}px; display:flex; align-items:center; justify-content:center; flex-shrink:0`;
    div.innerHTML = celdaHtml(simbolo, escenario.pos.grilla_icono_tamano);
    return div;
  };

  const armarCinta = (col: number, valoresFinales: Simbolo[], total: number): number => {
    const cinta = cintas[col];
    cinta.innerHTML = '';
    cinta.style.transition = 'none';
    cinta.style.transform = 'translateY(0px)';
    cinta.style.willChange = 'transform';

    const tamanoCelda = (cinta.parentElement as HTMLElement).clientWidth;
    for (let i = 0; i < RELLENO; i++) {
      cinta.appendChild(crearCeldaCinta(motor.elegirSimbolo(simbolos, total), tamanoCelda));
    }
    valoresFinales.forEach((s) => cinta.appendChild(crearCeldaCinta(s, tamanoCelda)));
    return tamanoCelda;
  };

  const pintarGrillaInicial = () => {
    let grilla = motor.girar(simbolos);
    for (let intento = 0; intento < 40; intento++) {
      grilla = motor.girar(simbolos);
      if (!grilla.premio) break;
    }
    cintas.forEach((cinta, col) => {
      cinta.innerHTML = '';
      cinta.style.transition = 'none';
      cinta.style.transform = 'translateY(0px)';
      const tamanoCelda = (cinta.parentElement as HTMLElement).clientWidth;
      grilla.grilla[col].forEach((s) => cinta.appendChild(crearCeldaCinta(s, tamanoCelda)));
    });
  };

  const girar = async (resultadoForzado: ResultadoGiro | null) => {
    const { grilla, premio, nivel, simbolosGanadores, filaPago } = resultadoForzado || motor.girar(simbolos);
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    detenerAnimacionesSimbolos();
    detenerAnimacionesJuego();
    escenario.lanzarAnimaciones('girar');

    const tamanoCelda = Array.from({ length: COLUMNAS }, (_, col) => armarCinta(col, grilla[col], total));

    // Forzar que el navegador registre la posición inicial antes de animar.
    void cintas[0].offsetWidth;

    await Promise.all(cintas.map((cinta, col) => new Promise<void>((resolve) => {
      const ms = Math.round(DURACION_COLUMNA[col] / escenario.velocidad);
      cinta.style.transition = `transform ${ms}ms cubic-bezier(0.15, 0.85, 0.3, 1)`;
      cinta.style.transform = `translateY(-${RELLENO * tamanoCelda[col]}px)`;
      setTimeout(resolve, ms);
    })));

    const ganancia = premio * escenario.apuesta;
    escenario.saldo += ganancia;
    escenario.saldoEl.textContent = escenario.saldo.toLocaleString('es-PY');

    if (premio > 0 && nivel) {
      escenario.mostrarPremio(ganancia, nivel);
      escenario.lanzarAnimaciones(nivel === 'premio_mayor' ? 'premio_mayor' : 'premio_chico');
      const columnasGanadoras = simbolosGanadores?.length ? simbolosGanadores : Array.from({ length: COLUMNAS }, (_, i) => i);
      cintas.forEach((cinta, col) => {
        if (!columnasGanadoras.includes(col)) return;
        const celdaGanadora = cinta.children[RELLENO + FILA_PAGO] as HTMLElement | undefined;
        if (!celdaGanadora) return;
        celdaGanadora.classList.add('celda-ganadora');
        animarSimboloGanador(celdaGanadora, grilla[col][filaPago], nivel);
      });

      const ef = escenario.efectos.find((e) => e.tipo === 'premio' && e.nivel_premio === (nivel as NivelPremio));
      if (ef) {
        efectoPremio.className = 'efecto-premio';
        efectoPremio.style.animation = 'none';
        void efectoPremio.offsetWidth;
        efectoPremio.style.cssText = `position:absolute; inset:0; pointer-events:none; ${ef.posicion === 'linea' ? 'top:33%; height:33%;' : ''}`;
        efectoPremio.style.animation = '';
      }
      const sonidoPremio = nivel === 'premio_mayor' ? escenario.audios.premio_grande : escenario.audios.premio_chico;
      if (sonidoPremio) { sonidoPremio.currentTime = 0; sonidoPremio.play().catch(() => {}); }
    }
  };

  return { pintarGrillaInicial, girar };
}
