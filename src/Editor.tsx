import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { supabase } from './supabase.ts';
import { analizar } from './motor.ts';
import { cargarMotor, MOTORES_DISPONIBLES } from '../motor/registro.js';
import { subirArchivo } from './juego/subir.ts';
import {
  rtpDe, escalarPagos, factorParaObjetivo, aplicarPerfil,
  perfilDesdeSimbolos, sugerirCompensacion,
} from './juego/calibracion.ts';
import type { Sugerencia } from './juego/calibracion.ts';
import { listarClientesActivos } from './Clientes.tsx';
import { Preview } from './Preview.tsx';
import { PreviewMines } from './PreviewMines.tsx';
import { simularMines } from '../motor/mines-clasico.js';
import type {
  ClienteActivo, Efecto, EstadoJuego, Juego, PerfilRtp, Simbolo, Sonido,
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
    if (esMines) return;
    let vivo = true;
    cargarMotor(juego.motor).then((mod) => { if (vivo) setColumnasMotor(mod.COLUMNAS || 3); });
    return () => { vivo = false; };
  }, [juego.motor, esMines]);

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
  const rtpReal = simbolos.length ? analizar(simbolos, columnasMotor).rtp : 0;

  const margenMinesOk = (() => {
    const m = Number(juego.mines_margen_pct ?? 0.03);
    return m >= 0 && m < 1;
  })();

  const puntos: Record<GrupoId, boolean> = {
    general: Number(juego.min_bet) <= 0 || Number(juego.max_bet) < Number(juego.min_bet),
    arte: !juego.portada_url,
    jugabilidad: esMines
      ? !margenMinesOk
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
    if (!esMines && !sonidos.length) avisos.push('Sin sonidos cargados.');
    const x = Number(juego.girar_x ?? 50), y = Number(juego.girar_y ?? 90);
    if (!esMines && (x < 0 || x > 100 || y < 0 || y > 100)) avisos.push('El botón de girar quedó fuera de la pantalla.');
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
          <span className="ed-resumen-chip">RTP {simbolos.length ? rtpReal.toFixed(1) + '%' : '--'}</span>
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
            <SubirImagen juego={juego} campo="fondo_url" etiqueta="Fondo del rodillo" onSet={setImagen} />
            <SubirImagen juego={juego} campo="fondo_pantalla_url" etiqueta="Fondo de pantalla" posicionable reset={{ fondo_pantalla_x: 50, fondo_pantalla_y: 50, fondo_pantalla_ancho: 100, fondo_pantalla_alto: 100 }} onSet={setImagen} />
            <SubirImagen juego={juego} campo="marco_url" etiqueta="Marco" posicionable reset={{ marco_x: 50, marco_y: 50, marco_ancho: 100, marco_alto: 100 }} onSet={setImagen} />
            <SubirImagen juego={juego} campo="cartel_url" etiqueta="Cartel" posicionable reset={{ cartel_x: 50, cartel_y: 15, cartel_ancho: 75, cartel_alto: 16 }} onSet={setImagen} />
            <SubirImagen juego={juego} campo="portada_url" etiqueta="Portada (catálogo)" onSet={setImagen} />
            <SubirImagen juego={juego} campo="carga_url" etiqueta="Pantalla de carga" onSet={setImagen} />
          </div>
        </div>
      )}

      {grupo === 'jugabilidad' && esMines && (
        <SeccionMines juego={juego} onImagen={setImagen} onCampo={guardarCampoJuego} />
      )}

      {grupo === 'jugabilidad' && !esMines && (
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
  onImagen: (campo: string, url: string | null) => void | Promise<void>;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
}

function SeccionMines({ juego, onImagen, onCampo }: SeccionMinesProps) {
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
        <strong style={{ fontSize: 15 }}>Caras de la casilla</strong>
        <p className="hint" style={{ marginBottom: 14 }}>Opcional. Sin imagen, cada cara se ve con un estilo por defecto.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 14 }}>
          <SubirImagen juego={juego} campo="mines_casilla_oculta_url" etiqueta="Casilla tapada" posicionable onSet={onImagen} />
          <SubirImagen juego={juego} campo="mines_casilla_segura_url" etiqueta="Casilla segura" posicionable onSet={onImagen} />
          <SubirImagen juego={juego} campo="mines_casilla_mina_url" etiqueta="Mina" posicionable onSet={onImagen} />
        </div>
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
