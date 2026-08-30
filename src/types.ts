// Tipos de dominio compartidos entre módulos del ensamblador. Se van
// completando a medida que se migra cada pantalla a TypeScript — no hace
// falta tipar de una todas las columnas que existen en la base (la tabla
// `juegos` tiene decenas de campos de posición: marco_x, cartel_y,
// grilla_tamano, *_blur, *_oscurecer, etc.). Por eso los tipos llevan un
// index signature: lo que todavía no está tipado no rompe.

export type EstadoJuego = 'borrador' | 'en_prueba' | 'listo';

export type NombreMotor = 'clasico-3x3' | 'clasico-5x3' | 'ruleta' | 'ruleta-botones';

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

  // Mines: en vez de calibrar una tabla de pagos, el RTP es un solo
  // número (el margen de la casa, 0.03 = 3%). Cada cara de la casilla
  // (tapada / segura / mina) es opcional y puede ser imagen O una
  // animación Lottie; sin nada se ve un estilo por defecto. Un asset
  // por cara: al setear uno se limpia el otro.
  mines_margen_pct?: number;
  mines_casilla_oculta_url?: string | null;
  mines_casilla_segura_url?: string | null;
  mines_casilla_mina_url?: string | null;
  mines_casilla_oculta_lottie_url?: string | null;
  mines_casilla_segura_lottie_url?: string | null;
  mines_casilla_mina_lottie_url?: string | null;
  /** 'minas' = solo las minas al perder; 'todo' = tablero entero. */
  mines_revelado_al_perder?: 'minas' | 'todo';
  /** Posición/aspecto de los controles del tablero de Mines (jsonb). */
  mines_controles?: Partial<PosControlesMines>;

  /** Ruleta de botones: toda su config (números, fichas, sorpresa). */
  ruleta_botones_cfg?: Partial<RuletaBotonesCfg>;

  created_at?: string;
  updated_at?: string;

  [columna: string]: unknown;
}

export type EstadoMines = 'en_curso' | 'retirada' | 'perdida';

/** Respuesta de `POST /api/mines-iniciar`. */
export interface RondaMines {
  roundId: string;
  minas: number;
  reveladas: number[];
  estado: EstadoMines;
  multiplicador: number;
  saldo?: number;
  yaExistia: boolean;
}

/** Respuesta de `POST /api/mines-revelar`. */
export interface RevelarMines {
  esMina: boolean;
  casilla: number;
  estado: EstadoMines;
  multiplicador?: number;
  puedeRetirar?: boolean;
  tableroCompleto?: boolean;
  /** Solo cuando se pisó una mina: dónde estaban todas. */
  posicionesMina?: number[];
}

/** Un recuadro posicionable de Mines (saldo / multiplicador). */
export interface RecuadroMines {
  x: number; y: number; ancho: number; alto: number;
  fondo_url?: string | null;
}
/** El botón de acción de Mines (Empezar / Retirar / Jugar de nuevo). */
export interface BotonMines {
  x: number; y: number; ancho: number; alto: number;
  imagen_url?: string | null;
}
/** El selector de cuántas minas poner (slider 1–24). */
export interface SelectorMinasCfg {
  x: number; y: number;
  ancho: number;
  /** Alto del carril en px (la perilla se agranda con él). */
  grosor: number;
  carril_url?: string | null;
  thumb_url?: string | null;
}

/** Posición y aspecto de todos los controles del tablero de Mines. */
export interface PosControlesMines {
  saldo: RecuadroMines;
  mult: RecuadroMines;
  apuesta: { x: number; y: number };
  minas: SelectorMinasCfg;
  boton: BotonMines;
}

/** Respuesta de `POST /api/mines-retirar`. */
export interface RetirarMines {
  ganancia: number;
  multiplicador: number;
  saldo: number | null;
  posicionesMina?: number[];
  repetido?: boolean;
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

  /** Ruleta de multiplicadores: color de la tajada. */
  color?: string | null;

  orden: number;

  // Reacciones Lottie opcionales (ver sql/30_migrar_a_lottie.sql).
  lottie_chico_url?: string | null;
  lottie_grande_url?: string | null;

  created_at?: string;
  [columna: string]: unknown;
}

/** Peso y pagos de un símbolo, tal como los guarda un perfil de RTP
 * (una foto de la tabla de pagos). */
