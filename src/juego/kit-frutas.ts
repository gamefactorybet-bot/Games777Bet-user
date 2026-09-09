// Pack de arranque para slots clásicos. Al crear un 3×3 o 5×3 el juego
// nace con símbolos, pagos (~91% RTP en 3×3) y efectos CSS, más íconos
// SVG servidos desde /pieles/frutas/. No toca el motor: es solo piel +
// una tabla de pagos jugable.

export interface SimboloKit {
  nombre: string;
  peso: number;
  pago_dos: number;
  pago_tres: number;
  pago_cuatro?: number;
  pago_cinco?: number;
  orden: number;
  icono_url: string;
}

const ICONO = (archivo: string) => `/pieles/frutas/${archivo}.svg`;

/** Misma tabla que sql/03_demo_frutas.sql (RTP ~90.7% en 3×3). */
const BASE_3X3: Omit<SimboloKit, 'icono_url'>[] = [
  { nombre: 'cereza', peso: 25, pago_tres: 4, pago_dos: 1, orden: 0 },
  { nombre: 'limon', peso: 22, pago_tres: 6, pago_dos: 2, orden: 1 },
  { nombre: 'naranja', peso: 18, pago_tres: 9, pago_dos: 2, orden: 2 },
  { nombre: 'sandia', peso: 14, pago_tres: 18, pago_dos: 4, orden: 3 },
  { nombre: 'uva', peso: 10, pago_tres: 38, pago_dos: 6, orden: 4 },
  { nombre: 'campana', peso: 6, pago_tres: 76, pago_dos: 11, orden: 5 },
  { nombre: 'estrella', peso: 3, pago_tres: 190, pago_dos: 24, orden: 6 },
  { nombre: 'wild', peso: 2, pago_tres: 400, pago_dos: 48, orden: 7 },
];

export function simbolosKitFrutas(motor: string): SimboloKit[] {
  const es5 = motor.startsWith('clasico-5');
  return BASE_3X3.map((s) => ({
    ...s,
    icono_url: ICONO(s.nombre),
    ...(es5 ? {
      // 5×3 suma cadenas de 4 y 5: pagos extra chicos para no disparar el RTP.
      pago_cuatro: Math.round(s.pago_tres * 1.15),
      pago_cinco: Math.round(s.pago_tres * 1.8),
    } : {}),
  }));
}

export const DESC_KIT_FRUTAS =
  'Clásico de frutas con comodín. Tres iguales en la línea del medio pagan; el comodín completa cualquier combinación.';

export const EFECTOS_KIT_FRUTAS: {
  nombre: string;
  tipo: 'carcasa' | 'premio';
  nivel_premio: 'dos_iguales' | 'tres_iguales' | 'premio_mayor' | null;
  posicion: 'linea' | 'pantalla' | null;
  css: string;
  duracion_ms: number;
}[] = [
  {
    nombre: 'Brillo del marco', tipo: 'carcasa', nivel_premio: null, posicion: null, duracion_ms: 3000,
    css: '@keyframes brillo-marco {\n  0%,100% { box-shadow: inset 0 0 20px rgba(217,164,65,.15); }\n  50% { box-shadow: inset 0 0 35px rgba(217,164,65,.4); }\n}\n.efecto { position:absolute; inset:0; border-radius:20px; pointer-events:none; animation: brillo-marco 3s ease-in-out infinite; }',
  },
  {
    nombre: 'Destello chico', tipo: 'premio', nivel_premio: 'dos_iguales', posicion: 'linea', duracion_ms: 700,
    css: '@keyframes destello-chico {\n  0% { opacity:0; transform:scale(.9); }\n  40% { opacity:.7; transform:scale(1.05); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(107,138,253,.5), transparent 70%); animation: destello-chico 700ms ease-out; }',
  },
  {
    nombre: 'Destello grande', tipo: 'premio', nivel_premio: 'tres_iguales', posicion: 'linea', duracion_ms: 900,
    css: '@keyframes destello-grande {\n  0% { opacity:0; transform:scale(.8); }\n  30% { opacity:1; transform:scale(1.15); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(91,191,136,.6), transparent 65%); animation: destello-grande 900ms ease-out; }',
  },
  {
    nombre: 'Explosión mayor', tipo: 'premio', nivel_premio: 'premio_mayor', posicion: 'pantalla', duracion_ms: 1300,
    css: '@keyframes explosion-mayor {\n  0% { opacity:0; transform:scale(.5); }\n  25% { opacity:1; transform:scale(1.1); }\n  60% { opacity:.8; transform:scale(1); }\n  100% { opacity:0; transform:scale(1.05); }\n}\n.efecto-premio { background: radial-gradient(circle, rgba(217,164,65,.7), rgba(217,164,65,.2) 50%, transparent 75%); animation: explosion-mayor 1300ms ease-out; }',
  },
];

export function esSlotClasico(motor: string): boolean {
  return motor.startsWith('clasico-3') || motor.startsWith('clasico-5');
}
