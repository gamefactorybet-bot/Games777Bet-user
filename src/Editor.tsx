import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { supabase } from './supabase.ts';
import { analizar, analizarRuleta } from './motor.ts';
import { cargarMotor, MOTORES_DISPONIBLES } from '../motor/registro.js';
import { PALETA_RULETA } from './juego/ruleta.ts';
import { subirArchivo } from './juego/subir.ts';
import {
  rtpDe, escalarPagos, factorParaObjetivo, aplicarPerfil,
  perfilDesdeSimbolos, sugerirCompensacion,
} from './juego/calibracion.ts';
import type { Sugerencia } from './juego/calibracion.ts';
import { montarLottieEn } from './lottie.ts';
import { listarClientesActivos } from './Clientes.tsx';
import { Preview } from './Preview.tsx';
import { PreviewMines } from './PreviewMines.tsx';
import { PreviewRuleta } from './PreviewRuleta.tsx';
import { PreviewRuletaBotones } from './PreviewRuletaBotones.tsx';
import { PreviewCrash } from './PreviewCrash.tsx';
import { PreviewPlinko } from './PreviewPlinko.tsx';
import { simularMines } from '../motor/mines-clasico.js';
import {
  cfgDe as cfgBotonesDe, rtpPromedio as rtpBotonesPromedio, totalTajadas as totalTajadasBotones,
  rtpNumero as rtpNumeroB, factorSorpresa as factorSorpresaB, sorpresaEsperada as sorpresaEsperadaB,
} from './juego/ruleta-botones.ts';
import { TEMAS as TEMAS_RULETA } from './juego/ruleta-temas.ts';
import { cfgDe as cfgCrashDe, rtpTeorico as rtpTeoricoCrash } from './juego/crash.ts';
import {
  cfgDe as cfgPlinkoDe, rtpPromedio as rtpPlinkoPromedio,
  tablaMultiplicadores as tablaMultPlinko, probsCubetas as probsPlinko,
} from './juego/plinko.ts';
import { TEMAS as TEMAS_CRASH } from './juego/crash-temas.ts';
import { TEMAS as TEMAS_PLINKO } from './juego/plinko-temas.ts';
import { TEMAS as TEMAS_RASPA } from './juego/raspadita-temas.ts';
import {
  cfgDe as cfgRaspaDe, metricasRTP as metricasRaspa, rtpPromedio as rtpRaspaPromedio,
} from './juego/raspadita.ts';
import { PreviewRaspadita } from './PreviewRaspadita.tsx';
import type { CrashCfg, PlinkoCfg, RaspaCfg, SimboloRaspa } from './types.ts';
import type {
  ClienteActivo, Efecto, EstadoJuego, Juego, PerfilRtp, RotacionRtp, RotacionEstado,
  RotacionHistorialFila, RuletaBotonesCfg, Simbolo, Sonido,
} from './types.ts';

