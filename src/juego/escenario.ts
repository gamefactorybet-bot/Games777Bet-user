// =========================================================
// ESCENARIO DEL JUEGO — DOM 420×860 compartido.
//
// Lo usan la vista previa del ensamblador (Preview) y la pantalla real
// del jugador (Jugar). Antes esto estaba copiado en `preview.js` y
// `jugar.js` con prefijos `pv-` / `jg-` y se desincronizaba.
//
// `crearEscenario(opts)` construye el DOM, lo posiciona según lo que
// tenga guardado el juego, engancha las luces, la música y el cuadro
// de premio, y devuelve un objeto con los nodos que necesita el motor
// de rodillos y métodos para re-aplicar todo en vivo (los usa el panel
// de ajuste). NO incluye el motor de rodillos (cada pantalla trae el
// suyo) ni el manejador del botón de girar.
// =========================================================

import { ANCHO_ESC, ALTO_ESC, construirCadena, iniciarAnimacionLuces } from '../luces.ts';
import { mostrarAnimacionJuego, detenerAnimacionesJuego, detenerAnimacionesSimbolos } from '../lottie.ts';
import { conDefaults, ordenPorDefecto, filtroCss, posPremioDefaults, escapeHtml } from './defaults.ts';
import type { CapaId, PosCapas, PosPremio } from './defaults.ts';
import { pintarMonto } from './monto.ts';
import { fichasDe } from '../../motor/fichas.js';
import { engancharLoopVideo, htmlCapaFondo } from './fondo.ts';
import { audiosDe } from './sfx.ts';
import { planillaDe, planillaJson, posTurbo, type ClavePlanilla, type Planilla } from './planilla.ts';
import { asignarImagen, encajarImagen, engancharSilueta } from './silueta.ts';
import type {
  AnimacionLottie, Boton, CadenaLuz, CapaLibre, Digito, Efecto, Juego,
  NivelPremio, PremioVisual, Rect, Simbolo, Sonido,
} from '../types.ts';

type Modo = 'preview' | 'jugar';

/** Etiqueta corta para la ficha sin imagen: 1k, 5k, 1M… */
function fichaCorto(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k';
  return String(Math.round(n));
}

export interface CrearEscenarioOpts {
  modo: Modo;
  juego: Juego;
  simbolos: Simbolo[];
  sonidos: Sonido[];
  efectos: Efecto[];
  premios: PremioVisual[];
  digitos: Digito[];
  capasLibres: CapaLibre[];
  cadenasLuces: CadenaLuz[];
  animaciones: AnimacionLottie[];
  botones: Boton[];
  motor: { COLUMNAS: number; FILAS: number; FILA_PAGO: number };
  /** Mines: escenario sin rodillos ni controles de slot. La grilla
   *  queda como una caja vacía y posicionable (el tablero se monta
   *  adentro por fuera). Todo lo de arte/luces/libres funciona igual. */
  esMines?: boolean;
  /** Ruleta: como Mines, la grilla es una caja vacía y posicionable
   *  (adentro se monta la rueda en canvas), PERO se conservan los
   *  controles de slot (saldo, apuesta, girar, fichas, turbo). */
  esRuleta?: boolean;
  /** Ruleta de botones: caja vacía y SIN controles de slot (trae los
   *  suyos: fichas, botones de multiplicador, girar). Como Mines. */
  esRuletaBotones?: boolean;
  /** Crash: caja vacía y SIN controles de slot (trae los suyos:
   *  apostar/retirar, apuesta, auto-retiro, multiplicador). Como Mines. */
  esCrash?: boolean;
  /** Plinko: caja vacía y SIN controles de slot (trae los suyos:
   *  soltar, apuesta, filas/riesgo). Como Mines. */
  esPlinko?: boolean;
  /** Raspadita: caja vacía y SIN controles de slot (trae los suyos:
   *  comprar tarjeta, apuesta). Como Mines. */
  esRaspadita?: boolean;
  /** Keno: caja vacía y SIN controles de slot (trae los suyos:
   *  tablero, bolillero, jugar, apuesta). Como Mines. */
  esKeno?: boolean;
  /** Torre: caja vacía y SIN controles de slot (trae los suyos:
   *  la torre de casillas, multiplicador, retirar, apuesta). Como Mines. */
  esTorre?: boolean;
}

const CLAVES_BOTON: { clave: Boton['clave']; etiqueta: string }[] = [
  { clave: 'menos', etiqueta: '− (bajar apuesta)' },
  { clave: 'mas', etiqueta: '+ (subir apuesta)' },
  { clave: 'x1', etiqueta: 'x1' },
  { clave: 'x2', etiqueta: 'x2' },
  { clave: 'x3', etiqueta: 'x3' },
];

interface CfgGirar {
  girar_x: number; girar_y: number; girar_tamano: number;
  girar_imagen_tamano: number; girar_imagen_url: string | null; girar_sin_fondo: boolean;
}
interface CfgGrupos {
  saldo_x: number; saldo_y: number; apuesta_x: number; apuesta_y: number;
  turbo_x: number; turbo_y: number; fichas_x: number; fichas_y: number;
  saldo_ancho: number; saldo_alto: number; apuesta_ancho: number; apuesta_alto: number;
  saldo_fondo_url: string | null; apuesta_fondo_url: string | null;
}
interface CfgBoton {
  id: string | null; imagen_url: string | null; tamano: number; imagen_tamano: number; sin_fondo: boolean;
}

export interface Escenario {
  modo: Modo;
  el: HTMLElement;
  wrap: HTMLElement;
  motor: { COLUMNAS: number; FILAS: number; FILA_PAGO: number };

