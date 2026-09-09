import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { cargarMotor, resolverNivel } from '../motor/registro.js';
import { mostrarTablaPagos } from './tabla-pagos.ts';
import { crearEscenario } from './juego/escenario.ts';
import { crearRodillosPreview } from './juego/rodillos-preview.ts';
import { AjustePanel } from './AjustePanel.tsx';
import { FichasEnEscenario } from './Fichas.tsx';
import { fichasConDefaults, parcheFichas } from '../motor/fichas.js';
import type { Escenario } from './juego/escenario.ts';
import type { RodillosPreview } from './juego/rodillos-preview.ts';
import type {
  AnimacionLottie, Boton, CadenaLuz, CapaLibre, Digito, Efecto, Ficha, Juego,
  MotorModulo, PremioVisual, ResultadoGiro, Simbolo, Sonido,
} from './types.ts';

interface PreviewProps {
  juego: Juego;
  simbolos: Simbolo[];
  sonidos: Sonido[];
  efectos: Efecto[];
  onClose: () => void;
}

const ETIQUETA_CADENA: Record<number, string> = { 2: 'Dos iguales', 3: 'Tres iguales', 4: 'Cuatro iguales', 5: 'Cinco iguales' };

export function Preview({ juego, simbolos, sonidos, efectos, onClose }: PreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const rodRef = useRef<RodillosPreview | null>(null);
  const motorRef = useRef<MotorModulo | null>(null);
  const forzadoRef = useRef<ResultadoGiro | null>(null);

  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [mostrarProbador, setMostrarProbador] = useState(false);
  const [fichas, setFichas] = useState<Ficha[]>(() => fichasConDefaults(juego.fichas_cfg).fichas);
  const guardarFichas = (fs: Ficha[]) => {
    setFichas(fs);
    const next = parcheFichas(juego, fs);
    supabase.from('juegos').update({ fichas_cfg: next }).eq('id', juego.id).then(() => {});
    (juego as { fichas_cfg?: unknown }).fichas_cfg = next;
  };

  useEffect(() => {
    if (!simbolos.length) { alert('Agregá símbolos antes de probar el juego.'); onClose(); return; }

    let cancelado = false;
    let esc: Escenario | null = null;

    (async () => {
      const motor = await cargarMotor(juego.motor);
      const [
        { data: premios }, { data: digitos }, { data: capasLibres },
        { data: animaciones }, { data: cadenasLuces }, { data: botones },
      ] = await Promise.all([
        supabase.from('premios_visuales').select('*').eq('juego_id', juego.id),
        supabase.from('digitos').select('*').eq('juego_id', juego.id),
        supabase.from('capas_libres').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('animaciones_lottie').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('cadenas_luces').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('botones').select('*').eq('juego_id', juego.id),
      ]);
      if (cancelado || !hostRef.current) return;

      esc = crearEscenario({
        modo: 'preview', juego, simbolos, sonidos, efectos, motor,
        premios: (premios as PremioVisual[]) || [],
        digitos: (digitos as Digito[]) || [],
        capasLibres: (capasLibres as CapaLibre[]) || [],
        animaciones: (animaciones as AnimacionLottie[]) || [],
        cadenasLuces: (cadenasLuces as CadenaLuz[]) || [],
        botones: (botones as Boton[]) || [],
      });
      escRef.current = esc;
      motorRef.current = motor;
      hostRef.current.appendChild(esc.wrap);

      const rod = crearRodillosPreview(esc, motor, simbolos);
      rodRef.current = rod;
      requestAnimationFrame(rod.pintarGrillaInicial);

      esc.btnGirar.addEventListener('click', girar);
      esc.el.querySelector('[data-info]')!.addEventListener('click', () => {
        if (escRef.current) mostrarTablaPagos(escRef.current.el, simbolos, juego);
      });

      setListo(true);
    })();

    return () => { cancelado = true; esc?.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const girar = async () => {
    const esc = escRef.current, rod = rodRef.current;
    if (!esc || !rod || esc.girando) return;
    if (esc.saldo < esc.apuesta) { alert('Sin saldo de prueba. Cerrá y volvé a abrir.'); return; }

    esc.girando = true;
    esc.btnGirar.disabled = true;
    esc.ocultarPremio();

    if (esc.audios.musica_fondo && esc.audios.musica_fondo.paused) esc.audios.musica_fondo.play().catch(() => {});
    if (esc.audios.giro) { esc.audios.giro.currentTime = 0; esc.audios.giro.play().catch(() => {}); }

    esc.saldo -= esc.apuesta;
    const forzado = forzadoRef.current;
    forzadoRef.current = null;
    await rod.girar(forzado);

    esc.girando = false;
    esc.btnGirar.disabled = false;
  };

  const probar = (simboloIdx: number, cadena: number) => {
    const esc = escRef.current, motor = motorRef.current;
    if (!esc || !motor || esc.girando) return;
    const simbolo = simbolos[simboloIdx];
    if (!simbolo) return;

    const otro = simbolos.find((s) => s.nombre !== simbolo.nombre) || simbolo;
    const alAzar = () => simbolos[Math.floor(Math.random() * simbolos.length)];
    const { FILAS, FILA_PAGO, COLUMNAS } = motor;
    const columnaCon = (medio: Simbolo) => Array.from({ length: FILAS }, (_, fila) => (fila === FILA_PAGO ? medio : alAzar()));
    const grillaForzada = Array.from({ length: COLUMNAS }, (_, col) => columnaCon(col < cadena ? simbolo : otro));

    const { premio, nivel } = resolverNivel(simbolos, simbolo, cadena, COLUMNAS);
    if (!nivel) { alert('Ese símbolo no tiene pago configurado para esa combinación.'); return; }

    forzadoRef.current = {
      grilla: grillaForzada, premio, nivel,
      simbolosGanadores: Array.from({ length: cadena }, (_, i) => i),
      filaPago: FILA_PAGO,
    };
    setMostrarProbador(false);
    esc.btnGirar.click();
  };

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8, width: 420, position: 'relative', zIndex: 50 }}>
          <button onClick={() => setMostrarPanel((v) => !v)}>⚙ Ajustar posición</button>
          <button onClick={() => setMostrarProbador((v) => !v)}>🎯 Probar premio</button>
          <button onClick={onClose}>✕ Cerrar prueba</button>
        </div>
        <div ref={hostRef} />
        {listo && escRef.current && (
          <FichasEnEscenario
            juego={juego} escenario={escRef.current} fichas={fichas}
            editable
            onMover={(i, x, y) => guardarFichas(fichas.map((f, k) => (k === i ? { ...f, x, y } : f)))}
          />
        )}
      </div>

      {listo && mostrarPanel && escRef.current && (
        <AjustePanel
          escenario={escRef.current}
          juego={juego}
          simbolos={simbolos}
          onGrillaCambio={() => rodRef.current?.pintarGrillaInicial()}
        />
      )}

      {mostrarProbador && listo && (
        <Probador simbolos={simbolos} columnas={motorRef.current?.COLUMNAS || 3} onProbar={probar} />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

function Probador({ simbolos, columnas, onProbar }: { simbolos: Simbolo[]; columnas: number; onProbar: (s: number, c: number) => void }) {
  const [simbolo, setSimbolo] = useState(0);
  const [cadena, setCadena] = useState(2);
  return (
    <div className="card" style={{ position: 'fixed', zIndex: 60, top: 70, left: '50%', transform: 'translateX(-50%)', width: 260 }}>
      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Probar premio</p>
      <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Símbolo
        <select style={{ width: '100%' }} value={simbolo} onChange={(e) => setSimbolo(Number(e.target.value))}>
          {simbolos.map((s, i) => <option key={i} value={i}>{s.nombre}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 10, fontSize: 12 }}>Combinación
        <select style={{ width: '100%' }} value={cadena} onChange={(e) => setCadena(Number(e.target.value))}>
          {Array.from({ length: columnas - 1 }, (_, i) => i + 2).map((c) => (
            <option key={c} value={c}>{ETIQUETA_CADENA[c] || c + ' iguales'}</option>
          ))}
        </select>
      </label>
      <button className="primary" style={{ width: '100%' }} onClick={() => onProbar(simbolo, cadena)}>Simular</button>
      <p className="hint" style={{ marginTop: 8 }}>Gira igual que de verdad y dispara todo lo que tenga ese premio.</p>
    </div>
  );
}