const COLORES = ['#f87171', '#fbbf24', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#94a3b8'];

const SONIDOS = [
  { tipo: 'musica_fondo', etiqueta: 'Música de fondo' },
  { tipo: 'giro', etiqueta: 'Sonido de giro' },
  { tipo: 'premio_chico', etiqueta: 'Premio chico' },
  { tipo: 'premio_grande', etiqueta: 'Premio grande' },
] as const;

const NIVELES = [
  { valor: 'dos_iguales', etiqueta: 'Dos iguales' },
  { valor: 'tres_iguales', etiqueta: 'Tres iguales' },
  { valor: 'premio_mayor', etiqueta: 'Premio mayor' },
];

const DIGITOS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'];

const GRUPOS = [
  { id: 'general', etiqueta: 'General' },
  { id: 'arte', etiqueta: 'Arte' },
  { id: 'jugabilidad', etiqueta: 'Jugabilidad' },
  { id: 'sonido', etiqueta: 'Sonido' },
  { id: 'efectos', etiqueta: 'Efectos' },
] as const;
type GrupoId = (typeof GRUPOS)[number]['id'];

const ETIQUETA_ESTADO: Record<EstadoJuego, string> = { borrador: 'Borrador', en_prueba: 'En prueba', listo: 'Listo' };

interface DigitoFila { caracter: string; imagen_url?: string | null }

interface EditorProps {
  juego: Juego;
  onCambio: () => void;
}

export function Editor({ juego: juegoProp, onCambio }: EditorProps) {
  const [juego, setJuego] = useState<Juego>(juegoProp);
  useEffect(() => { setJuego(juegoProp); }, [juegoProp]);

  const [simbolos, setSimbolos] = useState<Simbolo[]>([]);
  const [efectos, setEfectos] = useState<Efecto[]>([]);
  const [sonidos, setSonidos] = useState<Sonido[]>([]);
  const [digitos, setDigitos] = useState<DigitoFila[]>([]);
  const [grupo, setGrupo] = useState<GrupoId>('jugabilidad');
  const [columnasMotor, setColumnasMotor] = useState(3);
  const esMines = juego.motor.startsWith('mines');
  const esRuleta = juego.motor === 'ruleta';
  const esRuletaBotones = juego.motor === 'ruleta-botones';
  const esCrash = juego.motor.startsWith('crash');
  const esPlinko = juego.motor.startsWith('plinko');
  const esRaspadita = juego.motor.startsWith('raspadita');
  const sinSimbolos = esMines || esRuletaBotones || esCrash || esPlinko || esRaspadita;
  const [riveExpandido, setRiveExpandido] = useState<Set<number>>(new Set());

  const [previewAbierto, setPreviewAbierto] = useState(false);

  // "Guardado hace Xs": un solo reloj para todo el editor. Se marca
  // desde cualquier punto que realmente escriba en la base.
  const ultimoGuardado = useRef<number | null>(null);
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const marcarGuardado = () => { ultimoGuardado.current = Date.now(); tick(); };
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const cargarSimbolos = useCallback(async () => {
    const { data } = await supabase.from('simbolos').select('*').eq('juego_id', juego.id).order('orden');
    setSimbolos((data as Simbolo[]) || []);
  }, [juego.id]);

  const cargarSonidos = useCallback(async () => {
    const { data } = await supabase.from('sonidos').select('*').eq('juego_id', juego.id);
    setSonidos((data as Sonido[]) || []);
  }, [juego.id]);

  const cargarDigitos = useCallback(async () => {
    const { data } = await supabase.from('digitos').select('*').eq('juego_id', juego.id);
    setDigitos((data as DigitoFila[]) || []);
  }, [juego.id]);

  const cargarEfectos = useCallback(async () => {
    const { data } = await supabase.from('efectos').select('*').eq('juego_id', juego.id).order('created_at');
    setEfectos((data as Efecto[]) || []);
  }, [juego.id]);

  useEffect(() => {
    setRiveExpandido(new Set());
    cargarSimbolos();
    cargarSonidos();
    cargarDigitos();
    cargarEfectos();
  }, [cargarSimbolos, cargarSonidos, cargarDigitos, cargarEfectos]);

  // El motor de este juego se elige una sola vez, al crearlo. Se carga
  // acá para saber cuántos rodillos usar en el RTP y el simulador.
  // Mines no es de rodillos, no hace falta.
  useEffect(() => {
    if (esMines || esRuleta || esRuletaBotones || esCrash || esPlinko || esRaspadita) return;
    let vivo = true;
    cargarMotor(juego.motor).then((mod) => { if (vivo) setColumnasMotor(mod.COLUMNAS || 3); });
    return () => { vivo = false; };
  }, [juego.motor, esMines, esRuleta, esRuletaBotones, esCrash, esPlinko, esRaspadita]);

  // ---------------- Símbolos ----------------
  const setSimbolo = (i: number, patch: Partial<Simbolo>) => {
    setSimbolos((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };

  const guardarSimbolo = async (s: Simbolo) => {
    if (s.id) {
      await supabase.from('simbolos').update({
        nombre: s.nombre, peso: s.peso, pago_tres: s.pago_tres, pago_dos: s.pago_dos, icono_url: s.icono_url,
        pago_cuatro: s.pago_cuatro, pago_cinco: s.pago_cinco,
        lottie_chico_url: s.lottie_chico_url, lottie_grande_url: s.lottie_grande_url,
      }).eq('id', s.id);
    } else {
      const { data } = await supabase.from('simbolos').insert({
        juego_id: juego.id, nombre: s.nombre, peso: s.peso, pago_tres: s.pago_tres, pago_dos: s.pago_dos, orden: simbolos.length,
      }).select().single();
      if (data) s.id = (data as Simbolo).id;
    }
    marcarGuardado();
  };

  const agregarSimbolo = async () => {
    const nuevo: Simbolo = {
      id: '', juego_id: juego.id, nombre: 'nuevo', peso: 5, pago_tres: 10, pago_dos: 1, orden: simbolos.length,
      ...(columnasMotor >= 4 ? { pago_cuatro: 25 } : {}),
      ...(columnasMotor >= 5 ? { pago_cinco: 60 } : {}),
    };
    await guardarSimbolo(nuevo);
    setSimbolos((prev) => [...prev, nuevo]);
  };

  const borrarSimbolo = async (i: number) => {
    const s = simbolos[i];
    if (s.id) await supabase.from('simbolos').delete().eq('id', s.id);
    cargarSimbolos();
  };

  const subirIcono = async (i: number, archivo: File) => {
    const url = await subirArchivo(archivo, `iconos/${juego.id}`);
    if (!url) return;
    const s = { ...simbolos[i], icono_url: url };
    setSimbolo(i, { icono_url: url });
    await guardarSimbolo(s);
  };

  const subirLottie = async (i: number, campo: 'lottie_chico_url' | 'lottie_grande_url', archivo: File) => {
    const url = await subirArchivo(archivo, `lottie/${juego.id}`);
    if (!url) return;
    const s = { ...simbolos[i], [campo]: url };
    setSimbolo(i, { [campo]: url });
    await guardarSimbolo(s);
  };

  const quitarLottie = async (i: number, campo: 'lottie_chico_url' | 'lottie_grande_url') => {
    const s = { ...simbolos[i], [campo]: null };
    setSimbolo(i, { [campo]: null });
    await guardarSimbolo(s);
  };

  const toggleRive = (i: number) => {
    setRiveExpandido((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  // ---------------- RTP ----------------
  const analisisTiles = analizar(
    simbolos.length ? simbolos : [{ nombre: '-', peso: 1, pago_tres: 0, pago_dos: 0 } as unknown as Simbolo],
  );
  const rtpBotones = esRuletaBotones ? rtpBotonesPromedio(juego.ruleta_botones_cfg || {}) : 0;
  const rtpCrash = esCrash ? rtpTeoricoCrash(juego.crash_cfg || {}) * 100 : 0;
  const rtpPlinko = esPlinko ? rtpPlinkoPromedio(juego.plinko_cfg || {}) * 100 : 0;
  const rtpRaspa = esRaspadita ? rtpRaspaPromedio(juego.raspa_cfg || {}) * 100 : 0;
  const rtpReal = esRuletaBotones
    ? rtpBotones
    : !simbolos.length
      ? 0
      : esRuleta
        ? analizarRuleta(simbolos).rtp
        : esMines ? 0 : analizar(simbolos, columnasMotor).rtp;

  const margenMinesOk = (() => {
    const m = Number(juego.mines_margen_pct ?? 0.03);
    return m >= 0 && m < 1;
  })();

  const puntos: Record<GrupoId, boolean> = {
    general: Number(juego.min_bet) <= 0 || Number(juego.max_bet) < Number(juego.min_bet),
    arte: !juego.portada_url,
    jugabilidad: esMines
      ? !margenMinesOk
      : esCrash
        ? (rtpCrash <= 0 || rtpCrash > 100)
      : esPlinko
        ? (rtpPlinko <= 0 || rtpPlinko > 100)
      : esRaspadita
        ? (rtpRaspa <= 0 || rtpRaspa > 100)
        : esRuletaBotones
          ? (totalTajadasBotones(cfgBotonesDe(juego).numeros) < 2 || rtpBotones > 100)
          : esRuleta
            ? (!simbolos.length || rtpReal > 100)
            : (!simbolos.length || simbolos.some((s) => !s.icono_url) || rtpReal > 100),
    sonido: !sonidos.length,
    efectos: false,
  };

  // ---------------- Datos generales ----------------
  const [nombre, setNombre] = useState(juego.nombre);
  const [desc, setDesc] = useState(juego.descripcion || '');
  const [minBet, setMinBet] = useState(String(juego.min_bet));
  const [maxBet, setMaxBet] = useState(String(juego.max_bet));
  useEffect(() => {
    setNombre(juegoProp.nombre);
    setDesc(juegoProp.descripcion || '');
    setMinBet(String(juegoProp.min_bet));
    setMaxBet(String(juegoProp.max_bet));
  }, [juegoProp]);

  const guardarDetalles = async () => {
    const n = nombre.trim();
    if (!n) return;
    await supabase.from('juegos').update({
      nombre: n,
      descripcion: desc.trim() || null,
      min_bet: Number(minBet) || 0,
      max_bet: Number(maxBet) || 0,
    }).eq('id', juego.id);
    setJuego((j) => ({ ...j, nombre: n, descripcion: desc.trim() || null, min_bet: Number(minBet) || 0, max_bet: Number(maxBet) || 0 }));
    onCambio();
  };

  const cambiarEstado = async (estado: EstadoJuego) => {
    await supabase.from('juegos').update({ estado }).eq('id', juego.id);
    setJuego((j) => ({ ...j, estado }));
    onCambio();
  };

  // Imágenes: al subir/quitar se escribe en la base y se refleja local.
  const setImagen = async (campo: string, url: string | null, camposReset?: Record<string, number>) => {
    const patch = { [campo]: url, ...(url === null ? camposReset : {}) };
    await supabase.from('juegos').update(patch).eq('id', juego.id);
    setJuego((j) => ({ ...j, ...patch }));
    marcarGuardado();
  };

  const guardarCampoJuego = async (campo: string, valor: unknown) => {
    await supabase.from('juegos').update({ [campo]: valor }).eq('id', juego.id);
    setJuego((j) => ({ ...j, [campo]: valor }));
    marcarGuardado();
  };

  const guardarCamposJuego = async (patch: Record<string, unknown>) => {
    await supabase.from('juegos').update(patch).eq('id', juego.id);
    setJuego((j) => ({ ...j, ...patch }));
    marcarGuardado();
  };

  // ---------------- Sonidos / dígitos ----------------
  const subirSonido = async (tipo: string, archivo: File) => {
    const url = await subirArchivo(archivo, `sonidos/${juego.id}`);
    if (!url) return;
    await supabase.from('sonidos').upsert({ juego_id: juego.id, tipo, archivo_url: url }, { onConflict: 'juego_id,tipo' });
    marcarGuardado();
    cargarSonidos();
  };

  const subirDigito = async (caracter: string, archivo: File) => {
    const url = await subirArchivo(archivo, `digitos/${juego.id}`);
    if (!url) return;
    await supabase.from('digitos').upsert({ juego_id: juego.id, caracter, imagen_url: url }, { onConflict: 'juego_id,caracter' });
    marcarGuardado();
    cargarDigitos();
  };

  // ---------------- Efectos ----------------
  const cambiarEfecto = async (i: number, campo: keyof Efecto, valor: string) => {
    setEfectos((prev) => prev.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)));
    await supabase.from('efectos').update({ [campo]: valor }).eq('id', efectos[i].id);
    marcarGuardado();
  };

  const nuevoEfecto = async () => {
    await supabase.from('efectos').insert({
      juego_id: juego.id, nombre: 'Efecto nuevo', tipo: 'carcasa',
      css: '@keyframes brillo {\n  0%,100% { opacity:.3; }\n  50% { opacity:1; }\n}\n.efecto { animation: brillo 2.6s ease-in-out infinite; }',
    });
    cargarEfectos();
  };

  const borrarEfecto = async (i: number) => {
    await supabase.from('efectos').delete().eq('id', efectos[i].id);
    cargarEfectos();
  };

  // ---------------- Simulador ----------------
  const [simOut, setSimOut] = useState('');
  const [simulando, setSimulando] = useState(false);
  const simular = async () => {
    if (!simbolos.length) { setSimOut('Cargá símbolos primero.'); return; }
    setSimulando(true);
    setSimOut('Simulando...');
    await new Promise((r) => setTimeout(r, 30));

    const { girar } = await cargarMotor(juego.motor);
    const GIROS = 1_000_000;
    let apostado = 0, devuelto = 0, ganadas = 0, mayor = 0;
    const porNivel: Record<string, number> = { dos_iguales: 0, tres_iguales: 0, premio_mayor: 0 };

    for (let i = 0; i < GIROS; i++) {
      const r = girar(simbolos);
      apostado += 1;
      if (r.premio > 0) {
        devuelto += r.premio;
        ganadas++;
        if (r.premio > mayor) mayor = r.premio;
        if (r.nivel) porNivel[r.nivel]++;
      }
    }

    const rtpS = (devuelto / apostado) * 100;
    const { rtp: rtpTeorico } = analizar(simbolos, columnasMotor);
    const desvio = Math.abs(rtpS - rtpTeorico);
    const color = desvio > 1.5 ? 'var(--danger)' : 'var(--text-dim)';
    setSimOut(
      `<span style="color:${color}">RTP simulado <strong>${rtpS.toFixed(2)}%</strong> · teórico ${rtpTeorico.toFixed(2)}% · desvío ${desvio.toFixed(2)}%</span><br />`
      + `Ganó ${(ganadas / GIROS * 100).toFixed(1)}% de los giros · premio más alto ${mayor}x · `
      + `dos iguales ${porNivel.dos_iguales.toLocaleString('es-PY')} · `
      + `tres iguales ${porNivel.tres_iguales.toLocaleString('es-PY')} · `
      + `mayor ${porNivel.premio_mayor.toLocaleString('es-PY')}`
      + (desvio > 1.5 ? '<br /><strong style="color:var(--danger)">Revisar: el motor no está pagando lo que dice la tabla.</strong>' : ''),
    );
    setSimulando(false);
  };

  // ---------------- Historial ----------------
  const [historial, setHistorial] = useState<string>('Cargando...');
  const cargarHistorial = useCallback(async () => {
    setHistorial('Cargando...');
    const { data, error } = await supabase.rpc('resumen_juego', { p_juego_id: juego.id });
    if (error) { setHistorial(`__ERROR__${error.message}`); return; }
    const r = (data || [])[0];
    if (!r || !Number(r.rondas)) { setHistorial('__VACIO__'); return; }

    const rondas = Number(r.rondas);
    const rtpRealHist = r.rtp_real === null ? null : Number(r.rtp_real);
    const { rtp: rtpTeorico } = simbolos.length ? analizar(simbolos, columnasMotor) : { rtp: null as number | null };
    const desvio = (rtpRealHist !== null && rtpTeorico !== null) ? Math.abs(rtpRealHist - rtpTeorico) : null;
    const confiable = rondas >= 500;
    const alerta = confiable && desvio !== null && desvio > 3;

    const dato = (etiqueta: string, valor: string, color?: string) => `
      <div style="background:var(--surface-alt); border-radius:8px; padding:8px 10px">
        <p class="hint" style="margin:0 0 2px">${etiqueta}</p>
        <p style="margin:0; font-size:14px; ${color ? `color:${color}` : ''}">${valor}</p>
      </div>`;

    setHistorial(`
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-bottom:8px">
        ${dato('Rondas', rondas.toLocaleString('es-PY'))}
        ${dato('Apostado', Number(r.apostado).toLocaleString('es-PY'))}
        ${dato('Pagado', Number(r.pagado).toLocaleString('es-PY'))}
        ${dato('RTP real', rtpRealHist === null ? '—' : rtpRealHist.toFixed(2) + '%', alerta ? 'var(--danger)' : '')}
        ${dato('RTP teórico', rtpTeorico === null ? '—' : rtpTeorico.toFixed(2) + '%')}
        ${dato('Ganó', (Number(r.ganadas) / rondas * 100).toFixed(1) + '% de los giros')}
        ${dato('Premio más alto', Number(r.premio_mayor).toLocaleString('es-PY'))}
      </div>
      ${!confiable
        ? `<p class="hint" style="margin:0">Con ${rondas.toLocaleString('es-PY')} rondas el RTP real todavía no dice nada: hacen falta varios cientos para que empiece a acercarse al teórico.</p>`
        : alerta
          ? `<p class="hint error" style="margin:0">El RTP real se aleja ${desvio!.toFixed(2)} puntos del teórico con ${rondas.toLocaleString('es-PY')} rondas. Vale la pena revisar el motor y la tabla de pagos.</p>`
          : `<p class="hint" style="margin:0">Dentro de lo esperado para ${rondas.toLocaleString('es-PY')} rondas.</p>`}
    `);
  }, [juego.id, simbolos, columnasMotor]);
  useEffect(() => { cargarHistorial(); /* eslint-disable-next-line */ }, [juego.id]);

  // ---------------- Publicar ----------------
  const revisarAntesDePublicar = () => {
    const errores: string[] = [];
    const avisos: string[] = [];

    if (esMines) {
      if (!margenMinesOk) errores.push('El margen de la casa tiene que estar entre 0% y 100%.');
    } else if (esRuleta) {
      if (!simbolos.length) errores.push('La ruleta no tiene multiplicadores cargados.');
      const totalTaj = simbolos.reduce((a, s) => a + Math.max(0, Math.round(Number(s.peso) || 0)), 0);
      if (simbolos.length && totalTaj < 2) errores.push('La rueda necesita al menos 2 tajadas en total (columna "Tajadas").');
      if (simbolos.length) {
        const { rtp } = analizarRuleta(simbolos);
        if (rtp > 100) errores.push(`El RTP es ${rtp.toFixed(2)}% — la rueda pierde plata en cada giro.`);
        else if (rtp < 80 || rtp > 98) avisos.push(`RTP de ${rtp.toFixed(2)}%, fuera del rango habitual (80-98%).`);
      }
    } else if (esRuletaBotones) {
      const c = cfgBotonesDe(juego);
      if (totalTajadasBotones(c.numeros) < 2) errores.push('La rueda necesita al menos 2 tajadas en total.');
      if (rtpBotones > 100) errores.push(`El RTP promedio es ${rtpBotones.toFixed(1)}% — la casa pierde. Bajá la frecuencia o los pesos altos de la sorpresa.`);
      const numeroCaro = c.numeros.some((_n, i) => {
        const total = totalTajadasBotones(c.numeros) || 1;
        return (Math.max(0, Math.round(c.numeros[i].cant)) / total) * c.numeros[i].mult > 1;
      });
      if (numeroCaro) avisos.push('Algún número tiene RTP base > 100% (paga más de lo que recauda).');
      if (!c.sorpresa.tope) avisos.push('Sin tope de premio por jugada: un ×300 sobre una apuesta grande es un pago enorme de golpe.');
    } else if (esCrash) {
      if (rtpCrash > 100) errores.push(`El RTP es ${rtpCrash.toFixed(1)}% — la casa pierde plata en cada ronda.`);
      else if (rtpCrash < 85 || rtpCrash > 99) avisos.push(`RTP de ${rtpCrash.toFixed(1)}%, fuera del rango habitual (85-99%).`);
    } else if (esPlinko) {
      if (rtpPlinko > 100) errores.push(`El RTP promedio es ${rtpPlinko.toFixed(1)}% — la casa pierde plata.`);
      else if (rtpPlinko < 85 || rtpPlinko > 99) avisos.push(`RTP promedio de ${rtpPlinko.toFixed(1)}%, fuera del rango habitual (85-99%).`);
    } else if (esRaspadita) {
      const rc = cfgRaspaDe(juego);
      const conPremio = rc.simbolos.filter((s) => !s.wild && s.tiers.length).length;
      if (!conPremio) errores.push('Ningún símbolo tiene premio configurado.');
      if (rc.simbolos.filter((s) => !s.wild && !s.tiers.length).length === 0)
        avisos.push('No hay ningún símbolo de relleno (sin premio) — con grillas grandes puede costar armar tarjetas sin premio de más.');
      if (rtpRaspa > 100) errores.push(`El RTP es ${rtpRaspa.toFixed(1)}% — la casa pierde plata en cada tarjeta.`);
      else if (rtpRaspa < 85 || rtpRaspa > 99) avisos.push(`RTP de ${rtpRaspa.toFixed(1)}%, fuera del rango habitual (85-99%).`);
    } else {
      if (!simbolos.length) errores.push('No tiene símbolos cargados.');
      const sinIcono = simbolos.filter((s) => !s.icono_url);
      if (sinIcono.length) errores.push(`${sinIcono.length} símbolo(s) sin ícono: ${sinIcono.map((s) => s.nombre).join(', ')}.`);
      if (simbolos.length) {
        const { rtp } = analizar(simbolos, columnasMotor);
        if (rtp > 100) errores.push(`El RTP es ${rtp.toFixed(2)}% — el juego pierde plata en cada giro.`);
        else if (rtp < 85 || rtp > 97) avisos.push(`RTP de ${rtp.toFixed(2)}%, fuera del rango habitual (85-97%).`);
      }
    }

    if (Number(juego.min_bet) <= 0) errores.push('La apuesta mínima tiene que ser mayor a cero.');
    if (Number(juego.max_bet) < Number(juego.min_bet)) errores.push('La apuesta máxima es menor que la mínima.');
    if (!juego.portada_url) avisos.push('Sin portada: en el catálogo de Win777 va a salir en blanco.');
    if (!esMines && !esCrash && !esPlinko && !esRaspadita && !sonidos.length) avisos.push('Sin sonidos cargados.');
    const x = Number(juego.girar_x ?? 50), y = Number(juego.girar_y ?? 90);
    if (!esMines && !esCrash && !esPlinko && !esRaspadita && (x < 0 || x > 100 || y < 0 || y > 100)) avisos.push('El botón de girar quedó fuera de la pantalla.');
    return { errores, avisos };
  };

  const publicar = async () => {
    if (!juego.publicado) {
      if (juego.estado !== 'listo') { alert('Marcá el juego como Listo antes de publicarlo.'); return; }
      const { errores, avisos } = revisarAntesDePublicar();

      // Lo que cobra el jugador sale del perfil activo, no del borrador.
      const { data: perfilActivo } = await supabase
        .from('perfiles_rtp').select('nombre, pagos')
        .eq('juego_id', juego.id).eq('activo', true).maybeSingle();
      if (perfilActivo?.pagos && simbolos.length) {
        const rtpP = rtpDe(aplicarPerfil(simbolos, perfilActivo.pagos), columnasMotor);
        if (rtpP > 100) errores.push(`El perfil activo "${perfilActivo.nombre}" tiene RTP ${rtpP.toFixed(2)}% — el juego pierde plata en cada giro.`);
        else if (rtpP < 85 || rtpP > 97) avisos.push(`El perfil activo "${perfilActivo.nombre}" tiene RTP ${rtpP.toFixed(2)}%, fuera del rango habitual (85-97%).`);
      }

      if (errores.length) { alert('No se puede publicar todavía:\n\n' + errores.map((e) => '· ' + e).join('\n')); return; }
      if (avisos.length) {
        const seguir = confirm('Se puede publicar, pero revisá esto:\n\n' + avisos.map((a) => '· ' + a).join('\n') + '\n\n¿Publicar igual?');
        if (!seguir) return;
      }
      const version = (juego.version || 1) + 1;
      await supabase.from('juegos').update({ publicado: true, version }).eq('id', juego.id);
      setJuego((j) => ({ ...j, publicado: true, version }));
    } else {
      await supabase.from('juegos').update({ publicado: false }).eq('id', juego.id);
      setJuego((j) => ({ ...j, publicado: false }));
    }
    onCambio();
  };

  // ---------------- Clientes ----------------
  const [clientes, setClientes] = useState<ClienteActivo[]>([]);
  const [conectados, setConectados] = useState<Set<string>>(new Set());
  const cargarClientes = useCallback(async () => {
    const [lista, { data: conexiones }] = await Promise.all([
      listarClientesActivos(),
      supabase.from('juego_clientes').select('cliente_id').eq('juego_id', juego.id),
    ]);
    setClientes(lista);
    setConectados(new Set((conexiones || []).map((c) => (c as { cliente_id: string }).cliente_id)));
  }, [juego.id]);
  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  const alternarCliente = async (clienteId: string, activar: boolean) => {
    if (activar) await supabase.from('juego_clientes').insert({ juego_id: juego.id, cliente_id: clienteId });
    else await supabase.from('juego_clientes').delete().eq('juego_id', juego.id).eq('cliente_id', clienteId);
    setConectados((prev) => {
      const n = new Set(prev);
      activar ? n.add(clienteId) : n.delete(clienteId);
      return n;
    });
    marcarGuardado();
  };

  // ---------------- Render ----------------
  const guardadoTxt = (() => {
    if (!ultimoGuardado.current) return '';
    const seg = Math.round((Date.now() - ultimoGuardado.current) / 1000);
    return seg < 2 ? 'Guardado ✓' : `Guardado hace ${seg}s`;
  })();

  const motorEtiqueta = MOTORES_DISPONIBLES.find((m) => m.valor === juego.motor)?.etiqueta || juego.motor || 'motor desconocido';

  return (
    <>
      <div className="ed-header-fijo">
        <div
          className="ed-header-thumb"
          style={juego.portada_url ? { backgroundImage: `url('${juego.portada_url}')` } : undefined}
        >
          {!juego.portada_url && '🎰'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{juego.nombre}</p>
          <p className="hint" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${juego.estado}`}>{ETIQUETA_ESTADO[juego.estado]}</span>
            <span className="ed-resumen-chip">{motorEtiqueta}</span>
            <span>{guardadoTxt}</span>
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ed-resumen-fila" style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <span className="ed-resumen-chip">RTP {esMines ? '--' : esCrash ? rtpCrash.toFixed(1) + '%' : esPlinko ? rtpPlinko.toFixed(1) + '%' : esRaspadita ? rtpRaspa.toFixed(1) + '%' : esRuletaBotones ? rtpBotones.toFixed(1) + '%' : (simbolos.length ? rtpReal.toFixed(1) + '%' : '--')}</span>
          <span className="ed-resumen-chip">versión {juego.version || 1}</span>
          <span className="ed-resumen-chip">{juego.publicado ? 'publicado ✓' : 'sin publicar'}</span>
        </div>
      </div>

      <div className="grupo-nav" style={{ marginBottom: 16 }}>
        {GRUPOS.map((g) => (
          <button key={g.id} className={`grupo-btn ${g.id === grupo ? 'on' : ''}`} onClick={() => setGrupo(g.id)}>
            <span className={`grupo-punto ${puntos[g.id] ? 'alerta' : ''}`} />{g.etiqueta}
          </button>
        ))}
      </div>

      {grupo === 'general' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarDetalles} style={{ flex: 1, minWidth: 160, fontSize: 16, fontWeight: 600 }} />
              <select value={juego.estado} onChange={(e) => cambiarEstado(e.target.value as EstadoJuego)} style={{ width: 'auto' }}>
                <option value="borrador">Borrador</option>
                <option value="en_prueba">En prueba</option>
                <option value="listo">Listo</option>
              </select>
              <button onClick={publicar} style={{ whiteSpace: 'nowrap', ...(juego.publicado ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}) }}>
                {juego.publicado ? '✓ Publicado' : 'Publicar'}
              </button>
              <button className="primary" onClick={() => setPreviewAbierto(true)}>▶ Vista previa</button>
            </div>

            <label style={{ display: 'block', marginBottom: 10 }}>Descripción
              <input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={guardarDetalles} placeholder="Clásico de 3 rodillos con comodín" />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>Apuesta mínima<input type="number" value={minBet} onChange={(e) => setMinBet(e.target.value)} onBlur={guardarDetalles} /></label>
              <label>Apuesta máxima<input type="number" value={maxBet} onChange={(e) => setMaxBet(e.target.value)} onBlur={guardarDetalles} /></label>
            </div>
          </div>

          <div className="card">
            <strong style={{ fontSize: 15 }}>Conectado a</strong>
            <p className="hint" style={{ marginBottom: 14 }}>Qué casinos pueden servir este juego. Gestioná los clientes desde el botón "Clientes" de arriba.</p>
            {clientes.length === 0 && <p className="hint">Todavía no agregaste ningún cliente. Usá el botón "Clientes" de arriba.</p>}
            {clientes.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={conectados.has(c.id)} onChange={(e) => alternarCliente(c.id, e.target.checked)} style={{ width: 'auto' }} />
                {c.nombre}
              </label>
            ))}
          </div>
        </div>
      )}

      {grupo === 'arte' && (
        <div className="card fade-in">
          <strong style={{ fontSize: 15 }}>Imágenes</strong>
          <p className="hint" style={{ marginBottom: 14 }}>Subí acá. La posición y el tamaño se ajustan desde "⚙ Ajustar posición" en la Vista previa, viendo el resultado en vivo sobre el tamaño real del celular.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 14 }}>
            <SubirImagen juego={juego} campo="fondo_url" etiqueta={esMines ? 'Textura de la casilla' : (esRuleta || esRuletaBotones) ? 'Fondo detrás de la rueda' : esCrash ? 'Fondo del área de juego' : esPlinko ? 'Fondo del tablero' : esRaspadita ? 'Fondo del área de juego' : 'Fondo del rodillo'} onSet={setImagen} />
            <SubirImagen juego={juego} campo="fondo_pantalla_url" etiqueta="Fondo de pantalla" posicionable reset={{ fondo_pantalla_x: 50, fondo_pantalla_y: 50, fondo_pantalla_ancho: 100, fondo_pantalla_alto: 100 }} onSet={setImagen} />
            <SubirImagen juego={juego} campo="marco_url" etiqueta="Marco" posicionable reset={{ marco_x: 50, marco_y: 50, marco_ancho: 100, marco_alto: 100 }} onSet={setImagen} />
            <SubirImagen juego={juego} campo="cartel_url" etiqueta="Cartel" posicionable reset={{ cartel_x: 50, cartel_y: 15, cartel_ancho: 75, cartel_alto: 16 }} onSet={setImagen} />
            <SubirImagen juego={juego} campo="portada_url" etiqueta="Portada (catálogo)" onSet={setImagen} />
            <SubirImagen juego={juego} campo="carga_url" etiqueta="Pantalla de carga" onSet={setImagen} />
          </div>
        </div>
      )}

      {grupo === 'jugabilidad' && esMines && (
        <SeccionMines juego={juego} onCampo={guardarCampoJuego} onCampos={guardarCamposJuego} />
      )}

      {grupo === 'jugabilidad' && esRuleta && (
        <SeccionRuleta juego={juego} simbolos={simbolos} onRecargar={cargarSimbolos} />
      )}

      {grupo === 'jugabilidad' && esRuletaBotones && (
        <SeccionRuletaBotones juego={juego} onCampo={guardarCampoJuego} />
      )}

      {grupo === 'jugabilidad' && esCrash && (
        <SeccionCrash juego={juego} onCampo={guardarCampoJuego} />
      )}

      {grupo === 'jugabilidad' && esPlinko && (
        <SeccionPlinko juego={juego} onCampo={guardarCampoJuego} />
      )}

      {grupo === 'jugabilidad' && esRaspadita && (
        <SeccionRaspadita juego={juego} onCampo={guardarCampoJuego} />
      )}

      {grupo === 'jugabilidad' && !esMines && !esRuleta && !esRuletaBotones && !esCrash && !esPlinko && !esRaspadita && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              <Tile etiqueta="Retorno" valor={analisisTiles.rtp.toFixed(1) + '%'} />
              <Tile etiqueta="Volatilidad" valor={analisisTiles.volatilidad.toFixed(1)} />
              <Tile etiqueta="Premio mayor" valor={analisisTiles.premioMayor + 'x'} />
              <Tile etiqueta="Frecuencia" valor={analisisTiles.frecuencia ? '1 en ' + analisisTiles.frecuencia.toFixed(1) : '--'} />
            </div>
            <Aviso rtp={analisisTiles.rtp} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <button disabled={simulando} onClick={simular}>Simular 1.000.000 de giros</button>
              <p className="hint" style={{ margin: 0, flex: 1 }} dangerouslySetInnerHTML={{ __html: simOut }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <strong style={{ fontSize: 14, flex: 1 }}>Jugadas reales</strong>
                <button style={{ fontSize: 12 }} onClick={cargarHistorial}>Actualizar</button>
              </div>
              <Historial html={historial} />
            </div>
          </div>

          <div className="card">
            <strong style={{ fontSize: 15 }}>Símbolos</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {simbolos.length === 0 && <p className="hint">Todavía no agregaste símbolos.</p>}
              {simbolos.map((s, i) => (
                <FilaSimbolo
                  key={s.id || `nuevo-${i}`}
                  s={s} i={i} columnasMotor={columnasMotor} expandido={riveExpandido.has(i)}
                  onCampo={(campo, valor) => setSimbolo(i, { [campo]: campo === 'nombre' ? valor : (Number(valor) || 0) })}
                  onGuardar={() => guardarSimbolo(simbolos[i])}
                  onBorrar={() => borrarSimbolo(i)}
                  onIcono={(f) => subirIcono(i, f)}
                  onToggleRive={() => toggleRive(i)}
                  onLottie={(campo, f) => subirLottie(i, campo, f)}
                  onQuitarLottie={(campo) => quitarLottie(i, campo)}
                />
              ))}
            </div>
            <button style={{ marginTop: 10 }} onClick={agregarSimbolo}>+ Agregar símbolo</button>
          </div>

          <PerfilesYCalibrado
            juego={juego}
            simbolos={simbolos}
            columnasMotor={columnasMotor}
            onAplicarSimbolos={async (nuevos) => {
              setSimbolos(nuevos);
              for (const s of nuevos) await guardarSimbolo(s);
              marcarGuardado();
            }}
          />

          <PanelRotacion juego={juego} />
        </div>
      )}

      {grupo === 'sonido' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 15 }}>Sonidos</strong>
            <p className="hint" style={{ marginBottom: 14 }}>Archivos cortos (mp3 u ogg). La música arranca con el primer toque del jugador.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              {SONIDOS.map((s) => {
                const existe = sonidos.some((x) => x.tipo === s.tipo);
                return (
                  <label key={s.tipo} style={{ background: 'var(--surface-alt)', borderRadius: 10, padding: 12, textAlign: 'center', cursor: 'pointer', display: 'block' }}>
                    <div style={{ fontSize: 20 }}>{existe ? '🔊' : '🎵'}</div>
                    <p className="hint" style={{ margin: '6px 0 0', color: existe ? 'var(--accent)' : 'var(--text-dim)' }}>{s.etiqueta}</p>
                    {existe && <p className="hint" style={{ margin: '2px 0 0', fontSize: 10 }}>cargado ✓</p>}
                    <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && subirSonido(s.tipo, e.target.files[0])} />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="card">
            <strong style={{ fontSize: 15 }}>Dígitos del monto ganado</strong>
            <p className="hint" style={{ marginBottom: 14 }}>Opcional: subí un ícono por carácter (0-9 y el punto) para mostrar el monto ganado con tu propio estilo en vez de texto. Lo que no subas se sigue mostrando como texto normal.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(52px,1fr))', gap: 8, maxWidth: 440 }}>
              {DIGITOS.map((c) => {
                const fila = digitos.find((d) => d.caracter === c);
                return (
                  <label
                    key={c}
                    style={{
                      display: 'flex', aspectRatio: '1', borderRadius: 10, border: '1px dashed var(--border)',
                      background: fila?.imagen_url ? `center/contain no-repeat url('${fila.imagen_url}')` : 'var(--surface-alt)',
                      cursor: 'pointer', position: 'relative', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {!fila?.imagen_url && <span style={{ fontSize: 15, color: 'var(--text-dim)' }}>{c === '.' ? '·' : c}</span>}
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subirDigito(c, e.target.files[0])} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {grupo === 'efectos' && (
        <div className="card fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <strong style={{ fontSize: 15, flex: 1 }}>Efectos</strong>
            <button onClick={nuevoEfecto}>+ Nuevo efecto</button>
          </div>
          <p className="hint" style={{ marginBottom: 14 }}>Animaciones CSS. Las de carcasa se ven siempre; las de premio disparan al ganar.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {efectos.length === 0 && <p className="hint">Sin efectos todavía. Agregá uno y pegá el CSS de la animación.</p>}
            {efectos.map((ef, i) => (
              <div key={ef.id} style={{ background: 'var(--surface-alt)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input defaultValue={ef.nombre} placeholder="Nombre del efecto" onBlur={(e) => cambiarEfecto(i, 'nombre', e.target.value)} style={{ flex: 1, minWidth: 120 }} />
                  <select value={ef.tipo} onChange={(e) => cambiarEfecto(i, 'tipo', e.target.value)} style={{ width: 'auto' }}>
                    <option value="carcasa">Carcasa (siempre)</option>
                    <option value="premio">Premio (al ganar)</option>
                  </select>
                  <button onClick={() => borrarEfecto(i)}>✕</button>
                </div>
                {ef.tipo === 'premio' && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <select value={ef.nivel_premio || 'dos_iguales'} onChange={(e) => cambiarEfecto(i, 'nivel_premio', e.target.value)} style={{ width: 'auto' }}>
                      {NIVELES.map((n) => <option key={n.valor} value={n.valor}>{n.etiqueta}</option>)}
                    </select>
                    <select value={ef.posicion || 'linea'} onChange={(e) => cambiarEfecto(i, 'posicion', e.target.value)} style={{ width: 'auto' }}>
                      <option value="linea">Sobre la línea</option>
                      <option value="pantalla">Toda la pantalla</option>
                    </select>
                  </div>
                )}
                <textarea defaultValue={ef.css || ''} rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="@keyframes ... { }" onBlur={(e) => cambiarEfecto(i, 'css', e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {previewAbierto && (esMines
        ? <PreviewMines juego={juego} onClose={() => setPreviewAbierto(false)} />
        : esRuleta
          ? <PreviewRuleta juego={juego} simbolos={simbolos} onClose={() => setPreviewAbierto(false)} />
          : esRuletaBotones
            ? <PreviewRuletaBotones juego={juego} onClose={() => setPreviewAbierto(false)} />
            : esCrash
              ? <PreviewCrash juego={juego} onClose={() => setPreviewAbierto(false)} />
              : esPlinko
                ? <PreviewPlinko juego={juego} onClose={() => setPreviewAbierto(false)} />
                : esRaspadita
                  ? <PreviewRaspadita juego={juego} onClose={() => setPreviewAbierto(false)} />
                  : <Preview juego={juego} simbolos={simbolos} sonidos={sonidos} efectos={efectos} onClose={() => setPreviewAbierto(false)} />
      )}
    </>
  );
}

function Tile({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="hint" style={{ margin: 0 }}>{etiqueta}</p>
      <strong style={{ fontSize: 20 }}>{valor}</strong>
    </div>
  );
}

function Aviso({ rtp }: { rtp: number }) {
  if (rtp > 100) {
    return <p style={{ display: 'block', padding: '8px 10px', borderRadius: 8, fontSize: 13, margin: '0 0 12px', background: 'rgba(248,113,113,.12)', color: 'var(--danger)' }}>El juego pagaría más de lo que recauda. Bajá algún pago antes de publicarlo.</p>;
  }
  if (rtp > 0 && rtp < 70) {
    return <p style={{ display: 'block', padding: '8px 10px', borderRadius: 8, fontSize: 13, margin: '0 0 12px', background: 'rgba(251,191,36,.12)', color: 'var(--warning)' }}>Retorno muy bajo: el jugador se queda sin saldo enseguida.</p>;
  }
  return null;
}

function Historial({ html }: { html: string }) {
  if (html === 'Cargando...') return <p className="hint" style={{ margin: 0 }}>Cargando...</p>;
  if (html === '__VACIO__') return <p className="hint" style={{ margin: 0 }}>Todavía no se jugó ninguna ronda con dinero real.</p>;
  if (html.startsWith('__ERROR__')) return <p className="hint error" style={{ margin: 0 }}>{html.slice(9)}</p>;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------------- Mines: ajuste del juego (grupo "jugabilidad") ----------------

interface SeccionMinesProps {
  juego: Juego;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
  onCampos: (patch: Record<string, unknown>) => void | Promise<void>;
}

const CARAS_MINES: { cara: 'oculta' | 'segura' | 'mina'; etiqueta: string; nota: string }[] = [
  { cara: 'oculta', etiqueta: 'Casilla tapada', nota: 'la animación corre en loop' },
  { cara: 'segura', etiqueta: 'Casilla segura', nota: 'corre una vez al destapar' },
  { cara: 'mina', etiqueta: 'Mina', nota: 'corre una vez al perder' },
];

function SeccionMines({ juego, onCampo, onCampos }: SeccionMinesProps) {
  const [margenTxt, setMargenTxt] = useState(String(Number(juego.mines_margen_pct ?? 0.03) * 100));
  useEffect(() => { setMargenTxt(String(Number(juego.mines_margen_pct ?? 0.03) * 100)); }, [juego.id]);

  const [simMinas, setSimMinas] = useState(3);
  const [simRetiro, setSimRetiro] = useState(5);
  const [simOut, setSimOut] = useState('');
  const [simulando, setSimulando] = useState(false);

  const margen = (Number(margenTxt) || 0) / 100;

  const guardarMargen = () => {
    onCampo('mines_margen_pct', Math.max(0, Math.min(0.9999, margen)));
  };

  const simular = async () => {
    setSimulando(true);
    setSimOut('Simulando…');
    await new Promise((r) => setTimeout(r, 30));
    const r = simularMines({ partidas: 300_000, minas: simMinas, margenCasa: margen, retirarEn: simRetiro });
    setSimOut(
      `RTP obtenido ${r.rtp.toFixed(2)}% · esperado ${(100 - margen * 100).toFixed(2)}% · `
      + `${r.retiros.toLocaleString('es-PY')} retiros / ${r.perdidas.toLocaleString('es-PY')} perdidas`,
    );
    setSimulando(false);
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Mines — ajuste del juego</strong>
        <p className="hint" style={{ marginBottom: 14 }}>
          En Mines no hay tabla de símbolos: el RTP es un solo número. El margen de la casa es lo que se queda el juego en promedio (RTP ≈ 100 − margen).
        </p>
        <label style={{ fontSize: 12, display: 'block', maxWidth: 220 }}>
          Margen de la casa (%)
          <input type="number" step="0.1" value={margenTxt} onChange={(e) => setMargenTxt(e.target.value)} onBlur={guardarMargen} />
        </label>
        <p className="hint" style={{ margin: '6px 0 0' }}>RTP ≈ {(100 - (Number(margenTxt) || 0)).toFixed(1)}%</p>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
          <strong style={{ fontSize: 14 }}>Simulador</strong>
          <p className="hint" style={{ marginBottom: 10 }}>
            El multiplicador es exacto por diseño: el RTP es 100 − margen sin importar cuántas minas. El simulador lo confirma con 300.000 partidas; con muchas minas la varianza es alta, corrélo varias veces.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
            <label style={{ fontSize: 12 }}>Minas<input type="number" min={1} max={24} value={simMinas} onChange={(e) => setSimMinas(Number(e.target.value) || 1)} style={{ width: 70 }} /></label>
            <label style={{ fontSize: 12 }}>Retira a los N aciertos<input type="number" min={1} max={24} value={simRetiro} onChange={(e) => setSimRetiro(Number(e.target.value) || 1)} style={{ width: 90 }} /></label>
            <button disabled={simulando} onClick={simular}>Simular</button>
          </div>
          <p className="hint" style={{ margin: 0 }}>{simOut}</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <strong style={{ fontSize: 14 }}>Al perder</strong>
            <p className="hint" style={{ margin: '2px 0 0', maxWidth: 320 }}>
              {(juego.mines_revelado_al_perder ?? 'todo') === 'minas'
                ? 'Se muestran solo las minas; el resto del tablero queda tapado.'
                : 'Se destapa el tablero entero: el jugador ve las seguras que no llegó a elegir.'}
            </p>
          </div>
          <select
            style={{ width: 'auto' }}
            value={juego.mines_revelado_al_perder ?? 'todo'}
            onChange={(e) => onCampo('mines_revelado_al_perder', e.target.value)}
          >
            <option value="todo">Limpiar el tablero</option>
            <option value="minas">Solo las minas</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <strong style={{ fontSize: 15 }}>Caras de la casilla</strong>
          <p className="hint" style={{ marginBottom: 14 }}>
            Cada cara acepta una imagen o una animación Lottie (.json / .lottie). Un asset por cara.
            Sin nada, se ve un estilo por defecto.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CARAS_MINES.map((c) => (
              <CaraCasilla key={c.cara} juego={juego} cara={c.cara} etiqueta={c.etiqueta} nota={c.nota} onCampos={onCampos} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaraCasilla({ juego, cara, etiqueta, nota, onCampos }: {
  juego: Juego;
  cara: 'oculta' | 'segura' | 'mina';
  etiqueta: string;
  nota: string;
  onCampos: (patch: Record<string, unknown>) => void | Promise<void>;
}) {
  const campoImg = `mines_casilla_${cara}_url`;
  const campoLottie = `mines_casilla_${cara}_lottie_url`;
  const imgUrl = (juego[campoImg] as string) || null;
  const lottieUrl = (juego[campoLottie] as string) || null;

  const [modo, setModo] = useState<'img' | 'anim'>(lottieUrl ? 'anim' : 'img');
  useEffect(() => { setModo(lottieUrl ? 'anim' : 'img'); }, [juego.id]); // al cambiar de juego

  const prevRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lottieUrl || !prevRef.current) return;
    let limpiar: (() => void) | null = null;
    let vivo = true;
    montarLottieEn(prevRef.current, lottieUrl, { loop: true }).then((fn) => {
      if (vivo) limpiar = fn; else fn();
    });
    return () => { vivo = false; limpiar?.(); };
  }, [lottieUrl]);

  const subir = async (f: File, esLottie: boolean) => {
    const url = await subirArchivo(f, `mines/${juego.id}`);
    if (!url) return;
    await onCampos(esLottie ? { [campoLottie]: url, [campoImg]: null } : { [campoImg]: url, [campoLottie]: null });
  };
  const quitar = () => onCampos({ [campoImg]: null, [campoLottie]: null });

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface-alt)', borderRadius: 8, padding: 12, flexWrap: 'wrap' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 8, flexShrink: 0, position: 'relative', overflow: 'hidden',
        border: '1px solid var(--border)', background: 'var(--surface)',
        backgroundImage: !lottieUrl && imgUrl ? `url('${imgUrl}')` : undefined,
        backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {lottieUrl && <div ref={prevRef} style={{ position: 'absolute', inset: 2 }} />}
        {!lottieUrl && !imgUrl && (cara === 'segura' ? '💎' : cara === 'mina' ? '💣' : '')}
      </div>

      <div style={{ flex: 1, minWidth: 130 }}>
        <strong style={{ fontSize: 13 }}>{etiqueta}</strong>
        <p className="hint" style={{ margin: '2px 0 0' }}>
          {lottieUrl ? `Animación · ${nota}` : imgUrl ? 'Imagen fija' : 'Sin configurar'}
        </p>
      </div>

      <div className="grupo-nav" style={{ gap: 4 }}>
        <button className={`grupo-btn ${modo === 'img' ? 'on' : ''}`} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setModo('img')}>Imagen</button>
        <button className={`grupo-btn ${modo === 'anim' ? 'on' : ''}`} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setModo('anim')}>Animación</button>
      </div>

      <label style={{ fontSize: 12 }}>
        <span className="hint">{modo === 'img' ? 'Subir imagen' : 'Subir .json / .lottie'}</span>
        <input
          type="file"
          accept={modo === 'img' ? 'image/*' : '.json,.lottie'}
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0], modo === 'anim')}
          style={{ display: 'block', marginTop: 4 }}
        />
      </label>

      {(imgUrl || lottieUrl) && (
        <button style={{ fontSize: 12, color: 'var(--danger)' }} onClick={quitar}>Quitar</button>
      )}
    </div>
  );
}

// ---------------- Ruleta: multiplicadores (grupo "jugabilidad") ----------------

function SeccionRuleta({ juego, simbolos, onRecargar }: {
  juego: Juego;
  simbolos: Simbolo[];
  onRecargar: () => void;
}) {
  const [filas, setFilas] = useState<Simbolo[]>(simbolos);
  useEffect(() => { setFilas(simbolos); }, [simbolos]);
  const [objetivo, setObjetivo] = useState(92);
  const [msg, setMsg] = useState('');

  const analisis = analizarRuleta(filas);
  const total = filas.reduce((a, s) => a + Math.max(0, Math.round(Number(s.peso) || 0)), 0) || 1;

  const setFila = (i: number, patch: Partial<Simbolo>) =>
    setFilas((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const guardar = async (s: Simbolo) => {
    if (s.id) {
      await supabase.from('simbolos').update({
        nombre: s.nombre, peso: Number(s.peso) || 0,
        pago_tres: Number(s.pago_tres) || 0, color: s.color ?? null,
      }).eq('id', s.id);
    } else {
      await supabase.from('simbolos').insert({
        juego_id: juego.id, nombre: s.nombre, peso: Number(s.peso) || 0,
        pago_tres: Number(s.pago_tres) || 0, pago_dos: 0, color: s.color ?? null,
        orden: filas.length,
      });
    }
    setMsg('Guardado ✓');
    onRecargar();
  };

  const agregar = async () => {
    await supabase.from('simbolos').insert({
      juego_id: juego.id, nombre: '×2', peso: 4, pago_tres: 2, pago_dos: 0,
      color: PALETA_RULETA[filas.length % PALETA_RULETA.length], orden: filas.length,
    });
    onRecargar();
  };

  const borrar = async (s: Simbolo) => {
    if (s.id) await supabase.from('simbolos').delete().eq('id', s.id);
    onRecargar();
  };

  const calibrar = async () => {
    const actual = analizarRuleta(filas).rtp;
    if (actual <= 0) { setMsg('No hay pagos para calibrar.'); return; }
    const k = objetivo / actual;
    const nuevas = filas.map((s) => ({
      ...s, pago_tres: Math.round((Number(s.pago_tres) || 0) * k * 100) / 100,
    }));
    setFilas(nuevas);
    for (const s of nuevas) await guardar(s);
    setMsg('Calibrado ✓');
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Ruleta — multiplicadores</strong>
        <p className="hint" style={{ marginBottom: 14 }}>
          Cada fila es un multiplicador: su color, su etiqueta, cuántas <b>tajadas iguales</b> ocupa
          en la rueda, y cuánto paga. La probabilidad de cada uno = sus tajadas / el total.
          Un multiplicador ×0 pierde la apuesta.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 84px 84px 74px 28px', gap: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-dim)', padding: '0 2px 4px' }}>
          <span /><span>Etiqueta</span><span>Tajadas</span><span>Multiplic.</span><span>Prob · RTP</span><span />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filas.length === 0 && <p className="hint">Todavía no agregaste multiplicadores.</p>}
          {filas.map((s, i) => {
            const cant = Math.max(0, Math.round(Number(s.peso) || 0));
            const mult = Number(s.pago_tres) || 0;
            const prob = (cant / total) * 100;
            return (
              <div key={s.id || `n-${i}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 84px 84px 74px 28px', gap: 8, alignItems: 'center', background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 8px' }}>
                <input type="color" value={s.color || PALETA_RULETA[i % PALETA_RULETA.length]}
                  onChange={(e) => setFila(i, { color: e.target.value })}
                  onBlur={() => guardar(filas[i])}
                  style={{ width: 26, height: 24, padding: 0 }} />
                <input value={s.nombre} onChange={(e) => setFila(i, { nombre: e.target.value })} onBlur={() => guardar(filas[i])} />
                <input type="number" min={0} step={1} value={cant}
                  onChange={(e) => setFila(i, { peso: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  onBlur={() => guardar(filas[i])} />
                <input type="number" min={0} step={0.5} value={mult}
                  onChange={(e) => setFila(i, { pago_tres: Math.max(0, Number(e.target.value) || 0) })}
                  onBlur={() => guardar(filas[i])} />
                <span className="hint" style={{ margin: 0, fontSize: 11 }}>{prob.toFixed(1)}% · {(prob * mult / 100).toFixed(0)}%</span>
                <button onClick={() => borrar(filas[i])} style={{ padding: '4px 6px' }}>✕</button>
              </div>
            );
          })}
        </div>
        <button style={{ marginTop: 10 }} onClick={agregar}>+ Agregar multiplicador</button>
        <p className="hint" style={{ margin: '10px 0 0' }}>
          Total: <b>{total} tajadas</b> · RTP <b>{analisis.rtp.toFixed(1)}%</b>
          {analisis.rtp > 100 && <span style={{ color: 'var(--danger)' }}> — la rueda pierde plata en cada giro</span>}
        </p>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12 }}>RTP objetivo
            <input type="number" step={1} value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value) || 92)} style={{ width: 60, marginLeft: 6 }} />%
          </label>
          <button onClick={calibrar}>Calibrar (escala los multiplicadores)</button>
          <span className="hint" style={{ margin: 0 }}>{msg}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Ruleta de botones (grupo "jugabilidad") ----------------

