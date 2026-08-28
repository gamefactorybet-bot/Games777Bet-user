// ================= MOTOR DE ANIMACIÓN DE RODILLOS (JUGADOR) =================
//
// Portado de `jugar.js`. Solo dibuja: el resultado lo decide el
// servidor y esta parte se limita a llevar visualmente los rodillos
// hasta ese resultado.
//
//  - Las celdas se crean UNA sola vez, al abrir el juego. Durante el
//    giro no se crea ni se borra ningún elemento: solo cambia el `src`
//    de tres imágenes que en ese momento están fuera de la vista.
//  - La posición la controla un solo bucle de requestAnimationFrame
//    con una variable en píxeles. La cinta tiene LOOP celdas más una
//    copia de las FILAS primeras al final, y la posición se toma en
//    módulo.
//
// Es distinto del de la vista previa (transición CSS): acá hay que
// arrancar en el toque y frenar recién cuando llega el servidor.

import type { MotorModulo, Simbolo } from '../types.ts';
import type { Escenario } from './escenario.ts';

const LOOP = 20;
const PASADA = 0.11; // cuánto se pasa el rodillo antes de acomodarse

interface Rodillo {
  y: number; v: number; vMax: number; celdaPx: number; loopPx: number;
  celdas: HTMLElement[];
  fase: 'quieto' | 'acelerando' | 'constante' | 'frenando' | 'asentando';
  destino: number; salida: number; distancia: number; inicio: number; duracion: number; pasada: number;
}

export interface RodillosJugar {
  pintarGrillaInicial(): void;
  arrancar(): number;
  frenar(col: number, simbolosFinales: Simbolo[]): number;
  esperarFrenado(): Promise<void>;
  detener(): void;
  limpiarGanadoras(): void;
  celdaEn(col: number, i: number): HTMLElement | undefined;
  destruir(): void;
}