  cintas: HTMLElement[];
  grillaEl: HTMLElement;
  grillaFondoEl: HTMLElement;
  efectoPremio: HTMLElement;
  animRiveEl: HTMLElement;
  cadenasLuzEl: HTMLElement;
  capasLibresEl: HTMLElement;
  btnGirar: HTMLButtonElement;
  saldoEl: HTMLElement;
  apuestaEl: HTMLElement;

  pos: PosCapas;
  ordenCapas: CapaId[];
  posPremio: Record<NivelPremio, PosPremio>;
  posGirar: CfgGirar;
  posGrupos: CfgGrupos;
  botones: Record<string, CfgBoton>;
  fichas: number[];
  mapaDigitos: Record<string, string>;
  audios: Partial<Record<string, HTMLAudioElement>>;
  cadenasLuces: CadenaLuz[];
  capasLibres: CapaLibre[];
  animaciones: AnimacionLottie[];
  efectos: Efecto[];
  simbolos: Simbolo[];

  apuesta: number;
  apuestaMin: number;
  apuestaMax: number;
  pasoApuesta: number;
  saldo: number;
  velocidad: number;
  girando: boolean;
  modoApuesta: string;
  mostrarNombre: boolean;
  contadorMs: number;

  escalar(): void;
  aplicarPosiciones(): void;
  aplicarOrden(): void;
  aplicarFiltros(): void;
  aplicarCapasLibres(): void;
  aplicarGirar(): void;
  aplicarGrupos(): void;
  aplicarModo(): void;
  aplicarBotonesApuesta(): void;
  pintarTurbo(): void;
  pintarFichas(): void;
  pintarApuesta(): void;
  rectMarco(): Rect;
  reconstruirCadena(c: CadenaLuz): void;
  desactivarArrastreLuces(): void;
  aplicarPosicionPremio(nivel: NivelPremio): void;
  mostrarPremio(monto: number, nivel: NivelPremio): void;
  ocultarPremio(): void;
  lanzarAnimaciones(evento: string): void;
  setMontoDemo(texto: string | null): void;
  setMostrarNombre(v: boolean): void;
  /** Color elegido para el borde iluminado. null = acento del editor. */
  bordeLuz: string | null;
  setBordeLuz(color: string | null): void;
  planilla: Planilla;
  setVisible(clave: ClavePlanilla, on: boolean): void;
  setAutoImagen(url: string | null): void;
  setAutoPos(x: number, y: number): void;
  setAutoTam(tam: number): void;
  setTurboPos(clave: 'x1' | 'x2' | 'x3', x: number, y: number): void;
  destruir(): void;
}