function SeccionRuletaBotones({ juego, onCampo }: {
  juego: Juego;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
}) {
  const [cfg, setCfg] = useState<RuletaBotonesCfg>(() => cfgBotonesDe(juego));
  useEffect(() => { setCfg(cfgBotonesDe(juego)); }, [juego.id]);
  const [objetivo, setObjetivo] = useState(92);
  const [msg, setMsg] = useState('');

  const guardar = (next: RuletaBotonesCfg) => {
    setCfg(next);
    onCampo('ruleta_botones_cfg', next);
    setMsg('Guardado ✓');
  };
  const setNumeros = (numeros: RuletaBotonesCfg['numeros']) => guardar({ ...cfg, numeros });
  const setSorpresa = (sorpresa: RuletaBotonesCfg['sorpresa']) => guardar({ ...cfg, sorpresa });

  const total = totalTajadasBotones(cfg.numeros) || 1;
  const es = sorpresaEsperadaB(cfg.sorpresa.pool);
  const factor = factorSorpresaB(cfg.numeros, cfg.sorpresa);
  const rtpBase = (cfg.numeros.reduce((a, _n, i) => a + rtpNumeroB(cfg.numeros, i), 0) / (cfg.numeros.length || 1)) * 100;
  const rtpTot = rtpBase * factor;

  const emparejarTajadas = () => {
    const pesos = cfg.numeros.map((n) => 1 / Math.max(1, n.mult));
    const suma = pesos.reduce((a, b) => a + b, 0);
    setNumeros(cfg.numeros.map((n, i) => ({ ...n, cant: Math.max(1, Math.round((pesos[i] / suma) * total)) })));
  };
  const siempre = cfg.sorpresa.frecuencia >= 1;

  const calibrarFrecuencia = () => {
    const rb = rtpBase / 100;
    const n = cfg.numeros.length || 1;
    if (rb <= 0 || es <= 1) return;
    let f = ((objetivo / 100) / rb - 1) * n / (es - 1);
    f = Math.max(0, Math.min(1, f));
    setSorpresa({ ...cfg.sorpresa, frecuencia: Math.round(f * 20) / 20 });
    setMsg(f >= 1 ? 'Ni al 100% se llega: subí los pesos altos del pool.' : 'Frecuencia ajustada ✓');
  };

  // Con la sorpresa "en cada jugada" la frecuencia queda fija en 1, así
  // que el RTP se calibra re-pesando el pool hacia multiplicadores más
  // bajos (o más altos). w_i ← w_i · r^(mult_i), bisección sobre r.
  const calibrarPool = () => {
    const rb = rtpBase / 100;
    const n = cfg.numeros.length || 1;
    if (rb <= 0) return;
    const esObjetivo = 1 + n * ((objetivo / 100) / rb - 1);
    const pool = cfg.sorpresa.pool.map((p) => ({
      mult: Math.max(0, Number(p.mult) || 0),
      peso: Math.max(1e-4, Number(p.peso) || 0),
    }));
    const mults = pool.map((p) => p.mult);
    const esMin = Math.min(...mults), esMax = Math.max(...mults);
    if (esObjetivo <= esMin) {
      setMsg('Para bajar más el RTP: agregá una sorpresa ×1 al pool o bajá los multiplicadores de los números.');
      return;
    }
    if (esObjetivo >= esMax) {
      setMsg('Ni con todo el peso arriba se llega: subí los multiplicadores del pool.');
      return;
    }
    const esCon = (r: number) => {
      let W = 0, S = 0;
      for (const p of pool) { const w = p.peso * Math.pow(r, p.mult); W += w; S += w * p.mult; }
      return W > 0 ? S / W : 0;
    };
    let lo = 1e-6, hi = 1e6;
    for (let it = 0; it < 80; it++) {
      const mid = Math.sqrt(lo * hi);
      if (esCon(mid) < esObjetivo) lo = mid; else hi = mid;
    }
    const r = Math.sqrt(lo * hi);
    const nuevos = pool.map((p) => ({
      mult: p.mult,
      peso: Math.round(p.peso * Math.pow(r, p.mult) * 1000) / 1000,
    }));
    setSorpresa({ ...cfg.sorpresa, pool: nuevos });
    setMsg('Pesos de la sorpresa ajustados ✓');
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Tema visual</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          Cambia el aspecto de la rueda y la mesa en la pantalla del jugador (fondo, colores,
          tipografía). No toca la matemática ni el RTP. <b>Clásico</b> = como estaba.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
          {TEMAS_RULETA.map((t) => {
            const activo = (cfg.tema || 'clasico') === t.id;
            const muestra = t.seg || cfg.numeros.map((n) => n.color);
            return (
              <button key={t.id} onClick={() => guardar({ ...cfg, tema: t.id })} style={{
                display: 'flex', flexDirection: 'column', gap: 6, padding: 8, textAlign: 'left',
                borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                background: activo ? 'var(--accent-soft)' : 'var(--surface-alt)',
              }}>
                <span style={{ display: 'flex', height: 20, borderRadius: 5, overflow: 'hidden' }}>
                  {muestra.slice(0, 9).map((c, j) => <span key={j} style={{ flex: 1, background: c }} />)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{t.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Los números</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          Cada fila es un botón: su multiplicador base, cuántas <b>tajadas iguales</b> ocupa
          en la rueda, su color y una <b>imagen</b> opcional. RTP del nº = probabilidad × multiplicador (contando la sorpresa).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '26px 26px 58px 58px 1fr 26px', gap: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-dim)', padding: '0 2px 4px' }}>
          <span /><span>Img</span><span>Multip.</span><span>Tajadas</span><span>Prob · RTP</span><span />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cfg.numeros.map((n, i) => {
            const prob = (Math.max(0, Math.round(n.cant)) / total) * 100;
            const rtpN = rtpNumeroB(cfg.numeros, i) * factor * 100;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '26px 26px 58px 58px 1fr 26px', gap: 8, alignItems: 'center', background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 8px' }}>
                <input type="color" value={n.color}
                  onChange={(e) => setNumeros(cfg.numeros.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}
                  style={{ width: 24, height: 22, padding: 0 }} />
                <label
                  title={n.img ? 'Cambiar imagen · clic derecho para quitar' : 'Subir imagen del multiplicador'}
                  onContextMenu={(e) => { e.preventDefault(); if (n.img) setNumeros(cfg.numeros.map((x, j) => j === i ? { ...x, img: null } : x)); }}
                  style={{
                    width: 24, height: 24, borderRadius: 5, cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                    border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: 'var(--text-dim)',
                    background: n.img ? `center/contain no-repeat var(--bg) url("${n.img}")` : 'var(--bg)',
                  }}>
                  {!n.img && '+'}
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    const url = await subirArchivo(f, `ruleta/${juego.id}`);
                    if (url) setNumeros(cfg.numeros.map((x, j) => j === i ? { ...x, img: url } : x));
                  }} />
                </label>
                <input type="number" min={1} step={1} value={n.mult}
                  onChange={(e) => {
                    const m = Math.max(1, Math.round(Number(e.target.value) || 1));
                    setNumeros(cfg.numeros.map((x, j) => j === i ? { ...x, mult: m, et: '×' + m } : x));
                  }} />
                <input type="number" min={0} step={1} value={Math.max(0, Math.round(n.cant))}
                  onChange={(e) => setNumeros(cfg.numeros.map((x, j) => j === i ? { ...x, cant: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x))} />
                <span className="hint" style={{ margin: 0, fontSize: 11, color: rtpN > 100 ? 'var(--danger)' : undefined }}>
                  {prob.toFixed(1)}% · {rtpN.toFixed(0)}%
                </span>
                <button onClick={() => setNumeros(cfg.numeros.filter((_x, j) => j !== i))} style={{ padding: '4px 6px' }} disabled={cfg.numeros.length <= 3}>✕</button>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setNumeros([...cfg.numeros, { mult: 5, cant: 1, color: PALETA_RULETA[cfg.numeros.length % PALETA_RULETA.length], et: '×5' }])}>+ Agregar número</button>
          <button onClick={emparejarTajadas}>Emparejar tajadas (∝ 1/multip.)</button>
        </div>
        <p className="hint" style={{ margin: '10px 0 0' }}>Rueda de <b>{total} tajadas</b>.</p>

        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Grosor del borde de color en los botones: <b>{cfg.bordeGrosor ?? 3} px</b>
            <span className="hint" style={{ margin: 0 }}> — rodea todo el botón; 0 = sin borde.</span>
          </label>
          <input type="range" min={0} max={10} step={1} value={cfg.bordeGrosor ?? 3}
            onChange={(e) => guardar({ ...cfg, bordeGrosor: Number(e.target.value) })}
            style={{ width: '100%' }} />
        </div>

        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <label
            title={cfg.botonFondo ? 'Cambiar fondo · clic derecho para quitar' : 'Subir imagen de fondo para los botones'}
            onContextMenu={(e) => { e.preventDefault(); if (cfg.botonFondo) guardar({ ...cfg, botonFondo: null }); }}
            style={{
              width: 60, height: 44, flexShrink: 0, borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
              border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'var(--text-dim)',
              background: cfg.botonFondo ? `center/cover no-repeat var(--bg) url("${cfg.botonFondo}")` : 'var(--bg)',
            }}>
            {!cfg.botonFondo && '+'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const url = await subirArchivo(f, `ruleta/${juego.id}`);
              if (url) guardar({ ...cfg, botonFondo: url });
            }} />
          </label>
          <div>
            <label style={{ fontSize: 12, display: 'block', fontWeight: 600 }}>Imagen de fondo de los botones</label>
            <span className="hint" style={{ margin: 0 }}>
              Una sola para los 9 botones. Encima quedan el borde de color, la imagen del número y el ×N (se les agrega sombra para que se lean).
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Multiplicador sorpresa</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          En cada giro puede aparecer sobre un número al azar. Es lo que levanta el RTP (bajo de base)
          y da emoción. Cuanto menos seguido aparece, más grande puede ser.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={siempre}
            onChange={(e) => setSorpresa({ ...cfg.sorpresa, frecuencia: e.target.checked ? 1 : 0.35 })} />
          La sorpresa aparece <b>en cada jugada</b>
        </label>
        <label style={{ fontSize: 12, display: 'block', opacity: siempre ? 0.4 : 1 }}>
          Aparece en <b>{Math.round(cfg.sorpresa.frecuencia * 100)}%</b> de las jugadas
          {cfg.sorpresa.frecuencia > 0 && !siempre && <span className="hint" style={{ margin: 0 }}> (≈ 1 de cada {(1 / cfg.sorpresa.frecuencia).toFixed(1)})</span>}
        </label>
        <input type="range" min={0} max={100} step={5} disabled={siempre}
          value={Math.round(cfg.sorpresa.frecuencia * 100)}
          onChange={(e) => setSorpresa({ ...cfg.sorpresa, frecuencia: Number(e.target.value) / 100 })}
          style={{ width: '100%', margin: '4px 0 12px', opacity: siempre ? 0.4 : 1 }} />
        {siempre && (
          <p className="hint" style={{ margin: '0 0 12px' }}>
            Con la sorpresa siempre activa el RTP sube bastante: bajá los pesos de los multiplicadores
            altos del pool (o usá <b>Calibrar pool</b>).
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-dim)', padding: '0 2px 4px' }}>
          <span>Multiplicador</span><span>Peso</span><span style={{ textAlign: 'right' }}>Prob</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cfg.sorpresa.pool.map((p, i) => {
            const tp = cfg.sorpresa.pool.reduce((a, x) => a + Math.max(0, x.peso), 0) || 1;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, alignItems: 'center', background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 8px' }}>
                <span style={{ fontWeight: 700 }}>×{p.mult}</span>
                <input type="number" min={0} step={0.05} value={p.peso}
                  onChange={(e) => setSorpresa({ ...cfg.sorpresa, pool: cfg.sorpresa.pool.map((x, j) => j === i ? { ...x, peso: Math.max(0, Number(e.target.value) || 0) } : x) })} />
                <span className="hint" style={{ margin: 0, fontSize: 11, textAlign: 'right' }}>{((Math.max(0, p.peso) / tp) * 100).toFixed(2)}%</span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>RTP base (números)</span><span>{rtpBase.toFixed(1)}%</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Sorpresa promedio</span><span>×{es.toFixed(1)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Factor de la sorpresa</span><span>×{factor.toFixed(3)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 4, borderTop: '1px solid var(--border)', fontWeight: 800, fontSize: 15 }}>
            <span>RTP total</span><span style={{ color: rtpTot > 100 ? 'var(--danger)' : undefined }}>{rtpTot.toFixed(1)}%</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ fontSize: 12 }}>Objetivo
            <input type="number" step={1} value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value) || 92)} style={{ width: 56, marginLeft: 6 }} />%
          </label>
          <button onClick={siempre ? calibrarPool : calibrarFrecuencia}>
            {siempre ? 'Calibrar pool' : 'Calibrar frecuencia'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <label style={{ fontSize: 12 }}>Tope de premio por jugada
            <input type="number" min={0} step={10000} value={cfg.sorpresa.tope}
              onChange={(e) => setSorpresa({ ...cfg.sorpresa, tope: Math.max(0, Number(e.target.value) || 0) })}
              style={{ width: 110, marginLeft: 6 }} />
          </label>
          <span className="hint" style={{ margin: 0 }}>0 = sin tope</span>
        </div>
      </div>

      <div className="card">
        <strong style={{ fontSize: 15 }}>Valores de ficha</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          {cfg.fichas.map((v, i) => (
            <input key={i} type="number" min={1} step={100} value={v}
              onChange={(e) => guardar({ ...cfg, fichas: cfg.fichas.map((x, j) => j === i ? Math.max(1, Math.round(Number(e.target.value) || 1)) : x) })}
              style={{ width: 84 }} />
          ))}
          <button onClick={() => guardar({ ...cfg, fichas: [...cfg.fichas, (cfg.fichas[cfg.fichas.length - 1] || 1000) * 2] })} style={{ padding: '4px 10px' }}>+</button>
          {cfg.fichas.length > 1 && (
            <button onClick={() => guardar({ ...cfg, fichas: cfg.fichas.slice(0, -1) })} style={{ padding: '4px 10px' }}>−</button>
          )}
        </div>
        <p className="hint" style={{ margin: '10px 0 0' }}>{msg}</p>
      </div>
    </div>
  );
}

// ---------------- Crash ----------------

const FORMATOS_CRASH: { v: string; et: string }[] = [
  { v: 'curva', et: 'Curva' },
  { v: 'cohete', et: 'Vertical' },
  { v: 'numero', et: 'Número' },
  { v: 'medidor', et: 'Medidor' },
  { v: 'odometro', et: 'Odómetro' },
];
const EFECTOS_NUM: { v: string; et: string }[] = [
  { v: 'ninguno', et: 'Ninguno' },
  { v: 'pulso', et: 'Pulso' },
  { v: 'glow', et: 'Glow' },
];

function SeccionCrash({ juego, onCampo }: {
  juego: Juego;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
}) {
  const [cfg, setCfg] = useState<CrashCfg>(() => cfgCrashDe(juego));
  useEffect(() => { setCfg(cfgCrashDe(juego)); }, [juego.id]);
  const [msg, setMsg] = useState('');

  const guardar = (next: CrashCfg) => {
    setCfg(next);
    onCampo('crash_cfg', next);
    setMsg('Guardado ✓');
  };
  const setObjeto = (p: Partial<CrashCfg['objeto']>) => guardar({ ...cfg, objeto: { ...cfg.objeto, ...p } });
  const setCurva = (p: Partial<CrashCfg['curva']>) => guardar({ ...cfg, curva: { ...cfg.curva, ...p } });
  const setNumero = (p: Partial<CrashCfg['numero']>) => guardar({ ...cfg, numero: { ...cfg.numero, ...p } });
  const setAuto = (p: Partial<CrashCfg['auto']>) => guardar({ ...cfg, auto: { ...cfg.auto, ...p } });

  const rtpPct = cfg.rtp * 100;
  const seg2 = (n: number) => Math.round(Math.log(2) / (Math.LN2 / (5000 / cfg.velocidad)) / 100) / 10;

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Jugabilidad</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          Lo único que mueve la plata. El punto de reventón sale de una fórmula con RTP exacto:
          retire donde retire el jugador, el retorno promedio es el que fijes acá.
        </p>

        <label style={{ fontSize: 12, display: 'block' }}>
          RTP <b>{rtpPct.toFixed(1)}%</b>
          <span className="hint" style={{ margin: 0 }}> — el {(100 - rtpPct).toFixed(1)}% es la probabilidad de reventón instantáneo (margen de casa)</span>
        </label>
        <input type="range" min={85} max={99} step={0.5} value={rtpPct}
          onChange={(e) => guardar({ ...cfg, rtp: Number(e.target.value) / 100 })}
          style={{ width: '100%', margin: '4px 0 14px' }} />

        <label style={{ fontSize: 12, display: 'block' }}>
          Velocidad <b>×{cfg.velocidad.toFixed(1)}</b>
          <span className="hint" style={{ margin: 0 }}> — llega a ×2 en ~{seg2(cfg.velocidad).toFixed(1)}s</span>
        </label>
        <input type="range" min={0.4} max={3} step={0.1} value={cfg.velocidad}
          onChange={(e) => guardar({ ...cfg, velocidad: Number(e.target.value) })}
          style={{ width: '100%', margin: '4px 0 14px' }} />

        <label style={{ fontSize: 12 }}>Tope de multiplicador
          <input type="number" min={2} step={10} value={cfg.tope}
            onChange={(e) => guardar({ ...cfg, tope: Math.max(2, Math.round(Number(e.target.value) || 100)) })}
            style={{ width: 90, marginLeft: 8 }} />
        </label>

        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8 }}>
            <input type="checkbox" checked={cfg.auto.permitir}
              onChange={(e) => setAuto({ permitir: e.target.checked })} />
            Permitir <b>auto-retiro</b>
          </label>
          {cfg.auto.permitir && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
              <label>Por defecto ×
                <input type="number" min={1.01} step={0.1} value={cfg.auto.valorDefecto}
                  onChange={(e) => setAuto({ valorDefecto: Math.max(1.01, Number(e.target.value) || 2) })}
                  style={{ width: 70, marginLeft: 4 }} />
              </label>
              <label>Mín ×
                <input type="number" min={1.01} step={0.1} value={cfg.auto.min}
                  onChange={(e) => setAuto({ min: Math.max(1.01, Number(e.target.value) || 1.01) })}
                  style={{ width: 70, marginLeft: 4 }} />
              </label>
              <label>Máx ×
                <input type="number" min={1.01} step={1} value={cfg.auto.max}
                  onChange={(e) => setAuto({ max: Math.max(1.01, Number(e.target.value) || 100) })}
                  style={{ width: 70, marginLeft: 4 }} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Formato</strong>
        <p className="hint" style={{ marginBottom: 10 }}>Cómo se presenta el multiplicador. El mismo motor, otra cara.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FORMATOS_CRASH.map((f) => (
            <button key={f.v} onClick={() => guardar({ ...cfg, formato: f.v })}
              className={cfg.formato === f.v ? 'primary' : undefined} style={{ fontSize: 12 }}>{f.et}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Tema visual</strong>
        <p className="hint" style={{ marginBottom: 12 }}>Cambia fondo, colores y tipografía. <b>Clásico</b> = hereda del panel.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
          {TEMAS_CRASH.map((t) => {
            const on = (cfg.tema || 'clasico') === t.id;
            return (
              <button key={t.id} onClick={() => guardar({ ...cfg, tema: t.id })} style={{
                display: 'flex', flexDirection: 'column', gap: 6, padding: 8, textAlign: 'left', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-soft)' : 'var(--surface-alt)',
              }}>
                <span style={{ display: 'flex', height: 18, borderRadius: 5, overflow: 'hidden' }}>
                  <span style={{ flex: 2, background: t.trazo }} />
                  <span style={{ flex: 1, background: t.objeto }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{t.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>El objeto que vuela</strong>
        <p className="hint" style={{ marginBottom: 10 }}>
          No hace falta ningún "símbolo": sube lo que quieras acá. Sigue la curva al subir.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['auto', 'Automático'], ['lottie', 'Solo Lottie'], ['imagen', 'Solo imagen'], ['emoji', 'Solo emoji']] as const).map(([v, et]) => (
            <button key={v} onClick={() => setObjeto({ tipo: v })}
              className={cfg.objeto.tipo === v ? 'primary' : undefined} style={{ fontSize: 12 }}>{et}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label
            title={cfg.objeto.lottie_url ? 'Cambiar · clic derecho para quitar' : 'Subir .json / .lottie'}
            onContextMenu={(e) => { e.preventDefault(); if (cfg.objeto.lottie_url) setObjeto({ lottie_url: null }); }}
            style={{
              width: 56, height: 56, flexShrink: 0, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
              border: `1px dashed ${cfg.objeto.lottie_url ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              fontSize: 10, color: cfg.objeto.lottie_url ? 'var(--accent)' : 'var(--text-dim)', background: 'var(--bg)',
            }}>
            {cfg.objeto.lottie_url ? '✦ anim' : 'Lottie'}
            <input type="file" accept=".json,.lottie" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const url = await subirArchivo(f, `crash/${juego.id}`);
              if (url) setObjeto({ lottie_url: url });
            }} />
          </label>
          <label
            title={cfg.objeto.imagen_url ? 'Cambiar · clic derecho para quitar' : 'Subir imagen'}
            onContextMenu={(e) => { e.preventDefault(); if (cfg.objeto.imagen_url) setObjeto({ imagen_url: null }); }}
            style={{
              width: 56, height: 56, flexShrink: 0, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
              border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: 'var(--text-dim)',
              background: cfg.objeto.imagen_url ? `center/contain no-repeat var(--bg) url("${cfg.objeto.imagen_url}")` : 'var(--bg)',
            }}>
            {!cfg.objeto.imagen_url && '+'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const url = await subirArchivo(f, `crash/${juego.id}`);
              if (url) setObjeto({ imagen_url: url });
            }} />
          </label>
          <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <label>Emoji si no hay nada
              <input type="text" maxLength={4} value={cfg.objeto.emojiFallback}
                onChange={(e) => setObjeto({ emojiFallback: e.target.value })}
                style={{ width: 56, marginLeft: 6 }} />
            </label>
            <label>Tamaño <b>{cfg.objeto.tam}px</b>
              <input type="range" min={24} max={200} step={2} value={cfg.objeto.tam}
                onChange={(e) => setObjeto({ tam: Number(e.target.value) })}
                style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={cfg.objeto.estela} onChange={(e) => setObjeto({ estela: e.target.checked })} />
              Deja estela / humo
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.objeto.seguir} onChange={(e) => setObjeto({ seguir: e.target.checked })} />
            <b>Rota para seguir la curva</b>
          </label>
          <label>El arte apunta hacia
            <select value={cfg.objeto.apunta} onChange={(e) => setObjeto({ apunta: e.target.value === 'derecha' ? 'derecha' : 'arriba' })} style={{ marginLeft: 6 }}>
              <option value="arriba">Arriba</option>
              <option value="derecha">Derecha</option>
            </select>
          </label>
          <label>Ajuste de giro <b>{cfg.objeto.giro}°</b>
            <input type="range" min={-180} max={180} step={5} value={cfg.objeto.giro}
              onChange={(e) => setObjeto({ giro: Number(e.target.value) })}
              style={{ width: 100, marginLeft: 6, verticalAlign: 'middle' }} />
          </label>
        </div>
      </div>

      <div className="card">
        <strong style={{ fontSize: 15 }}>Aspecto</strong>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, fontSize: 12 }}>
          <label>Color de la curva / número
            <input type="color" value={cfg.curva.color}
              onChange={(e) => setCurva({ color: e.target.value })}
              style={{ width: 34, height: 24, padding: 0, marginLeft: 6, verticalAlign: 'middle' }} />
          </label>
          <label>Grosor <b>{cfg.curva.grosor}</b>
            <input type="range" min={1} max={10} step={1} value={cfg.curva.grosor}
              onChange={(e) => setCurva({ grosor: Number(e.target.value) })}
              style={{ width: 90, marginLeft: 6, verticalAlign: 'middle' }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.curva.relleno} onChange={(e) => setCurva({ relleno: e.target.checked })} />Relleno
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.curva.glow} onChange={(e) => setCurva({ glow: e.target.checked })} />Glow
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.curva.cuadricula} onChange={(e) => setCurva({ cuadricula: e.target.checked })} />Cuadrícula
          </label>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 12 }}>
          <label>Tamaño del número <b>×{cfg.numero.tam.toFixed(1)}</b>
            <input type="range" min={0.5} max={2.4} step={0.1} value={cfg.numero.tam}
              onChange={(e) => setNumero({ tam: Number(e.target.value) })}
              style={{ width: 90, marginLeft: 6, verticalAlign: 'middle' }} />
          </label>
          <label>Efecto
            <select value={cfg.numero.efecto} onChange={(e) => setNumero({ efecto: e.target.value })} style={{ marginLeft: 6 }}>
              {EFECTOS_NUM.map((x) => <option key={x.v} value={x.v}>{x.et}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.historial.mostrar}
              onChange={(e) => guardar({ ...cfg, historial: { ...cfg.historial, mostrar: e.target.checked } })} />
            Tira de historial
          </label>
        </div>
        <p className="hint" style={{ margin: '12px 0 0' }}>
          La posición y el tamaño de cada control se ajustan desde <b>⚙ Ajustar → Controles</b> en la Vista previa. {msg}
        </p>
      </div>
    </div>
  );
}

// ---------------- Plinko ----------------

const FILAS_PLINKO = [8, 10, 12, 14, 16];
const RIESGOS_PLINKO: { v: string; et: string }[] = [
  { v: 'bajo', et: 'Bajo' }, { v: 'medio', et: 'Medio' }, { v: 'alto', et: 'Alto' },
];

function SeccionPlinko({ juego, onCampo }: {
  juego: Juego;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
}) {
  const [cfg, setCfg] = useState<PlinkoCfg>(() => cfgPlinkoDe(juego));
  useEffect(() => { setCfg(cfgPlinkoDe(juego)); }, [juego.id]);
  const [msg, setMsg] = useState('');

  const guardar = (next: PlinkoCfg) => { setCfg(next); onCampo('plinko_cfg', next); setMsg('Guardado ✓'); };
  const setBola = (p: Partial<PlinkoCfg['bola']>) => guardar({ ...cfg, bola: { ...cfg.bola, ...p } });

  const toggleFila = (n: number) => {
    const has = cfg.filasPermitidas.includes(n);
    let next = has ? cfg.filasPermitidas.filter((x) => x !== n) : [...cfg.filasPermitidas, n].sort((a, b) => a - b);
    if (!next.length) next = [n];
    const def = next.includes(cfg.filasDefecto) ? cfg.filasDefecto : next[Math.floor(next.length / 2)];
    guardar({ ...cfg, filasPermitidas: next, filasDefecto: def });
  };
  const toggleRiesgo = (r: string) => {
    const has = cfg.riesgoPermitido.includes(r);
    let next = has ? cfg.riesgoPermitido.filter((x) => x !== r) : [...cfg.riesgoPermitido, r];
    if (!next.length) next = [r];
    guardar({ ...cfg, riesgoPermitido: next, riesgoDefecto: next.includes(cfg.riesgoDefecto) ? cfg.riesgoDefecto : next[0] });
  };

  const previa = tablaMultPlinko(cfg.filasDefecto, cfg.riesgoDefecto, cfg.rtp);
  const rtpDef = previa.reduce((a, m, k) => a + probsPlinko(cfg.filasDefecto)[k] * m, 0) * 100;

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Jugabilidad</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          El pago de cada cubeta se calcula solo y se escala para dar el RTP que fijes. La bolita cae por
          volados justos: el <b>servidor</b> decide a qué cubeta y por qué camino.
        </p>

        <label style={{ fontSize: 12, display: 'block' }}>
          RTP objetivo <b>{(cfg.rtp * 100).toFixed(1)}%</b>
          <span className="hint" style={{ margin: 0 }}> — real de la config por defecto: {rtpDef.toFixed(1)}%</span>
        </label>
        <input type="range" min={85} max={99} step={0.5} value={cfg.rtp * 100}
          onChange={(e) => guardar({ ...cfg, rtp: Number(e.target.value) / 100 })}
          style={{ width: '100%', margin: '4px 0 14px' }} />

        <label style={{ fontSize: 12, display: 'block' }}>
          Velocidad de caída <b>×{cfg.velocidad.toFixed(2)}</b>
          <span className="hint" style={{ margin: 0 }}> — menos = más lento y con más suspenso</span>
        </label>
        <input type="range" min={0.25} max={1.6} step={0.05} value={cfg.velocidad}
          onChange={(e) => guardar({ ...cfg, velocidad: Number(e.target.value) })}
          style={{ width: '100%', margin: '4px 0 14px' }} />

        <label style={{ fontSize: 12, display: 'block' }}>
          Alto del tablero <b>×{cfg.tablero.proporcion.toFixed(2)}</b>
          <span className="hint" style={{ margin: 0 }}> — más alto = clavos más separados y caída más larga</span>
        </label>
        <input type="range" min={0.9} max={2.2} step={0.05} value={cfg.tablero.proporcion}
          onChange={(e) => guardar({ ...cfg, tablero: { proporcion: Number(e.target.value) } })}
          style={{ width: '100%', margin: '4px 0 14px' }} />

        <div style={{ fontSize: 12, marginBottom: 4 }}>Filas que puede elegir el jugador</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILAS_PLINKO.map((n) => (
            <button key={n} onClick={() => toggleFila(n)}
              className={cfg.filasPermitidas.includes(n) ? 'primary' : undefined} style={{ fontSize: 12, minWidth: 40 }}>{n}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, margin: '12px 0 4px' }}>Nivel de riesgo que puede elegir</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RIESGOS_PLINKO.map((r) => (
            <button key={r.v} onClick={() => toggleRiesgo(r.v)}
              className={cfg.riesgoPermitido.includes(r.v) ? 'primary' : undefined} style={{ fontSize: 12 }}>{r.et}</button>
          ))}
        </div>
        <p className="hint" style={{ margin: '10px 0 0' }}>
          Si dejás una sola opción de cada uno, el jugador no ve el selector — así hacés varios juegos
          distintos del mismo motor (uno "8 bajo", otro "16 alto"…).
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Cubetas por defecto</strong>
        <p className="hint" style={{ marginBottom: 10 }}>
          {cfg.filasDefecto} filas · riesgo {cfg.riesgoDefecto} — así se ven los multiplicadores:
        </p>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
          {previa.map((m, k) => (
            <span key={k} style={{
              fontSize: 10.5, fontWeight: 700, padding: '2px 5px', borderRadius: 5,
              background: m >= 2 ? 'var(--accent-soft)' : 'var(--surface-alt)',
              color: m >= 10 ? '#ff8a3d' : m >= 2 ? 'var(--accent)' : m >= 1 ? 'var(--ok)' : 'var(--text-dim)',
            }}>{m >= 100 ? Math.round(m) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}×</span>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Tema visual</strong>
        <p className="hint" style={{ marginBottom: 12 }}>Fondo, colores y tipografía. <b>Clásico</b> = hereda del panel.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
          {TEMAS_PLINKO.map((t) => {
            const on = (cfg.tema || 'clasico') === t.id;
            return (
              <button key={t.id} onClick={() => guardar({ ...cfg, tema: t.id })} style={{
                display: 'flex', flexDirection: 'column', gap: 6, padding: 8, textAlign: 'left', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-soft)' : 'var(--surface-alt)',
              }}>
                <span style={{ display: 'flex', height: 18, borderRadius: 5, overflow: 'hidden' }}>
                  <span style={{ flex: 2, background: t.bola }} />
                  <span style={{ flex: 1, background: t.clavo }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{t.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <strong style={{ fontSize: 15 }}>La bolita</strong>
        <p className="hint" style={{ marginBottom: 10 }}>Imagen, animación Lottie o emoji. No hace falta cargar ningún "símbolo".</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['auto', 'Automático'], ['lottie', 'Solo Lottie'], ['imagen', 'Solo imagen'], ['emoji', 'Solo emoji']] as const).map(([v, et]) => (
            <button key={v} onClick={() => setBola({ tipo: v })}
              className={cfg.bola.tipo === v ? 'primary' : undefined} style={{ fontSize: 12 }}>{et}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label
            title={cfg.bola.lottie_url ? 'Cambiar · clic derecho para quitar' : 'Subir .json / .lottie'}
            onContextMenu={(e) => { e.preventDefault(); if (cfg.bola.lottie_url) setBola({ lottie_url: null }); }}
            style={{
              width: 52, height: 52, flexShrink: 0, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
              border: `1px dashed ${cfg.bola.lottie_url ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
              color: cfg.bola.lottie_url ? 'var(--accent)' : 'var(--text-dim)', background: 'var(--bg)',
            }}>
            {cfg.bola.lottie_url ? '✦ anim' : 'Lottie'}
            <input type="file" accept=".json,.lottie" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              const url = await subirArchivo(f, `plinko/${juego.id}`);
              if (url) setBola({ lottie_url: url });
            }} />
          </label>
          <label
            title={cfg.bola.imagen_url ? 'Cambiar · clic derecho para quitar' : 'Subir imagen'}
            onContextMenu={(e) => { e.preventDefault(); if (cfg.bola.imagen_url) setBola({ imagen_url: null }); }}
            style={{
              width: 52, height: 52, flexShrink: 0, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
              border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'var(--text-dim)',
              background: cfg.bola.imagen_url ? `center/contain no-repeat var(--bg) url("${cfg.bola.imagen_url}")` : 'var(--bg)',
            }}>
            {!cfg.bola.imagen_url && '+'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              const url = await subirArchivo(f, `plinko/${juego.id}`);
              if (url) setBola({ imagen_url: url });
            }} />
          </label>
          <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <label>Emoji si no hay nada
              <input type="text" maxLength={4} value={cfg.bola.emojiFallback}
                onChange={(e) => setBola({ emojiFallback: e.target.value })} style={{ width: 56, marginLeft: 6 }} />
            </label>
            <label>Tamaño <b>{cfg.bola.tam}px</b>
              <input type="range" min={10} max={48} step={1} value={cfg.bola.tam}
                onChange={(e) => setBola({ tam: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 12 }}>
          <label>Color de los clavos
            <input type="color" value={cfg.clavos.color || '#8b95a6'}
              onChange={(e) => guardar({ ...cfg, clavos: { color: e.target.value } })}
              style={{ width: 34, height: 24, padding: 0, marginLeft: 6, verticalAlign: 'middle' }} />
          </label>
          {cfg.clavos.color && <button style={{ fontSize: 11 }} onClick={() => guardar({ ...cfg, clavos: { color: null } })}>usar el del tema</button>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.historial.mostrar}
              onChange={(e) => guardar({ ...cfg, historial: { ...cfg.historial, mostrar: e.target.checked } })} />
            Tira de historial
          </label>
        </div>
        <p className="hint" style={{ margin: '12px 0 0' }}>
          Posición de los controles en <b>⚙ Ajustar → Controles</b>; el tablero de clavos en <b>Arte / luces</b>. {msg}
        </p>
      </div>
    </div>
  );
}

// ---------------- Raspadita ----------------

const CELDAS_RASPA = [6, 9, 12];

function SeccionRaspadita({ juego, onCampo }: {
  juego: Juego;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
}) {
  const [cfg, setCfg] = useState<RaspaCfg>(() => cfgRaspaDe(juego));
  useEffect(() => { setCfg(cfgRaspaDe(juego)); }, [juego.id]);
  const [msg, setMsg] = useState('');
  const [objetivo, setObjetivo] = useState('94');

  const guardar = (next: RaspaCfg) => { setCfg(next); onCampo('raspa_cfg', next); setMsg('Guardado ✓'); };
  const setSimbolo = (i: number, p: Partial<SimboloRaspa>) => {
    const sim = cfg.simbolos.map((s, k) => (k === i ? { ...s, ...p } : s));
    guardar({ ...cfg, simbolos: sim });
  };
  const setTier = (i: number, ti: number, p: Partial<{ c: number; m: number; cada: number }>) => {
    const sim = cfg.simbolos.map((s, k) => {
      if (k !== i) return s;
      return { ...s, tiers: s.tiers.map((t, x) => (x === ti ? { ...t, ...p } : t)) };
    });
    guardar({ ...cfg, simbolos: sim });
  };

  const { rtp, unoCada, premioMax } = metricasRaspa(cfg);
  const rtpPct = rtp * 100;

  const escalar = () => {
    const obj = Number(objetivo) || 94;
    if (rtpPct <= 0) return;
    const f = obj / rtpPct;
    guardar({
      ...cfg,
      simbolos: cfg.simbolos.map((s) => ({
        ...s,
        tiers: s.tiers.map((t) => ({ ...t, m: Math.round(t.m * f * 100) / 100 })),
      })),
    });
  };

  const subirA = async (file: File, aplicar: (url: string) => void) => {
    const url = await subirArchivo(file, `raspadita/${juego.id}`);
    if (url) aplicar(url);
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Grilla</strong>
        <p className="hint" style={{ marginBottom: 10 }}>
          Cuántas celdas tiene la tarjeta (siempre en 3 columnas). El servidor sortea el premio con las
          frecuencias que fijes acá abajo y arma la tarjeta que lo justifica.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {CELDAS_RASPA.map((n) => (
            <button key={n} onClick={() => guardar({ ...cfg, celdas: n })}
              className={cfg.celdas === n ? 'primary' : undefined} style={{ fontSize: 12 }}>
              {n} celdas
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Símbolos y premios</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          Por cada símbolo, un ícono (imagen, animación Lottie o emoji) y sus escalones de premio:
          <b> cuántos iguales</b> hacen falta, <b>cuánto paga</b> y <b>cada cuántas tarjetas sale</b>.
          Un símbolo sin escalones es de relleno. RTP de cada escalón = multiplicador ÷ cada.
        </p>

        {cfg.simbolos.map((s, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 0, paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <label title={s.lottie_url ? 'Cambiar · clic derecho para quitar' : 'Subir .json / .lottie'}
                onContextMenu={(e) => { e.preventDefault(); if (s.lottie_url) setSimbolo(i, { lottie_url: null }); }}
                style={{
                  width: 46, height: 46, flexShrink: 0, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
                  border: `1px dashed ${s.lottie_url ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                  color: s.lottie_url ? 'var(--accent)' : 'var(--text-dim)', background: 'var(--bg)',
                }}>
                {s.lottie_url ? '✦ anim' : 'Lottie'}
                <input type="file" accept=".json,.lottie" hidden onChange={(e) => {
                  const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(f, (url) => setSimbolo(i, { lottie_url: url }));
                }} />
              </label>
              <label title={s.icono_url ? 'Cambiar · clic derecho para quitar' : 'Subir imagen'}
                onContextMenu={(e) => { e.preventDefault(); if (s.icono_url) setSimbolo(i, { icono_url: null }); }}
                style={{
                  width: 46, height: 46, flexShrink: 0, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
                  border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'var(--text-dim)',
                  background: s.icono_url ? `center/contain no-repeat var(--bg) url("${s.icono_url}")` : 'var(--bg)',
                }}>
                {!s.icono_url && '+'}
                <input type="file" accept="image/*" hidden onChange={(e) => {
                  const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(f, (url) => setSimbolo(i, { icono_url: url }));
                }} />
              </label>
              <input type="text" maxLength={4} value={s.emoji} onChange={(e) => setSimbolo(i, { emoji: e.target.value })}
                title="Emoji si no hay imagen ni Lottie" style={{ width: 48, textAlign: 'center', fontSize: 16 }} />
              <input value={s.nombre} onChange={(e) => setSimbolo(i, { nombre: e.target.value })}
                style={{ flex: 1, minWidth: 110, fontSize: 13 }} />
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="checkbox" checked={s.wild} onChange={(e) => setSimbolo(i, { wild: e.target.checked, tiers: e.target.checked ? [] : s.tiers })} />
                comodín
              </label>
              {cfg.simbolos.length > 2 && (
                <button style={{ fontSize: 12, color: 'var(--danger)' }}
                  onClick={() => guardar({ ...cfg, simbolos: cfg.simbolos.filter((_, k) => k !== i) })}>Eliminar</button>
              )}
            </div>

            {s.wild ? (
              <p className="hint" style={{ margin: '8px 0 0', fontStyle: 'italic' }}>
                Completa cualquier símbolo en la tarjeta ganadora. No tiene premio propio ni cambia el RTP.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {s.tiers.map((t, ti) => (
                  <span key={ti} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 8, padding: '3px 6px 3px 9px', fontSize: 12,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <input type="number" min={1} max={cfg.celdas} value={t.c}
                      onChange={(e) => setTier(i, ti, { c: Math.max(1, Math.min(cfg.celdas, Number(e.target.value) || 1)) })}
                      style={{ width: 42, flexShrink: 0, textAlign: 'center', fontSize: 12 }} />
                    <span className="hint" style={{ margin: 0, flexShrink: 0 }}>iguales → ×</span>
                    <input type="number" min={0} step={0.1} value={t.m}
                      onChange={(e) => setTier(i, ti, { m: Math.max(0, Number(e.target.value) || 0) })}
                      style={{ width: 58, flexShrink: 0, textAlign: 'center', fontSize: 12 }} />
                    <span className="hint" style={{ margin: 0, flexShrink: 0 }}>· 1 cada</span>
                    <input type="number" min={1} value={t.cada}
                      onChange={(e) => setTier(i, ti, { cada: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                      style={{ width: 66, flexShrink: 0, textAlign: 'center', fontSize: 12 }} />
                    <span className="hint" style={{ margin: 0, fontSize: 10.5, flexShrink: 0 }}>
                      {t.cada > 0 ? (100 * t.m / t.cada).toFixed(1) + '%' : ''}
                    </span>
                    <button style={{ padding: '0 4px', fontSize: 13, color: 'var(--text-dim)', flexShrink: 0 }}
                      onClick={() => setSimbolo(i, { tiers: s.tiers.filter((_, x) => x !== ti) })}>×</button>
                  </span>
                ))}
                <button style={{ fontSize: 12 }} onClick={() => {
                  const last = s.tiers[s.tiers.length - 1];
                  const nc = s.tiers.length ? Math.min(cfg.celdas, Math.max(...s.tiers.map((x) => x.c)) + 1) : 3;
                  setSimbolo(i, { tiers: [...s.tiers, { c: nc, m: last ? Math.round(last.m * 2.5) : 5, cada: last ? last.cada * 5 : 40 }] });
                }}>+ escalón</button>
              </div>
            )}
          </div>
        ))}

        <button style={{ fontSize: 12, marginTop: 14 }} onClick={() => guardar({
          ...cfg,
          simbolos: [...cfg.simbolos, { nombre: 'Símbolo', emoji: '⭐', icono_url: null, lottie_url: null, wild: false, tiers: [{ c: 3, m: 5, cada: 40 }] }],
        })}>+ Agregar símbolo</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>RTP</strong>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>RTP
            <b style={{ display: 'block', fontSize: 18, color: rtpPct > 100 ? 'var(--warning)' : rtpPct >= 85 && rtpPct <= 99 ? 'var(--ok)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{rtpPct.toFixed(1)}%</b>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Ganás algo
            <b style={{ display: 'block', fontSize: 18, color: 'var(--text)' }}>{unoCada ? '1 cada ' + unoCada : '—'}</b>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Premio máximo
            <b style={{ display: 'block', fontSize: 18, color: 'var(--text)' }}>×{Math.round(premioMax * 10) / 10}</b>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            objetivo <input type="number" min={50} max={99} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} style={{ width: 56 }} /> %
            <button onClick={escalar}>Ajustar premios</button>
          </div>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          "Ajustar premios" escala todos los multiplicadores para llegar al objetivo, sin tocar las frecuencias.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Tema visual</strong>
        <p className="hint" style={{ marginBottom: 12 }}>Fondo, colores y tipografía. <b>Clásico</b> = hereda del panel.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
          {TEMAS_RASPA.map((t) => {
            const on = (cfg.tema || 'clasico') === t.id;
            return (
              <button key={t.id} onClick={() => guardar({ ...cfg, tema: t.id })} style={{
                display: 'flex', flexDirection: 'column', gap: 6, padding: 8, textAlign: 'left', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-soft)' : 'var(--surface-alt)',
              }}>
                <span style={{ display: 'flex', height: 18, borderRadius: 5, overflow: 'hidden' }}>
                  <span style={{ flex: 2, background: t.cobertura }} />
                  <span style={{ flex: 1, background: t.ganar }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{t.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <strong style={{ fontSize: 15 }}>Aspecto de la tarjeta</strong>
        <p className="hint" style={{ marginBottom: 12 }}>
          Todo opcional. El fondo de <b>toda la pantalla</b> se sube en <b>Arte</b>; acá va lo de la tarjeta en sí.
        </p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>Fondo de la tarjeta (detrás de la grilla)</div>
            <label style={{
              width: 64, height: 46, borderRadius: 10, cursor: 'pointer', border: '1px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-dim)',
              background: cfg.fondoUrl ? `center/cover no-repeat url("${cfg.fondoUrl}")` : 'var(--bg)',
            }} title="Imagen detrás de las celdas" onContextMenu={(e) => { e.preventDefault(); if (cfg.fondoUrl) guardar({ ...cfg, fondoUrl: null }); }}>
              {!cfg.fondoUrl && '+'}
              <input type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(f, (url) => guardar({ ...cfg, fondoUrl: url }));
              }} />
            </label>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Cobertura (lo que se raspa)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={cfg.cobertura.color || '#6b7280'}
                onChange={(e) => guardar({ ...cfg, cobertura: { ...cfg.cobertura, color: e.target.value } })}
                style={{ width: 34, height: 24, padding: 0 }} />
              <label style={{
                width: 46, height: 46, borderRadius: 10, cursor: 'pointer', border: '1px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-dim)',
                background: cfg.cobertura.imagen_url ? `center/cover no-repeat url("${cfg.cobertura.imagen_url}")` : 'var(--bg)',
              }} title="Textura de la cobertura" onContextMenu={(e) => { e.preventDefault(); if (cfg.cobertura.imagen_url) guardar({ ...cfg, cobertura: { ...cfg.cobertura, imagen_url: null } }); }}>
                {!cfg.cobertura.imagen_url && '+'}
                <input type="file" accept="image/*" hidden onChange={(e) => {
                  const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(f, (url) => guardar({ ...cfg, cobertura: { ...cfg.cobertura, imagen_url: url } }));
                }} />
              </label>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Marco de cada celda</div>
            <label style={{
              width: 46, height: 46, borderRadius: 10, cursor: 'pointer', border: '1px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-dim)',
              background: cfg.celda.imagen_url ? `center/100% 100% no-repeat url("${cfg.celda.imagen_url}")` : 'var(--bg)',
            }} onContextMenu={(e) => { e.preventDefault(); if (cfg.celda.imagen_url) guardar({ ...cfg, celda: { imagen_url: null } }); }}>
              {!cfg.celda.imagen_url && '+'}
              <input type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(f, (url) => guardar({ ...cfg, celda: { imagen_url: url } }));
              }} />
            </label>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Animación al ganar (Lottie)</div>
            <label style={{
              width: 46, height: 46, borderRadius: 10, cursor: 'pointer', overflow: 'hidden', fontSize: 9,
              border: `1px dashed ${cfg.animGanar_url ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cfg.animGanar_url ? 'var(--accent)' : 'var(--text-dim)', background: 'var(--bg)',
            }} onContextMenu={(e) => { e.preventDefault(); if (cfg.animGanar_url) guardar({ ...cfg, animGanar_url: null }); }}>
              {cfg.animGanar_url ? '✦ anim' : 'Lottie'}
              <input type="file" accept=".json,.lottie" hidden onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(f, (url) => guardar({ ...cfg, animGanar_url: url }));
              }} />
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
            <input type="checkbox" checked={cfg.historial.mostrar}
              onChange={(e) => guardar({ ...cfg, historial: { ...cfg.historial, mostrar: e.target.checked } })} />
            Tira de historial
          </label>
        </div>
        <p className="hint" style={{ margin: '12px 0 0' }}>
          Posición y tamaño de la tarjeta y los controles en <b>⚙ Ajustar → Controles</b>. {msg}
        </p>
      </div>
    </div>
  );
}

// ---------------- Calibración de RTP + perfiles ("modos de pago") ----------------

interface PerfilesProps {
  juego: Juego;
  simbolos: Simbolo[];
  columnasMotor: number;
  onAplicarSimbolos: (nuevos: Simbolo[]) => Promise<void>;
}

function PerfilesYCalibrado({ juego, simbolos, columnasMotor, onAplicarSimbolos }: PerfilesProps) {
  const [objetivo, setObjetivo] = useState(94);
  const [perfiles, setPerfiles] = useState<PerfilRtp[]>([]);
  const [sug, setSug] = useState<Sugerencia | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const rtpActual = simbolos.length ? analizar(simbolos, columnasMotor).rtp : 0;
  const factor = factorParaObjetivo(rtpActual, objetivo);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('perfiles_rtp').select('*').eq('juego_id', juego.id).order('orden');
    setPerfiles((data as PerfilRtp[]) || []);
  }, [juego.id]);
  useEffect(() => { cargar(); }, [cargar]);

  // Aviso contextual: el RTP del borrador se salió de banda del
  // objetivo. La sugerencia por símbolo hace decenas de análisis, así
  // que se calcula recién cuando dejás de tocar los controles.
  useEffect(() => {
    if (!simbolos.length || Math.abs(rtpActual - objetivo) <= 1) { setSug(null); return; }
    const t = setTimeout(() => setSug(sugerirCompensacion(simbolos, columnasMotor, objetivo)), 400);
    return () => clearTimeout(t);
  }, [rtpActual, objetivo, columnasMotor, simbolos]);

  const calibrar = async () => {
    setTrabajando(true);
    await onAplicarSimbolos(escalarPagos(simbolos, factorParaObjetivo(rtpActual, objetivo)));
    setTrabajando(false);
  };

  const aplicarPorSimbolo = async () => {
    if (!sug?.porSimbolo) return;
    const { nombre, campo, a } = sug.porSimbolo;
    setTrabajando(true);
    await onAplicarSimbolos(simbolos.map((s) => (s.nombre === nombre ? ({ ...s, [campo]: a } as Simbolo) : s)));
    setTrabajando(false);
  };

  const guardarPerfil = async () => {
    const nombre = prompt('Nombre del perfil (ej. Tacaño, Nivelado, Generoso):');
    if (!nombre?.trim()) return;
    let base = simbolos;
    if (confirm(`¿Calibrar los pagos a ${objetivo}% antes de guardar?\n\nCancelar = guardar tal como están (${rtpActual.toFixed(1)}%).`)) {
      base = escalarPagos(simbolos, factorParaObjetivo(rtpActual, objetivo));
      await onAplicarSimbolos(base);
    }
    const rtpGuardado = rtpDe(base, columnasMotor);
    const { error } = await supabase.from('perfiles_rtp').insert({
      juego_id: juego.id, nombre: nombre.trim(),
      rtp_objetivo: Number(rtpGuardado.toFixed(2)),
      pagos: perfilDesdeSimbolos(base),
      orden: perfiles.length,
    });
    if (error) { alert(error.message); return; }
    cargar();
  };

  const activar = async (p: PerfilRtp) => {
    const { error } = await supabase.rpc('activar_perfil', { p_perfil_id: p.id });
    if (error) { alert(error.message); return; }
    cargar();
  };
  const desactivar = async (p: PerfilRtp) => {
    await supabase.from('perfiles_rtp').update({ activo: false }).eq('id', p.id);
    cargar();
  };
  const cargarEnEditor = async (p: PerfilRtp) => {
    if (!confirm(`Cargar "${p.nombre}" en el editor: los pagos y pesos de los símbolos cambian a los de este perfil. El juego en vivo no cambia hasta que actives un perfil.`)) return;
    setTrabajando(true);
    await onAplicarSimbolos(aplicarPerfil(simbolos, p.pagos));
    setTrabajando(false);
  };
  const actualizar = async (p: PerfilRtp) => {
    if (!confirm(`Sobrescribir "${p.nombre}" con lo que estás editando ahora (${rtpActual.toFixed(1)}%)?`)) return;
    await supabase.from('perfiles_rtp').update({
      pagos: perfilDesdeSimbolos(simbolos), rtp_objetivo: Number(rtpActual.toFixed(2)),
    }).eq('id', p.id);
    cargar();
  };
  const renombrar = async (p: PerfilRtp) => {
    const nombre = prompt('Nuevo nombre:', p.nombre);
    if (!nombre?.trim()) return;
    await supabase.from('perfiles_rtp').update({ nombre: nombre.trim() }).eq('id', p.id);
    cargar();
  };
  const borrar = async (p: PerfilRtp) => {
    if (!confirm(`¿Borrar el perfil "${p.nombre}"?`)) return;
    await supabase.from('perfiles_rtp').delete().eq('id', p.id);
    cargar();
  };

  return (
    <div className="card">
      <strong style={{ fontSize: 15 }}>Calibración y perfiles de RTP</strong>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <label style={{ fontSize: 12 }}>RTP objetivo
          <input type="number" value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value) || 0)} style={{ width: 80 }} />
        </label>
        <span className="hint">actual {rtpActual.toFixed(1)}% · factor ×{factor.toFixed(3)}</span>
        <button disabled={trabajando || !simbolos.length} onClick={calibrar}>Calibrar a {objetivo}%</button>
      </div>

      {sug && (
        <div style={{ background: 'rgba(217,164,65,.12)', color: 'var(--warning)', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
          RTP en {sug.rtpActual}% (objetivo {sug.objetivo}%). Para calibrar:
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button disabled={trabajando} onClick={calibrar}>Escalar todos los pagos ×{sug.factorGlobal}</button>
            {sug.porSimbolo && (
              <button disabled={trabajando} onClick={aplicarPorSimbolo}>
                {sug.porSimbolo.campo === 'pago_cinco' ? 'x5' : 'x3'} de {sug.porSimbolo.nombre}: {sug.porSimbolo.de} → {sug.porSimbolo.a}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 14, flex: 1 }}>Perfiles guardados</strong>
        <button onClick={guardarPerfil} disabled={!simbolos.length}>+ Guardar perfil</button>
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>
        La vista previa siempre usa lo que estás editando ahora. El juego en vivo usa el perfil activo.
      </p>
      {perfiles.length === 0 && (
        <p className="hint">Todavía no guardaste ningún perfil. Calibrá los pagos y guardá "Tacaño", "Nivelado", "Generoso"…</p>
      )}
      {perfiles.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-alt)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>{p.nombre}</strong>
          {p.activo && <span className="badge listo">activo</span>}
          <span className="hint" style={{ flex: 1, minWidth: 120 }}>
            objetivo {p.rtp_objetivo ?? '—'}% · ahora {rtpDe(aplicarPerfil(simbolos, p.pagos), columnasMotor).toFixed(1)}%
          </span>
          {p.activo
            ? <button onClick={() => desactivar(p)}>Desactivar</button>
            : <button className="primary" onClick={() => activar(p)}>Activar</button>}
          <button onClick={() => cargarEnEditor(p)}>Cargar</button>
          <button onClick={() => actualizar(p)}>Actualizar</button>
          <button onClick={() => renombrar(p)}>Renombrar</button>
          <button style={{ color: 'var(--danger)' }} onClick={() => borrar(p)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Rotación automática de perfiles de RTP ----------------

function PanelRotacion({ juego }: { juego: Juego }) {
  const [perfiles, setPerfiles] = useState<PerfilRtp[]>([]);
  const [cfg, setCfg] = useState<RotacionRtp | null>(null);
  const [estado, setEstado] = useState<RotacionEstado | null>(null);
  const [historial, setHistorial] = useState<RotacionHistorialFila[]>([]);
  const [msg, setMsg] = useState('');

  const cargar = useCallback(async () => {
    const [{ data: p }, { data: c }, { data: e }, { data: h }] = await Promise.all([
      supabase.from('perfiles_rtp').select('*').eq('juego_id', juego.id).order('orden'),
      supabase.from('rotacion_rtp').select('*').eq('juego_id', juego.id).maybeSingle(),
      supabase.from('rotacion_estado').select('*').eq('juego_id', juego.id).maybeSingle(),
      supabase.from('rotacion_historial').select('*').eq('juego_id', juego.id).order('desde_ts', { ascending: false }).limit(8),
    ]);
    setPerfiles((p as PerfilRtp[]) || []);
    setCfg((c as RotacionRtp) || null);
    setEstado((e as RotacionEstado) || null);
    setHistorial((h as RotacionHistorialFila[]) || []);
  }, [juego.id]);
  useEffect(() => { cargar(); }, [cargar]);

  const cfgActual: RotacionRtp = cfg || {
    juego_id: juego.id, activa: false, noche_desde: 22, noche_hasta: 8,
    pesos_dia: {}, pesos_noche: {}, segmento_min: 20, segmento_max: 90,
  };

  const guardar = async (patch: Partial<RotacionRtp>) => {
    const next = { ...cfgActual, ...patch };
    setCfg(next);
    const { error } = await supabase.from('rotacion_rtp').upsert({
      ...next, juego_id: juego.id, actualizado: new Date().toISOString(),
    });
    setMsg(error ? error.message : 'Guardado ✓');
  };
  const setPeso = (franja: 'pesos_dia' | 'pesos_noche', perfilId: string, v: number) =>
    guardar({ [franja]: { ...cfgActual[franja], [perfilId]: v } } as Partial<RotacionRtp>);

  if (perfiles.length < 2) {
    return (
      <div className="card">
        <strong style={{ fontSize: 15 }}>Rotación automática de RTP</strong>
        <p className="hint" style={{ margin: '8px 0 0' }}>
          Guardá al menos 2 perfiles (Tacaño / Nivelado / Generoso…) arriba para poder rotarlos solos.
        </p>
      </div>
    );
  }

  const activoAhora = estado?.perfil_id ? perfiles.find((p) => p.id === estado.perfil_id) : null;
  const restanteMin = estado ? Math.max(0, Math.round((new Date(estado.hasta_ts).getTime() - Date.now()) / 60000)) : 0;

  return (
    <div className="card">
      <strong style={{ fontSize: 15 }}>Rotación automática de RTP</strong>
      <p className="hint" style={{ marginBottom: 12 }}>
        El servidor va cambiando el perfil activo solo, con horas al azar. Es global: nunca mira
        al jugador, solo el reloj.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={cfgActual.activa} onChange={(e) => guardar({ activa: e.target.checked })} style={{ width: 'auto' }} />
        Rotación activada
      </label>

      <div style={{ opacity: cfgActual.activa ? 1 : 0.45, pointerEvents: cfgActual.activa ? 'auto' : 'none' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
          <span>Noche de</span>
          <input type="number" min={0} max={23} value={cfgActual.noche_desde} onChange={(e) => guardar({ noche_desde: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })} style={{ width: 54 }} />
          <span>a</span>
          <input type="number" min={0} max={23} value={cfgActual.noche_hasta} onChange={(e) => guardar({ noche_hasta: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })} style={{ width: 54 }} />
          <span className="hint" style={{ margin: 0 }}>hs · el resto es día</span>
        </div>

        {(['pesos_dia', 'pesos_noche'] as const).map((franja) => (
          <div key={franja} style={{ marginBottom: 12 }}>
            <p className="hint" style={{ margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {franja === 'pesos_dia' ? 'Día' : 'Noche'} — cuántas veces sale cada modo
            </p>
            {perfiles.map((p) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>{p.nombre}{p.activo ? ' (activo)' : ''}</span>
                <input type="number" min={0} step={1} value={cfgActual[franja][p.id] ?? 0}
                  onChange={(e) => setPeso(franja, p.id, Math.max(0, Number(e.target.value) || 0))} style={{ width: 56 }} />
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <span>Cada tramo dura entre</span>
          <input type="number" min={5} step={5} value={cfgActual.segmento_min} onChange={(e) => guardar({ segmento_min: Math.max(5, Number(e.target.value) || 5) })} style={{ width: 58 }} />
          <span>y</span>
          <input type="number" min={10} step={5} value={cfgActual.segmento_max} onChange={(e) => guardar({ segmento_max: Math.max(10, Number(e.target.value) || 10) })} style={{ width: 58 }} />
          <span className="hint" style={{ margin: 0 }}>minutos, al azar</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <strong style={{ fontSize: 13, flex: 1 }}>Estado ahora</strong>
          <button style={{ fontSize: 12 }} onClick={cargar}>Actualizar</button>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {cfgActual.activa
            ? activoAhora
              ? `Modo ${activoAhora.nombre} · cambia en ~${restanteMin} min`
              : 'Se define en el próximo giro.'
            : 'Rotación desactivada — el perfil activo lo elegís vos arriba.'}
        </p>
        {historial.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {historial.map((h) => (
              <div key={h.id}>
                {new Date(h.desde_ts).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {' · '}{h.perfil_nombre || '—'}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="hint">{msg}</p>
    </div>
  );
}

interface FilaSimboloProps {
  s: Simbolo;
  i: number;
  columnasMotor: number;
  expandido: boolean;
  onCampo: (campo: string, valor: string) => void;
  onGuardar: () => void;
  onBorrar: () => void;
  onIcono: (f: File) => void;
  onToggleRive: () => void;
  onLottie: (campo: 'lottie_chico_url' | 'lottie_grande_url', f: File) => void;
  onQuitarLottie: (campo: 'lottie_chico_url' | 'lottie_grande_url') => void;
}

function FilaSimbolo({ s, i, columnasMotor, expandido, onCampo, onGuardar, onBorrar, onIcono, onToggleRive, onLottie, onQuitarLottie }: FilaSimboloProps) {
  const campo = (nombre: string, valor: number | string, ancho: number, etiqueta?: string) => (
    <label style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
      {etiqueta}
      <input
        type={etiqueta ? 'number' : 'text'}
        value={valor}
        onChange={(e) => onCampo(nombre, e.target.value)}
        onBlur={onGuardar}
        style={{ width: ancho }}
      />
    </label>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-alt)', borderRadius: 8, padding: 8 }}>
        <label style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', flexShrink: 0, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.icono_url
            ? <img src={s.icono_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span style={{ width: 14, height: 14, borderRadius: '50%', background: COLORES[i % COLORES.length] }} />}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onIcono(e.target.files[0])} />
        </label>
        <input value={s.nombre} onChange={(e) => onCampo('nombre', e.target.value)} onBlur={onGuardar} style={{ flex: 1, minWidth: 80 }} />
        {campo('peso', s.peso, 55, 'peso')}
        {campo('pago_tres', s.pago_tres, 65, 'x3')}
        {campo('pago_dos', s.pago_dos, 55, 'x2')}
        {columnasMotor >= 4 && campo('pago_cuatro', s.pago_cuatro ?? 0, 65, 'x4')}
        {columnasMotor >= 5 && campo('pago_cinco', s.pago_cinco ?? 0, 65, 'x5')}
        <button
          aria-label="Animación del símbolo"
          onClick={onToggleRive}
          style={(s.lottie_chico_url || s.lottie_grande_url) ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
        >🎬</button>
        <button aria-label="Quitar" onClick={onBorrar}>✕</button>
      </div>
      {expandido && (
        <div style={{ background: 'var(--surface-alt)', borderRadius: 8, padding: 10, margin: '-6px 0 4px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 150 }}>
            <p className="hint" style={{ margin: '0 0 3px' }}>Premio chico (dos/tres iguales)</p>
            <input type="file" accept=".json,.lottie" style={{ display: 'block' }} onChange={(e) => e.target.files?.[0] && onLottie('lottie_chico_url', e.target.files[0])} />
            {s.lottie_chico_url && <button style={{ fontSize: 11, marginTop: 3 }} onClick={() => onQuitarLottie('lottie_chico_url')}>Quitar</button>}
          </div>
          <div style={{ minWidth: 150 }}>
            <p className="hint" style={{ margin: '0 0 3px' }}>Premio mayor</p>
            <input type="file" accept=".json,.lottie" style={{ display: 'block' }} onChange={(e) => e.target.files?.[0] && onLottie('lottie_grande_url', e.target.files[0])} />
            {s.lottie_grande_url && <button style={{ fontSize: 11, marginTop: 3 }} onClick={() => onQuitarLottie('lottie_grande_url')}>Quitar</button>}
          </div>
        </div>
      )}
    </>
  );
}

interface SubirImagenProps {
  juego: Juego;
  campo: string;
  etiqueta: string;
  posicionable?: boolean;
  reset?: Record<string, number>;
  onSet: (campo: string, url: string | null, reset?: Record<string, number>) => void;
}

function SubirImagen({ juego, campo, etiqueta, posicionable, reset, onSet }: SubirImagenProps) {
  const url = juego[campo] as string | null | undefined;

  const subir = async (archivo: File) => {
    const nuevaUrl = await subirArchivo(archivo, `${campo}/${juego.id}`);
    if (nuevaUrl) onSet(campo, nuevaUrl);
  };

  const quitar = () => {
    if (!confirm(`¿Quitar ${etiqueta.toLowerCase()}?`)) return;
    onSet(campo, null, reset);
  };

  return (
    <div style={{ maxWidth: 170 }}>
      <p className="hint" style={{ margin: '0 0 6px' }}>{etiqueta}</p>
      <label
        style={{
          display: 'flex', aspectRatio: '1', borderRadius: 10, border: '1px dashed var(--border)',
          background: url && !posicionable ? `center/cover url('${url}')` : 'var(--surface-alt)',
          cursor: 'pointer', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}
      >
        {posicionable && url && <img src={url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        {!url && <span className="hint">Subir imagen</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
      </label>
      {url && <button style={{ width: '100%', marginTop: 8, color: 'var(--danger)' }} onClick={quitar}>Quitar imagen</button>}
    </div>
  );
}