export interface PagosSimbolo {
  peso: number;
  pago_dos: number;
  pago_tres: number;
  pago_cuatro?: number | null;
  pago_cinco?: number | null;
}

/** Una fila de la tabla `perfiles_rtp` (un "modo de pago" guardado del
 * juego: Tacaño, Nivelado, Generoso…). El juego tiene uno activo, que
 * es el que aplica el servidor al resolver cada giro. */
export interface PerfilRtp {
  id: string;
  juego_id: string;
  nombre: string;
  rtp_objetivo?: number | null;
  /** `{ [simbolo_id]: PagosSimbolo }` */
  pagos: Record<string, PagosSimbolo>;
  activo: boolean;
  orden: number;
  created_at?: string;
}

/** Config de rotación automática de perfiles de RTP (una fila por juego). */
export interface RotacionRtp {
  juego_id: string;
  activa: boolean;
  /** Franja "noche" en hora local del servidor (0-23). El resto es día. */
  noche_desde: number;
  noche_hasta: number;
  /** Peso de cada perfil por franja: `{ [perfil_id]: peso }`. */
  pesos_dia: Record<string, number>;
  pesos_noche: Record<string, number>;
  segmento_min: number;
  segmento_max: number;
}

/** Tramo de rotación vigente (una fila por juego). */
export interface RotacionEstado {
  juego_id: string;
  perfil_id: string | null;
  hasta_ts: string;
}

/** Una fila del historial de rotación. */
export interface RotacionHistorialFila {
  id: number;
  juego_id: string;
  perfil_id: string | null;
  perfil_nombre: string | null;
  desde_ts: string;
  hasta_ts: string | null;
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

/** Punto en la pantalla del juego, en píxeles de la escala fija 420×860. */
export interface Punto {
  x: number;
  y: number;
}

/** Rectángulo en píxeles de la escala fija (para la geometría de luces). */
export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

/** Una fila de la tabla `cadenas_luces`. Los campos de forma/figura/foco
 * pueden no existir todavía si no se corrió el SQL correspondiente — por
 * eso casi todos son opcionales y el código pone defaults en memoria. */
export interface CadenaLuz {
  id: string;
  juego_id: string;
  orden: number;
  modo: 'marco' | 'figura' | 'libre';
  cantidad: number;
  animacion: 'secuencial' | 'sincronizado' | 'ola' | 'alternado' | 'aleatorio' | 'vaiven';
  velocidad: number;
  colores: string[];
  puntos: Punto[];

  tamano?: number;
  forma?: 'circulo' | 'cuadrado' | 'rombo' | 'barra';
  ancho?: number;
  alto?: number;

  figura?: 'rectangulo' | 'circulo' | 'linea';
  figura_x?: number;
  figura_y?: number;
  figura_ancho?: number;
  figura_alto?: number;
  figura_rotacion?: number;

  glow?: number;
  nucleo?: number;
  apagado?: number;
  vidrio?: boolean;

