// Tipos de dominio compartidos entre módulos del ensamblador. Se van
// completando a medida que se migra cada pantalla a TypeScript — no hace
// falta tipar de una todas las columnas que existen en la base (la tabla
// `juegos` tiene decenas de campos de posición: marco_x, cartel_y,
// grilla_tamano, *_blur, *_oscurecer, etc.). Por eso los tipos llevan un
// index signature: lo que todavía no está tipado no rompe.

export type EstadoJuego = 'borrador' | 'en_prueba' | 'listo';

export type NombreMotor = 'clasico-3x3' | 'clasico-5x3';

/** Una fila de la tabla `juegos`. */
export interface Juego {
  id: string;
  slug: string;
  nombre: string;
  descripcion?: string | null;
  estado: EstadoJuego;
  motor: string;
  min_bet: number;
  max_bet: number;
  paso_apuesta?: number;

  publicado?: boolean;
  version?: number;

  // Assets principales (el resto de URLs y posiciones entran por el
  // index signature hasta que se tipen al migrar el editor).
  fondo_url?: string | null;
  fondo_pantalla_url?: string | null;
  marco_url?: string | null;
  cartel_url?: string | null;
  portada_url?: string | null;
  premio_url?: string | null;
  girar_imagen_url?: string | null;

  grilla_icono_tamano?: number;
  capas_orden?: string[];

  created_at?: string;
  updated_at?: string;

  [columna: string]: unknown;
}

/** Una fila de la tabla `simbolos`. */
export interface Simbolo {
  id: string;
  juego_id: string;
  nombre: string;
  icono_url?: string | null;

  peso: number;
  pago_dos: number;
  pago_tres: number;
  pago_cuatro?: number | null;
  pago_cinco?: number | null;

  orden: number;

  // Reacciones Lottie opcionales (ver sql/30_migrar_a_lottie.sql).
  lottie_chico_url?: string | null;
  lottie_grande_url?: string | null;

  created_at?: string;
  [columna: string]: unknown;
}

/** Una fila de la tabla `sonidos`. */
export interface Sonido {
  id: string;
  juego_id: string;
  tipo: 'musica_fondo' | 'giro' | 'premio_chico' | 'premio_grande';
  archivo_url: string;
  created_at?: string;
}

/** Una fila de la tabla `efectos`. */
export interface Efecto {
  id: string;
  juego_id: string;
  nombre: string;
  tipo: 'carcasa' | 'premio';
  nivel_premio?: NivelPremio | null;
  posicion?: 'linea' | 'pantalla' | null;
  css: string;
  pos_x?: number | null;
  pos_y?: number | null;
  tamano?: number | null;
  duracion_ms?: number | null;
  created_at?: string;
}

/** Nivel de premio que dispara un efecto o una reacción de símbolo. */
export type NivelPremio = 'dos_iguales' | 'tres_iguales' | 'premio_mayor';

/** Una fila de la tabla `clientes_conectados` (los casinos a los que se
 * les sirve juegos — hoy Win777). */
export interface Cliente {
  id: string;
  nombre: string;
  panel_url: string;
  secreto: string;
  activo: boolean;
  created_at?: string;
}

/** Versión reducida que devuelve `listarClientesActivos()`. */
export type ClienteActivo = Pick<Cliente, 'id' | 'nombre'>;

/** Salida del analizador de RTP (`src/motor.ts` → `analizar()`). Es un
 * cálculo exacto, no una simulación: recorre todas las combinaciones
 * posibles pesadas por su probabilidad. */
export interface ResultadoAnalisis {
  /** RTP en porcentaje (ev * 100). */
  rtp: number;
  /** Desvío estándar del pago por giro. */
  volatilidad: number;
  /** 1 / (probabilidad de premio). null si nunca paga. */
  frecuencia: number | null;
  /** Pago más alto configurado para la cantidad de rodillos del motor. */
  premioMayor: number;
}

/** Lo que expone cada archivo de motor cargado por `cargarMotor()`. */
export interface MotorModulo {
  COLUMNAS?: number;
  FILAS?: number;
  girar?: (...args: unknown[]) => unknown;
  [exportName: string]: unknown;
}