export function crearRodillosJugar(
  escenario: Escenario,
  motor: MotorModulo,
  simbolos: Simbolo[],
): RodillosJugar {
  const { FILAS, FILA_PAGO, COLUMNAS } = motor;
  const { cintas } = escenario;
  const CELDAS_TIRA = LOOP + FILAS;

  // Arranca en 1100ms, +220ms por rodillo hacia la derecha.
  const DURACION_BASE = Array.from({ length: COLUMNAS }, (_, i) => 1100 + i * 220);

  const elegirSimboloFiller = (total: number): Simbolo => {
    let r = Math.random() * total;
    for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
    return simbolos[simbolos.length - 1];
  };

  const crearCelda = (tamano: number): HTMLElement => {
    const div = document.createElement('div');
    div.style.cssText = `width:${tamano}px; height:${tamano}px; display:flex; align-items:center; justify-content:center; flex-shrink:0`;
    const img = document.createElement('img');
    const iconoPct = Number(escenario.pos.grilla_icono_tamano ?? 60);
    img.style.cssText = `width:${iconoPct}%; height:${iconoPct}%; object-fit:contain; display:none`;
    img.draggable = false;
    const span = document.createElement('span');
    span.style.cssText = 'font-size:11px; color:#8fae9a; display:none';
    div.append(img, span);
    return div;
  };

  const ponerSimbolo = (celda: HTMLElement, simbolo: Simbolo) => {
    const img = celda.firstElementChild as HTMLImageElement;
    const span = celda.lastElementChild as HTMLElement;
    if (simbolo.icono_url) {
      if (img.getAttribute('src') !== simbolo.icono_url) img.src = simbolo.icono_url;
      img.style.display = 'block';
      span.style.display = 'none';
    } else {
      span.textContent = simbolo.nombre;
      span.style.display = 'block';
      img.style.display = 'none';
    }
  };

  const rodillos: Rodillo[] = Array.from({ length: COLUMNAS }, () => ({
    y: 0, v: 0, vMax: 0, celdaPx: 0, loopPx: 0, celdas: [],
    fase: 'quieto', destino: 0, salida: 0, distancia: 0, inicio: 0, duracion: 0, pasada: 0,
  }));

  const medirYConstruir = () => {
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    cintas.forEach((cinta, col) => {
      const r = rodillos[col];
      const celdaPx = (cinta.parentElement as HTMLElement).clientWidth;
      if (!celdaPx) return;
      r.celdaPx = celdaPx;
      r.loopPx = LOOP * celdaPx;
      cinta.innerHTML = '';
      r.celdas = [];
      for (let i = 0; i < CELDAS_TIRA; i++) {
        const celda = crearCelda(celdaPx);
        cinta.appendChild(celda);
        r.celdas.push(celda);
      }
      const tira = Array.from({ length: LOOP }, () => elegirSimboloFiller(total));
      tira.forEach((sim, i) => ponerSimbolo(r.celdas[i], sim));
      for (let i = 0; i < FILAS; i++) ponerSimbolo(r.celdas[LOOP + i], tira[i]);
      cinta.style.transform = 'translate3d(0,0,0)';
      cinta.style.backfaceVisibility = 'hidden';
    });
  };

  const lineaPagaria = (linea: Simbolo[]): boolean => {
    const reales = linea.filter((s) => s.nombre !== 'wild');
    const cand = reales.length ? reales[0] : linea[0];
    if (linea.every((s) => s === cand || s.nombre === 'wild')) return true;
    return linea[0] === linea[1] || linea[0].nombre === 'wild' || linea[1].nombre === 'wild';
  };

  const pintarGrillaInicial = () => {
    medirYConstruir();
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    let grillaDemo: Simbolo[][] = [];
    for (let intento = 0; intento < 40; intento++) {
      grillaDemo = Array.from({ length: COLUMNAS }, () => Array.from({ length: FILAS }, () => elegirSimboloFiller(total)));
      if (!lineaPagaria(grillaDemo.map((col) => col[FILA_PAGO]))) break;
    }
    rodillos.forEach((r, col) => {
      if (!r.celdas.length) return;
      grillaDemo[col].forEach((sim, fila) => ponerSimbolo(r.celdas[fila], sim));
      r.y = 0;
      cintas[col].style.transform = 'translate3d(0,0,0)';
    });
  };

  let vivo = true;
  let ultimoFrame = 0;
  const frameRodillos = (ahora: number) => {
    if (!vivo) return;
    const dt = ultimoFrame ? Math.min(34, ahora - ultimoFrame) : 16;
    ultimoFrame = ahora;

    rodillos.forEach((r, col) => {
      if (r.fase === 'quieto' || !r.loopPx) return;

      if (r.fase === 'acelerando' || r.fase === 'constante') {
        if (r.v < r.vMax) {
          const falta = (r.vMax - r.v) / r.vMax;
          r.v = Math.min(r.vMax, r.v + (r.vMax / 340) * dt * (0.35 + falta));
        } else {
          r.fase = 'constante';
        }
        r.y += r.v * dt;
      } else if (r.fase === 'frenando') {
        const t = Math.min(1, (ahora - r.inicio) / r.duracion);
        r.y = r.salida + r.distancia * (1 - Math.pow(1 - t, 2));
        if (t >= 1) { r.fase = 'asentando'; r.inicio = ahora; }
      } else if (r.fase === 'asentando') {
        const t = Math.min(1, (ahora - r.inicio) / 170);
        const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        r.y = r.pasada + (r.destino - r.pasada) * suave;
        if (t >= 1) {
          r.y = r.destino;
          r.v = 0;
          r.fase = 'quieto';
          cintas[col].style.willChange = 'auto';
        }
      }

      const off = ((r.y % r.loopPx) + r.loopPx) % r.loopPx;
      cintas[col].style.transform = `translate3d(0, ${-off}px, 0)`;
    });

    requestAnimationFrame(frameRodillos);
  };
  requestAnimationFrame(frameRodillos);

  const arrancar = () => {
    rodillos.forEach((r, col) => {
      if (!r.loopPx) return;
      r.fase = 'acelerando';
      r.v = 0;
      r.vMax = r.celdaPx / (55 / escenario.velocidad);
      cintas[col].style.willChange = 'transform';
    });
    return Date.now();
  };

  const ranuraLibre = (r: Rodillo): number => {
    const off = ((r.y % r.loopPx) + r.loopPx) % r.loopPx;
    const k = Math.floor(off / r.celdaPx);
    for (let d = 5; d < LOOP; d++) {
      const cand = (k + d) % LOOP;
      if (cand < FILAS || cand > LOOP - FILAS) continue;
      return cand;
    }
    return FILAS;
  };

  const frenar = (col: number, simbolosFinales: Simbolo[]): number => {
    const r = rodillos[col];
    if (!r.loopPx) return 0;

    const duracionDeseada = DURACION_BASE[col] / escenario.velocidad;
    const vActual = Math.max(r.v, r.vMax || r.celdaPx / 400);
    const distanciaIdeal = (vActual * duracionDeseada) / 2;

    const off = ((r.y % r.loopPx) + r.loopPx) % r.loopPx;
    const ranura = Math.round((off + distanciaIdeal) / r.celdaPx) % LOOP;

    let delta = ranura * r.celdaPx - off;
    if (delta < r.celdaPx) delta += r.loopPx;

    simbolosFinales.forEach((sim, fila) => {
      const i = ranura + fila;
      ponerSimbolo(r.celdas[i], sim);
      if (i < FILAS) ponerSimbolo(r.celdas[LOOP + i], sim);
      else if (i >= LOOP) ponerSimbolo(r.celdas[i - LOOP], sim);
    });

    const pasadaPx = r.celdaPx * PASADA;
    r.salida = r.y;
    r.distancia = delta + pasadaPx;
    r.destino = r.y + delta;
    r.pasada = r.destino + pasadaPx;
    r.duracion = (2 * (delta + pasadaPx)) / vActual;
    r.inicio = performance.now();
    r.fase = 'frenando';
    return ranura;
  };

  const esperarFrenado = () => new Promise<void>((listo) => {
    const revisar = () => {
      if (rodillos.every((r) => r.fase === 'quieto')) listo();
      else requestAnimationFrame(revisar);
    };
    requestAnimationFrame(revisar);
  });

  // Corta un giro en curso (error del servidor).
  const detener = () => {
    rodillos.forEach((r, col) => {
      r.fase = 'quieto';
      r.v = 0;
      cintas[col].style.willChange = 'auto';
    });
  };

  const limpiarGanadoras = () => {
    rodillos.forEach((r) => r.celdas.forEach((c) => c.classList.remove('celda-ganadora')));
  };
  const celdaEn = (col: number, i: number) => rodillos[col].celdas[i] as HTMLElement | undefined;

  const destruir = () => { vivo = false; };

  return { pintarGrillaInicial, arrancar, frenar, esperarFrenado, detener, limpiarGanadoras, celdaEn, destruir };
}