  /** Focos ya montados en el DOM — se llena en `construirCadena`. */
  _dots?: Foco[];
  created_at?: string;
  [columna: string]: unknown;
}

/** Un foco de una cadena de luces: un div con memoria de su último
 * color/opacidad para no repintar de gusto en cada frame. */
export interface Foco extends HTMLDivElement {
  _color?: string;
  _op?: number;
}

/** Una fila de la tabla `capas_libres` (imágenes sueltas posicionables). */
export interface CapaLibre {
  id: string;
  juego_id: string;
  orden: number;
  imagen_url?: string | null;
  x: number;
  y: number;
  tamano: number;
  angulo: number;
  blur: number;
  oscurecer: number;
  created_at?: string;
}

/** Una fila de la tabla `animaciones_lottie` (intro y complementos de premio). */
export interface AnimacionLottie {
  id: string;
  juego_id: string;
  orden: number;
  evento: 'intro' | 'girar' | 'premio_chico' | 'premio_mayor';
  lottie_url?: string | null;
  x: number;
  y: number;
  tamano: number;
  created_at?: string;
}

/** Una fila de la tabla `premios_visuales` (cuadro de premio por nivel). */
export interface PremioVisual {
  id?: string | null;
  juego_id: string;
  nivel_premio: NivelPremio;
  imagen_url?: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  blur: number;
  oscurecer: number;
  imagen_x: number;
  imagen_y: number;
  imagen_tamano: number;
  monto_x: number;
  monto_y: number;
  monto_alto: number;
  monto_espaciado: number;
}

/** Una fila de la tabla `botones` (los botones chicos: −, +, x1, x2, x3). */
export interface Boton {
  id?: string | null;
  juego_id: string;
  clave: 'menos' | 'mas' | 'x1' | 'x2' | 'x3';
  imagen_url?: string | null;
  tamano: number;
  imagen_tamano: number;
  sin_fondo: boolean;
}

/** Una fila de la tabla `digitos` (íconos por carácter del monto ganado). */
export interface Digito {
  id?: string;
  juego_id: string;
  caracter: string;
  imagen_url?: string | null;
}

/** Resultado de un giro: lo devuelve `girar()` de cada motor y también,
 * con la misma forma, el endpoint `/api/jugar-girar`. */
export interface ResultadoGiro {
  grilla: Simbolo[][];
  premio: number;
  nivel: NivelPremio | null;
  filaPago: number;
  simbolosGanadores: number[];
  /** Solo en la respuesta del servidor (no en el motor local). */
  saldo?: number;
}

/** Una tajada de la rueda de multiplicadores, ya lista para dibujar. */
export interface RuletaSlot {
  et: string;
  mult: number;
  color: string | null;
  img?: string | null;
}

/** Respuesta de `/api/jugar-girar` cuando el motor es `ruleta`. La
 * `grilla` no es una matriz de símbolos sino el estado de la rueda. */
export interface ResultadoRuleta {
  grilla: { tipo: 'ruleta'; slots: RuletaSlot[]; ganadora: number };
  premio: number;
  nivel: NivelPremio | null;
  saldo: number;
  repetido?: boolean;
}

// ---------------- Ruleta de botones ----------------

/** Un multiplicador fijo (un botón) de la ruleta de botones. */
export interface NumeroRuleta {
  mult: number;
  /** Tajadas iguales que ocupa en la rueda. */
  cant: number;
  color: string;
  et: string;
  /** Imagen del multiplicador (botón + tajada). Opcional. */
  img?: string | null;
}
export interface SorpresaPoolItem { mult: number; peso: number; }
export interface SorpresaCfg {
  /** Fracción de jugadas en las que aparece (0–1). */
  frecuencia: number;
  pool: SorpresaPoolItem[];
  /** Tope de premio por jugada. 0 = sin tope. */
  tope: number;
}
export interface RuletaBotonesCfg {
  numeros: NumeroRuleta[];
  fichas: number[];
  sorpresa: SorpresaCfg;
  /** Id del tema visual (ver `src/juego/ruleta-temas.ts`). */
  tema: string;
  /** Grosor (px) del borde de color de cada botón. 0 = sin borde. */
  bordeGrosor: number;
}

/** Estado resuelto de un giro de la ruleta de botones. */
export interface ResueltoBotones {
  slots: RuletaSlot[];
  ganadora: number;
  ganadorIdx: number;
  sorpresa: { num: number; mult: number } | null;
  conSorpresa: boolean;
  /** Plata ganada (ya calculada). */
  premio: number;
}

/** Respuesta de `POST /api/ruleta-botones-girar`. */
export interface ResultadoRuletaBotones {
  resultado: ResueltoBotones;
  premio: number;
  saldo: number;
  repetido?: boolean;
}

/** Todo lo que arma un juego, tal como lo devuelve `/api/jugar-datos`
 * y como lo junta la vista previa desde consultas sueltas. */
export interface DatosJuego {
  juego: Juego;
  simbolos: Simbolo[];
  sonidos: Sonido[];
  efectos: Efecto[];
  premios: PremioVisual[];
  digitos: Digito[];
  capasLibres: CapaLibre[];
  botones: Boton[];
  cadenasLuces: CadenaLuz[];
  animaciones: AnimacionLottie[];
}

/** Lo que expone cada archivo de motor cargado por `cargarMotor()`. */
export interface MotorModulo {
  COLUMNAS: number;
  FILAS: number;
  FILA_PAGO: number;
  elegirSimbolo(simbolos: Simbolo[], total: number): Simbolo;
  girar(simbolos: Simbolo[]): ResultadoGiro;
}