function hexColor(v: unknown): string | null {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

export function crearEscenario(opts: CrearEscenarioOpts): Escenario {
  const { modo, juego, sonidos, efectos, premios, digitos, animaciones, motor } = opts;
  const { COLUMNAS, FILAS } = motor;
  const esMines = !!opts.esMines;
  const esRuleta = !!opts.esRuleta;
  const esRuletaBotones = !!opts.esRuletaBotones;
  const esCrash = !!opts.esCrash;
  const esPlinko = !!opts.esPlinko;
  const esRaspadita = !!opts.esRaspadita;
  const esKeno = !!opts.esKeno;
  const esTorre = !!opts.esTorre;
  // Grilla como caja vacía y posicionable (Mines, las ruletas, el crash,
  // el plinko, la raspadita, el keno y la torre montan su contenido adentro).
  const cajaVacia = esMines || esRuleta || esRuletaBotones || esCrash || esPlinko || esRaspadita || esKeno || esTorre;
  // Sin controles de slot (traen los suyos).
  const sinControlesSlot = esMines || esRuletaBotones || esCrash || esPlinko || esRaspadita || esKeno || esTorre;

  const pos = conDefaults(juego);
  const ordenCapas = ordenPorDefecto(juego);

  const posPremio = {} as Record<NivelPremio, PosPremio>;
  (['dos_iguales', 'tres_iguales', 'premio_mayor'] as NivelPremio[]).forEach((valor) => {
    const fila = (premios || []).find((f) => f.nivel_premio === valor);
    posPremio[valor] = posPremioDefaults(fila);
  });

  const mapaDigitos: Record<string, string> = {};
  (digitos || []).forEach((d) => { if (d.imagen_url) mapaDigitos[d.caracter] = d.imagen_url; });

  const posGirar: CfgGirar = {
    girar_x: Number(juego.girar_x ?? 50), girar_y: Number(juego.girar_y ?? 90),
    girar_tamano: Number(juego.girar_tamano ?? 64),
    girar_imagen_tamano: Number(juego.girar_imagen_tamano ?? 70),
    girar_imagen_url: (juego.girar_imagen_url as string) || null,
    girar_sin_fondo: Boolean(juego.girar_sin_fondo ?? false),
  };

  const posGrupos: CfgGrupos = {
    saldo_x: Number(juego.saldo_x ?? 14), saldo_y: Number(juego.saldo_y ?? 96),
    apuesta_x: Number(juego.apuesta_x ?? 50), apuesta_y: Number(juego.apuesta_y ?? 96),
    turbo_x: Number(juego.turbo_x ?? 86), turbo_y: Number(juego.turbo_y ?? 96),
    fichas_x: Number(juego.fichas_x ?? 50), fichas_y: Number(juego.fichas_y ?? 88),
    saldo_ancho: Number(juego.saldo_ancho ?? 110), saldo_alto: Number(juego.saldo_alto ?? 44),
    apuesta_ancho: Number(juego.apuesta_ancho ?? 110), apuesta_alto: Number(juego.apuesta_alto ?? 44),
    saldo_fondo_url: (juego.saldo_fondo_url as string) || null,
    apuesta_fondo_url: (juego.apuesta_fondo_url as string) || null,
  };

  const botones: Record<string, CfgBoton> = {};
  CLAVES_BOTON.forEach(({ clave }) => {
    const fila = (opts.botones || []).find((f) => f.clave === clave);
    botones[clave] = {
      id: fila?.id || null, imagen_url: fila?.imagen_url || null,
      tamano: fila?.tamano ?? 28, imagen_tamano: fila?.imagen_tamano ?? 70,
      sin_fondo: fila?.sin_fondo ?? false,
    };
  });

  const pasoApuesta = Number(juego.paso_apuesta) || 500;
  const apuestaMin = Number(juego.min_bet) || 1000;
  const apuestaMax = Number(juego.max_bet) || 100000;
  const fichasPorDefecto = [1, 2, 5, 20, 50].map((m) => apuestaMin * m).filter((f) => f <= apuestaMax);
  const fichasJuego = juego.fichas as number[] | undefined;
  const fichasIniciales = fichasJuego?.length ? fichasJuego.map(Number) : fichasPorDefecto;
  // Fichas "ricas" (motor/fichas.js): botón redondo con imagen y tamaño
  // propios. Si el juego tiene alguna cargada, reemplazan a las fichas
  // simples y a los −/+ (mismo criterio que el resto de los motores).
  const fichasRicas = fichasDe(juego) as {
    valor: number; imagen_url: string | null; tam: number; imgTam: number;
  }[];

  const cssEfectos = (efectos || []).map((ef) => ef.css || '').join('\n');
  const audios = audiosDe(sonidos, juego.motor);

  const fondoBg = juego.fondo_url ? `center/cover url('${juego.fondo_url}')` : 'var(--surface-alt)';

  // ---------------- Template del escenario ----------------
  const wrap = document.createElement('div');
  const el = document.createElement('div');
  el.className = 'jg-marco-cap';
  el.style.cssText = 'width:420px; height:860px; flex-shrink:0; transform-origin:top center;'
    + 'background:var(--surface); border-radius:20px; padding:22px; position:relative; overflow:visible';
  const bordeInicial = hexColor(juego.borde_luz);
  if (bordeInicial) el.style.setProperty('--jg-borde', bordeInicial);
  const planilla = planillaDe(juego);
  if (modo === 'jugar') {
    el.style.transformOrigin = 'center center';
    wrap.style.cssText = 'min-height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden';
  } else {
    el.style.border = '1px dashed var(--border)';
    wrap.style.cssText = 'width:420px; height:860px; flex-shrink:0';
  }
  wrap.appendChild(el);

  el.innerHTML = `
    <style>${cssEfectos}</style>
    ${juego.fondo_pantalla_url ? htmlCapaFondo(juego.fondo_pantalla_url) : ''}
    ${juego.marco_url ? `<img data-capa-img="marco" src="${juego.marco_url}" style="position:absolute; object-fit:fill; pointer-events:none" />` : ''}

    <div data-titulo-row style="display:flex; align-items:center; gap:8px; position:relative; z-index:10">
      <div style="width:28px"></div>
      <p data-titulo style="flex:1; text-align:center; font-weight:600; margin:0; letter-spacing:.04em; ${(juego.mostrar_nombre ?? true) ? '' : 'visibility:hidden'}">${escapeHtml(juego.nombre).toUpperCase()}</p>
      <button data-info aria-label="Ver información del juego" style="width:28px; height:28px; padding:0; border-radius:50%; flex-shrink:0">ℹ</button>
    </div>

    ${cajaVacia ? `
    <div data-grilla style="position:absolute; overflow:visible; transform:translate(-50%,-50%)"></div>
    ` : `
    <div data-grilla style="display:grid; grid-template-columns:repeat(${COLUMNAS},1fr); gap:6px; border-radius:12px; padding:8px; position:absolute; overflow:hidden; aspect-ratio:${COLUMNAS}/${FILAS}">
      <div data-grilla-fondo style="position:absolute; inset:0; background:${fondoBg}; z-index:0"></div>
      ${Array.from({ length: COLUMNAS }, (_, i) => `
      <div class="jg-columna" data-col="${i}" style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" data-cinta="${i}" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>`).join('')}
      <div data-efecto-premio style="position:absolute; inset:0; pointer-events:none; opacity:0; z-index:2"></div>
    </div>
    `}

    ${juego.cartel_url ? `<img data-capa-img="cartel" src="${juego.cartel_url}" style="position:absolute; object-fit:fill; pointer-events:none" />` : ''}

    <div data-capas-libres style="position:absolute; inset:0; z-index:8; pointer-events:none"></div>
    <div data-cadenas-luces style="position:absolute; inset:0; z-index:9; pointer-events:none"></div>
    <div data-anim-rive style="position:absolute; inset:0; z-index:14; pointer-events:none"></div>

    <div data-premio-popup style="position:absolute; z-index:15; display:none; border-radius:12px; background:rgba(0,0,0,.55); transition:opacity .25s; opacity:0; transform:translate(-50%,-50%)">
      <img data-img-premio style="position:absolute; z-index:0; display:none" />
      <strong data-premio-monto style="position:absolute; z-index:1; font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); white-space:nowrap"></strong>
    </div>

    <div data-grupo-saldo style="position:absolute; z-index:10; white-space:nowrap; display:flex; flex-direction:column; align-items:center; justify-content:center; background-size:100% 100%; background-repeat:no-repeat">
      <p class="hint" style="margin:0">${modo === 'jugar' ? 'Saldo' : 'Saldo de prueba'}</p>
      <strong data-saldo style="font-size:18px">10.000</strong>
    </div>

    <div data-grupo-apuesta style="position:absolute; z-index:10; display:flex; align-items:center; gap:6px; white-space:nowrap">
      <button data-apuesta-menos aria-label="Bajar apuesta" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
        <span class="jg-btn-texto">−</span><img class="jg-btn-img jg-silueta" alt="" style="display:none; object-fit:contain" />
      </button>
      <div data-caja-apuesta style="display:flex; flex-direction:column; align-items:center; justify-content:center; background-size:100% 100%; background-repeat:no-repeat">
        <p class="hint" style="margin:0">Apuesta</p>
        <strong data-apuesta style="font-size:15px"></strong>
      </div>
      <button data-apuesta-mas aria-label="Subir apuesta" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
        <span class="jg-btn-texto">+</span><img class="jg-btn-img jg-silueta" alt="" style="display:none; object-fit:contain" />
      </button>
    </div>

    <div data-fichas style="position:absolute; z-index:10; display:flex; gap:4px; flex-wrap:wrap; justify-content:center; white-space:nowrap"></div>
    <div data-turbo style="position:absolute; z-index:10; display:flex; gap:3px; white-space:nowrap"></div>

    <button data-girar class="jg-play" style="position:absolute; z-index:11; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden">
      <span data-girar-texto style="font-size:14px">Girar</span>
      <img data-girar-img class="jg-silueta" alt="" style="display:none; object-fit:contain" />
    </button>
  `;

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const ELEMENTO_CAPA: Record<CapaId, HTMLElement | null> = {
    fondo_pantalla: el.querySelector('[data-capa-img="fondo_pantalla"]'),
    marco: el.querySelector('[data-capa-img="marco"]'),
    grilla: q('[data-grilla]'),
    cartel: el.querySelector('[data-capa-img="cartel"]'),
  };
  const grillaEl = q('[data-grilla]');
  const grillaFondoEl = q('[data-grilla-fondo]');
  const efectoPremio = q('[data-efecto-premio]');
  const animRiveEl = q('[data-anim-rive]');
  const cadenasLuzEl = q('[data-cadenas-luces]');
  const capasLibresEl = q('[data-capas-libres]');
  const premioPopupEl = q('[data-premio-popup]');
  const imgPremio = q<HTMLImageElement>('[data-img-premio]');
  const montoPremioEl = q('[data-premio-monto]');
  const btnGirar = q<HTMLButtonElement>('[data-girar]');
  const girarImgEl = q<HTMLImageElement>('[data-girar-img]');
  const girarTextoEl = q('[data-girar-texto]');
  const saldoEl = q('[data-saldo]');
  const apuestaEl = q('[data-apuesta]');
  const grupoSaldoEl = q('[data-grupo-saldo]');
  const grupoApuestaEl = q('[data-grupo-apuesta]');
  const grupoTurboEl = q('[data-turbo]');
  const cajaApuestaEl = q('[data-caja-apuesta]');
  const fichasEl = q('[data-fichas]');
  const btnMenos = q<HTMLButtonElement>('[data-apuesta-menos]');
  const btnMas = q<HTMLButtonElement>('[data-apuesta-mas]');
  const cintas = Array.from({ length: COLUMNAS }, (_, i) => q(`[data-cinta="${i}"]`));

  // En la pantalla del jugador el botón ℹ va en la esquina, no en la
  // fila del título (que puede estar oculta si mostrar_nombre es false).
  if (modo === 'jugar' && !cajaVacia) {
    Object.assign(q('[data-info]').style, {
      position: 'absolute', right: '22px', top: '22px', zIndex: '12', width: '30px', height: '30px',
    });
  }

  const tituloRowEl = q<HTMLElement>('[data-titulo-row]');
  const tituloEl = q<HTMLElement>('[data-titulo]');

  // Mines / ruleta de botones: sin controles de slot ni cuadro de
  // premio (traen los suyos). Se dejan en el DOM pero ocultos.
  if (sinControlesSlot) {
    [premioPopupEl, efectoPremio, grupoSaldoEl, grupoApuestaEl, grupoTurboEl, fichasEl, btnGirar, q('[data-info]')]
      .forEach((n) => { if (n) n.style.display = 'none'; });
    // En Mines la fila del título se colapsa entera al ocultar el nombre
    // (en los slots solo se hace invisible, para no correr el layout).
    if (!(juego.mostrar_nombre ?? true) && tituloRowEl) tituloRowEl.style.display = 'none';
  }

  // Ruleta: conserva los controles de slot, pero no tiene tabla de
  // pagos ni el efecto de premio sobre la línea.
  if (esRuleta) {
    [efectoPremio, q('[data-info]')].forEach((n) => { if (n) n.style.display = 'none'; });
    if (!(juego.mostrar_nombre ?? true) && tituloRowEl) tituloRowEl.style.display = 'none';
  }

  // ---------------- Escala 420×860 ----------------
  const escalar = () => {
    if (modo === 'jugar') {
      const escala = Math.min(window.innerWidth / 420, window.innerHeight / 860);
      el.style.transform = `scale(${escala})`;
      el.style.margin = `${(860 * escala - 860) / 2}px ${(420 * escala - 420) / 2}px`;
    } else {
      const escala = Math.min(1, (window.innerHeight - 90) / 860);
      el.style.transform = `scale(${escala})`;
      wrap.style.height = (860 * escala) + 'px';
      wrap.style.width = (420 * escala) + 'px';
      el.style.marginLeft = ((420 * escala - 420) / 2) + 'px';
    }
  };

  // ---------------- Capas: posición, orden, filtros ----------------
  const aplicarOrden = () => {
    ordenCapas.forEach((capa, i) => {
      const n = ELEMENTO_CAPA[capa];
      if (n) n.style.zIndex = String(i);
    });
  };

  const aplicarPosiciones = () => {
    const posicionar = (n: HTMLElement | null, x: number, y: number, ancho: number, alto?: number) => {
      if (!n) return;
      Object.assign(n.style, {
        left: x + '%', top: y + '%', width: ancho + '%',
        ...(alto !== undefined ? { height: alto + '%' } : {}),
        transform: 'translate(-50%,-50%)',
      });
    };
    posicionar(ELEMENTO_CAPA.fondo_pantalla, pos.fondo_pantalla_x, pos.fondo_pantalla_y, pos.fondo_pantalla_ancho, pos.fondo_pantalla_alto);
    posicionar(ELEMENTO_CAPA.marco, pos.marco_x, pos.marco_y, pos.marco_ancho, pos.marco_alto);
    posicionar(ELEMENTO_CAPA.cartel, pos.cartel_x, pos.cartel_y, pos.cartel_ancho, pos.cartel_alto);
    posicionar(ELEMENTO_CAPA.grilla, pos.grilla_x, pos.grilla_y, pos.grilla_tamano);
  };

  const aplicarFiltros = () => {
    if (ELEMENTO_CAPA.fondo_pantalla) ELEMENTO_CAPA.fondo_pantalla.style.filter = filtroCss(pos.fondo_pantalla_blur, pos.fondo_pantalla_oscurecer);
    if (ELEMENTO_CAPA.marco) ELEMENTO_CAPA.marco.style.filter = filtroCss(pos.marco_blur, pos.marco_oscurecer);
    if (ELEMENTO_CAPA.cartel) ELEMENTO_CAPA.cartel.style.filter = filtroCss(pos.cartel_blur, pos.cartel_oscurecer);
    if (grillaFondoEl) grillaFondoEl.style.filter = filtroCss(pos.fondo_blur, pos.fondo_oscurecer);
  };

  const aplicarCapasLibres = () => {
    capasLibresEl.innerHTML = opts.capasLibres.map((c) => c.imagen_url ? `
      <img src="${c.imagen_url}" style="position:absolute; left:${c.x}%; top:${c.y}%; width:${c.tamano}%; height:auto; transform:translate(-50%,-50%) rotate(${c.angulo}deg); filter:${filtroCss(c.blur, c.oscurecer)}" />
    ` : '').join('');
  };

  // ---------------- Cadenas de luces ----------------
  const rectMarco = (): Rect => {
    if (juego.marco_url) {
      const w = pos.marco_ancho / 100 * ANCHO_ESC, h = pos.marco_alto / 100 * ALTO_ESC;
      return { left: pos.marco_x / 100 * ANCHO_ESC - w / 2, top: pos.marco_y / 100 * ALTO_ESC - h / 2, w, h };
    }
    return { left: ANCHO_ESC * 0.1, top: ALTO_ESC * 0.1, w: ANCHO_ESC * 0.8, h: ALTO_ESC * 0.8 };
  };

  const reconstruirCadena = (c: CadenaLuz) => {
    let cadenaWrap = cadenasLuzEl.querySelector<HTMLElement>(`[data-cadena="${c.id}"]`);
    if (!cadenaWrap) {
      cadenaWrap = document.createElement('div');
      cadenaWrap.dataset.cadena = c.id;
      cadenaWrap.style.cssText = 'position:absolute; inset:0; pointer-events:none';
      cadenasLuzEl.appendChild(cadenaWrap);
    }
    construirCadena(cadenaWrap, c, rectMarco);
  };

  const desactivarArrastreLuces = () => {
    cadenasLuzEl.querySelectorAll<HTMLElement>('[data-cadena]').forEach((w) => { w.style.pointerEvents = 'none'; });
  };

  (opts.cadenasLuces || []).forEach(reconstruirCadena);
  const pararLuces = iniciarAnimacionLuces(() => escenario.cadenasLuces, () => escenario.girando);

  // ---------------- Cuadro de premio ----------------
  let montoDemoTexto: string | null = null;
  const setMontoDemo = (t: string | null) => { montoDemoTexto = t; };

  const setMostrarNombre = (v: boolean) => {
    escenario.mostrarNombre = v;
    if (cajaVacia) {
      if (tituloRowEl) tituloRowEl.style.display = v ? 'flex' : 'none';
    } else if (tituloEl) {
      tituloEl.style.visibility = v ? 'visible' : 'hidden';
    }
  };

  const aplicarPosicionPremio = (nivel: NivelPremio) => {
    const p = posPremio[nivel];
    premioPopupEl.style.left = p.x + '%';
    premioPopupEl.style.top = p.y + '%';
    premioPopupEl.style.width = p.ancho + '%';
    premioPopupEl.style.height = p.alto + '%';
    if (p.imagen_url) {
      imgPremio.src = p.imagen_url;
      imgPremio.style.display = 'block';
      imgPremio.style.filter = filtroCss(p.blur, p.oscurecer);
    } else {
      imgPremio.style.display = 'none';
    }
    Object.assign(imgPremio.style, {
      left: p.imagen_x + '%', top: p.imagen_y + '%', width: p.imagen_tamano + '%', height: 'auto',
      transform: 'translate(-50%,-50%)',
    });
    Object.assign(montoPremioEl.style, {
      left: p.monto_x + '%', top: p.monto_y + '%', transform: 'translate(-50%,-50%)',
    });
    if (montoDemoTexto !== null) pintarMonto(montoPremioEl, montoDemoTexto, p.monto_alto, p.monto_espaciado, mapaDigitos);
  };

  let animContador = 0;
  let timerPremio: ReturnType<typeof setTimeout> | null = null;

  const contarHasta = (monto: number, nivel: NivelPremio) => {
    cancelAnimationFrame(animContador);
    const duracion = Number(juego.contador_ms ?? 900);
    const p = posPremio[nivel];
    let ultimoTexto: string | null = null;

    const pintar = (valor: number) => {
      const texto = '+' + Math.round(valor).toLocaleString('es-PY');
      if (texto === ultimoTexto) return;
      ultimoTexto = texto;
      montoDemoTexto = texto;
      pintarMonto(montoPremioEl, texto, p.monto_alto, p.monto_espaciado, mapaDigitos);
    };

    if (duracion <= 0) { pintar(monto); return; }

    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - Math.pow(1 - t, 3);
      pintar(monto * suave);
      if (t < 1) animContador = requestAnimationFrame(paso);
      else pintar(monto);
    };
    animContador = requestAnimationFrame(paso);
  };

  const ocultarPremio = () => {
    cancelAnimationFrame(animContador);
    premioPopupEl.style.opacity = '0';
    setTimeout(() => { premioPopupEl.style.display = 'none'; }, 250);
  };

  const mostrarPremio = (monto: number, nivel: NivelPremio) => {
    if (timerPremio) clearTimeout(timerPremio);
    montoDemoTexto = '+0';
    aplicarPosicionPremio(nivel);
    premioPopupEl.style.display = 'flex';
    void premioPopupEl.offsetWidth;
    premioPopupEl.style.opacity = '1';
    contarHasta(monto, nivel);
    timerPremio = setTimeout(ocultarPremio, Number(juego.contador_ms ?? 900) + 2000);
  };

  // ---------------- Animaciones Lottie del juego ----------------
  const lanzarAnimaciones = (evento: string) => {
    (escenario.animaciones || []).filter((a) => a.evento === evento && a.lottie_url)
      .forEach((a) => mostrarAnimacionJuego(animRiveEl, a));
  };

  // ---------------- Controles: girar, grupos, botones ----------------
  const aplicarBoton = (n: HTMLElement | null, cfg: CfgBoton) => {
    if (!n) return;
    const img = n.querySelector<HTMLImageElement>('.jg-btn-img');
    const texto = n.querySelector<HTMLElement>('.jg-btn-texto');
    const conImg = !!(cfg.imagen_url && img);
    n.classList.toggle('jg-con-img', conImg);
    if (conImg) {
      const lado = cfg.tamano * cfg.imagen_tamano / 100;
      asignarImagen(img, cfg.imagen_url as string);
      encajarImagen(img, lado);
      img.style.display = 'block';
      img.style.objectFit = 'fill';
      Object.assign(n.style, {
        width: 'auto', height: 'auto', overflow: 'visible',
        background: 'transparent', border: 'none', borderRadius: '0', padding: '0',
      });
      n.dataset.forma = cfg.sin_fondo ? '1' : '';
      engancharSilueta(n, img);
      if (texto) texto.style.display = 'none';
    } else if (img) {
      Object.assign(n.style, {
        width: cfg.tamano + 'px', height: cfg.tamano + 'px',
        background: cfg.sin_fondo ? 'transparent' : '',
        border: cfg.sin_fondo ? 'none' : '',
        borderRadius: '', overflow: 'hidden',
      });
      img.removeAttribute('src');
      img.dataset.url = '';
      img.style.display = 'none';
      n.dataset.forma = '';
      if (texto) texto.style.display = 'block';
    }
  };

  const aplicarBotonesApuesta = () => {
    aplicarBoton(btnMenos, botones.menos);
    aplicarBoton(btnMas, botones.mas);
  };

  const aplicarGirar = () => {
    const tam = posGirar.girar_tamano;
    const conImg = !!posGirar.girar_imagen_url;
    Object.assign(btnGirar.style, {
      left: posGirar.girar_x + '%', top: posGirar.girar_y + '%',
      transform: 'translate(-50%,-50%)',
      background: conImg || posGirar.girar_sin_fondo ? 'transparent' : '',
      border: conImg || posGirar.girar_sin_fondo ? 'none' : '',
      borderRadius: conImg ? '0' : '50%',
      overflow: conImg ? 'visible' : 'hidden',
      padding: '0',
    });
    btnGirar.classList.toggle('jg-con-img', conImg);
    if (conImg) {
      asignarImagen(girarImgEl, posGirar.girar_imagen_url as string);
      encajarImagen(girarImgEl, tam * posGirar.girar_imagen_tamano / 100);
      girarImgEl.style.display = 'block';
      girarImgEl.style.objectFit = 'fill';
      btnGirar.style.width = 'auto';
      btnGirar.style.height = 'auto';
      girarTextoEl.style.display = 'none';
      btnGirar.dataset.forma = posGirar.girar_sin_fondo ? '1' : '';
      engancharSilueta(btnGirar, girarImgEl);
    } else {
      btnGirar.style.width = tam + 'px';
      btnGirar.style.height = tam + 'px';
      girarImgEl.removeAttribute('src');
      girarImgEl.dataset.url = '';
      girarImgEl.style.display = 'none';
      girarTextoEl.style.display = 'block';
      btnGirar.dataset.forma = '';
    }
  };

  const aplicarPlanilla = () => {
    const v = planilla.visibles;
    btnGirar.style.display = v.girar ? '' : 'none';
    grupoTurboEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const clave = ('x' + b.dataset.v) as ClavePlanilla;
      b.style.display = v[clave] ? 'flex' : 'none';
    });
    grupoTurboEl.style.display = (v.x1 || v.x2 || v.x3) ? 'flex' : 'none';
  };

  const aplicarGrupos = () => {
    const ubicar = (n: HTMLElement, x: number, y: number) => Object.assign(n.style, {
      left: x + '%', top: y + '%', transform: 'translate(-50%,-50%)',
    });
    ubicar(grupoSaldoEl, posGrupos.saldo_x, posGrupos.saldo_y);
    ubicar(grupoApuestaEl, posGrupos.apuesta_x, posGrupos.apuesta_y);
    // x1, x2 y x3 van cada uno en su sitio. El grupo solo les da el recuadro.
    Object.assign(grupoTurboEl.style, {
      left: '0', top: '0', width: '100%', height: '100%', transform: 'none',
      pointerEvents: 'none',
    });
    posicionarTurbo();
    ubicar(fichasEl, posGrupos.fichas_x, posGrupos.fichas_y);
    Object.assign(grupoSaldoEl.style, {
      width: posGrupos.saldo_ancho + 'px', height: posGrupos.saldo_alto + 'px',
      backgroundImage: posGrupos.saldo_fondo_url ? `url('${posGrupos.saldo_fondo_url}')` : 'none',
    });
    Object.assign(cajaApuestaEl.style, {
      width: posGrupos.apuesta_ancho + 'px', height: posGrupos.apuesta_alto + 'px',
      backgroundImage: posGrupos.apuesta_fondo_url ? `url('${posGrupos.apuesta_fondo_url}')` : 'none',
    });
  };

  const pintarApuesta = () => { apuestaEl.textContent = escenario.apuesta.toLocaleString('es-PY'); };

  const pintarFichas = () => {
    if (fichasRicas.length) {
      fichasEl.style.gap = '14px';
      fichasEl.innerHTML = fichasRicas.map((f, i) => {
        const marcada = Math.round(f.valor) === Math.round(escenario.apuesta);
        const fondo = f.imagen_url
          ? `center/cover no-repeat url('${escapeHtml(f.imagen_url)}')`
          : 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))';
        return `
          <button data-f="${f.valor}" data-i="${i}" title="${Number(f.valor).toLocaleString('es-PY')}" style="
            position:relative; padding:0; border:0; border-radius:50%; flex-shrink:0;
            width:${f.tam}px; height:${f.tam}px; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            background:radial-gradient(circle at 32% 28%, #2b3140, #171a22);
            box-shadow:${marcada
              ? '0 0 0 2px var(--accent), 0 0 22px -2px var(--accent), 0 6px 16px -6px rgba(0,0,0,.6)'
              : '0 6px 16px -6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08)'};
            filter:${marcada ? 'brightness(1.2) saturate(1.08)' : 'none'};
            transform:${marcada ? 'scale(1.09)' : 'none'};
            transition:box-shadow .14s, transform .12s, filter .14s;">
            <span style="width:${f.imgTam}%; height:${f.imgTam}%; border-radius:50%; background:${fondo};
              box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);
              display:flex; align-items:center; justify-content:center;
              font-family:var(--mono, monospace); font-weight:700; color:#fff;
              font-size:${Math.max(9, f.tam * f.imgTam / 100 * 0.34)}px;">
              ${f.imagen_url ? '' : escapeHtml(fichaCorto(f.valor))}
            </span>
            <span style="position:absolute; bottom:-14px; left:50%; transform:translateX(-50%);
              font-family:var(--mono, monospace); font-size:10px; font-weight:600;
              color:${marcada ? 'var(--accent)' : 'var(--text-dim, #8a93a1)'};
              background:rgba(0,0,0,.55); padding:1px 6px; border-radius:5px; white-space:nowrap;">
              ${Number(f.valor).toLocaleString('es-PY')}
            </span>
          </button>`;
      }).join('');
    } else {
      fichasEl.style.gap = '4px';
      fichasEl.innerHTML = escenario.fichas.map((f) => `
        <button data-f="${f}" style="padding:3px 9px; font-size:11px; ${f === escenario.apuesta ? 'border-color:var(--accent); color:var(--accent)' : ''}">${Number(f).toLocaleString('es-PY')}</button>
      `).join('');
    }
    fichasEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.addEventListener('click', () => {
        if (escenario.girando) return;
        escenario.apuesta = Math.max(apuestaMin, Math.min(apuestaMax, Number(b.dataset.f)));
        pintarApuesta();
        pintarFichas();
      });
    });
  };

  const posicionarTurbo = () => {
    const pts = posTurbo(planilla, { x: posGrupos.turbo_x, y: posGrupos.turbo_y }, {
      x1: botones.x1.tamano, x2: botones.x2.tamano, x3: botones.x3.tamano,
    });
    grupoTurboEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const p = pts[('x' + b.dataset.v) as 'x1' | 'x2' | 'x3'];
      if (!p) return;
      Object.assign(b.style, {
        position: 'absolute', left: p.x + '%', top: p.y + '%',
        transform: 'translate(-50%,-50%)', pointerEvents: 'auto',
      });
    });
  };

  const pintarTurbo = () => {
    grupoTurboEl.innerHTML = [1, 2, 3].map((v) => {
      const activo = v === escenario.velocidad;
      const conImg = !!botones['x' + v]?.imagen_url;
      // Con imagen, el activo se marca con la silueta (jg-on), no con
      // el borde de la caja. Sin imagen queda el recuadro de siempre.
      return `
        <button data-v="${v}" class="${activo ? 'jg-on' : ''}" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden; ${activo && !conImg ? 'border-color:var(--accent); color:var(--accent)' : ''}">
          <span class="jg-btn-texto" style="font-size:11px">x${v}</span>
          <img class="jg-btn-img jg-silueta" alt="" style="display:none; object-fit:contain" />
        </button>`;
    }).join('');
    grupoTurboEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      aplicarBoton(b, botones['x' + b.dataset.v]);
      b.addEventListener('click', () => { escenario.velocidad = Number(b.dataset.v); pintarTurbo(); });
    });
    posicionarTurbo();
    aplicarPlanilla();
  };

  const aplicarModo = () => {
    // Con fichas ricas se ignora modo_apuesta: mandan las fichas y se
    // esconden los −/+ (la apuesta se fija tocando una ficha).
    // Fichas ricas (fila o abanico): las pinta el overlay React (<Fichas>),
    // no este HTML, para poder ubicar cada una.
    // Se relee de `juego` porque el panel de ajuste puede cargar
    // fichas_cfg después de crear el escenario (pasar a abanico en 3×3).
    const ricas = fichasDe(juego);
    const conFichasRicas = ricas.length > 0;
    const soloFichas = ricas.length > 0
      && !!(juego.fichas_cfg && (juego.fichas_cfg as { sinCaja?: boolean }).sinCaja);
    const ver = planilla.visibles;
    const conFichas = ver.fichas && !conFichasRicas && (escenario.modoApuesta === 'fichas' || escenario.modoApuesta === 'mixto');
    const conMasMenos = !conFichasRicas
      && (escenario.modoApuesta === 'mas_menos' || escenario.modoApuesta === 'mixto');
    fichasEl.style.display = conFichas ? 'flex' : 'none';
    btnMenos.style.display = conMasMenos && ver.menos ? 'flex' : 'none';
    btnMas.style.display = conMasMenos && ver.mas ? 'flex' : 'none';
    grupoApuestaEl.style.display = soloFichas ? 'none' : '';
    if (conFichas) pintarFichas();
    aplicarPlanilla();
  };

  if (!sinControlesSlot) {
    btnMas.addEventListener('click', () => {
      if (escenario.girando) return;
      escenario.apuesta = Math.min(apuestaMax, escenario.apuesta + pasoApuesta);
      pintarApuesta();
      if (fichasEl.style.display !== 'none') pintarFichas();
    });
    btnMenos.addEventListener('click', () => {
      if (escenario.girando) return;
      escenario.apuesta = Math.max(apuestaMin, escenario.apuesta - pasoApuesta);
      pintarApuesta();
      if (fichasEl.style.display !== 'none') pintarFichas();
    });
  }

  // ---------------- Limpieza ----------------
  const alRedimensionar = () => escalar();
  window.addEventListener('resize', alRedimensionar);
  if (modo === 'jugar') window.addEventListener('orientationchange', alRedimensionar);
  const soltarFondo = engancharLoopVideo(ELEMENTO_CAPA.fondo_pantalla);

  const destruir = () => {
    window.removeEventListener('resize', alRedimensionar);
    window.removeEventListener('orientationchange', alRedimensionar);
    soltarFondo();
    pararLuces();
    cancelAnimationFrame(animContador);
    if (timerPremio) clearTimeout(timerPremio);
    detenerAnimacionesSimbolos();
    detenerAnimacionesJuego();
    Object.values(audios).forEach((a) => a?.pause());
    wrap.remove();
  };

  const escenario: Escenario = {
    modo, el, wrap, motor,
    cintas, grillaEl, grillaFondoEl, efectoPremio, animRiveEl, cadenasLuzEl, capasLibresEl,
    btnGirar, saldoEl, apuestaEl,
    pos, ordenCapas, posPremio, posGirar, posGrupos, botones,
    fichas: fichasIniciales,
    mapaDigitos, audios,
    cadenasLuces: opts.cadenasLuces || [],
    capasLibres: opts.capasLibres || [],
    animaciones: animaciones || [],
    efectos: efectos || [],
    simbolos: opts.simbolos,

    apuesta: fichasRicas.length ? Math.round(fichasRicas[0].valor) : apuestaMin,
    apuestaMin, apuestaMax, pasoApuesta,
    saldo: 10000,
    velocidad: 1,
    girando: false,
    modoApuesta: juego.modo_apuesta as string || 'mixto',
    mostrarNombre: (juego.mostrar_nombre ?? true) as boolean,
    contadorMs: (juego.contador_ms ?? 900) as number,

    escalar, aplicarPosiciones, aplicarOrden, aplicarFiltros, aplicarCapasLibres,
    aplicarGirar, aplicarGrupos, aplicarModo, aplicarBotonesApuesta, pintarTurbo, pintarFichas, pintarApuesta,
    rectMarco, reconstruirCadena, desactivarArrastreLuces,
    aplicarPosicionPremio, mostrarPremio, ocultarPremio, lanzarAnimaciones, setMontoDemo, setMostrarNombre,
    bordeLuz: bordeInicial,
    planilla,
    setVisible(clave, on) {
      this.planilla.visibles[clave] = on;
      juego.planilla = planillaJson(this.planilla);
      aplicarModo();
    },
    setAutoImagen(url) {
      this.planilla.autoImagen = url;
      juego.planilla = planillaJson(this.planilla);
    },
    setAutoPos(x, y) {
      this.planilla.autoX = Math.round(Math.max(0, Math.min(100, x)));
      this.planilla.autoY = Math.round(Math.max(0, Math.min(100, y)));
      juego.planilla = planillaJson(this.planilla);
    },
    setAutoTam(tam) {
      this.planilla.autoTam = Math.round(Math.max(28, Math.min(220, tam)));
      juego.planilla = planillaJson(this.planilla);
    },
    setTurboPos(clave, x, y) {
      this.planilla.turboPos[clave] = {
        x: Math.round(Math.max(0, Math.min(100, x))),
        y: Math.round(Math.max(0, Math.min(100, y))),
      };
      juego.planilla = planillaJson(this.planilla);
      posicionarTurbo();
    },
    setBordeLuz(color: string | null) {
      const ok = hexColor(color);
      this.bordeLuz = ok;
      juego.borde_luz = ok;
      if (ok) el.style.setProperty('--jg-borde', ok);
      else el.style.removeProperty('--jg-borde');
    },
    destruir,
  };

  // ---------------- Arranque ----------------
  escalar();
  aplicarPosiciones();
  aplicarOrden();
  aplicarFiltros();
  aplicarCapasLibres();
  if (!sinControlesSlot) {
    aplicarPosicionPremio('dos_iguales');
    aplicarGirar();
    aplicarGrupos();
    aplicarBotonesApuesta();
    pintarTurbo();
    pintarApuesta();
    aplicarModo();
  }

  return escenario;
}
