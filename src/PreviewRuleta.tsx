import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { crearEscenario } from './juego/escenario.ts';
import { cargarMotor } from '../motor/registro.js';
import { RuletaJuego } from './RuletaJuego.tsx';
import { FichasEnEscenario } from './Fichas.tsx';
import { AjustePanel, ControlesAuto } from './AjustePanel.tsx';
import { fichasConDefaults, parcheFichas } from '../motor/fichas.js';
import { planillaJson } from './juego/planilla.ts';
import type { Escenario } from './juego/escenario.ts';
import type { MotorModulo } from './types.ts';
import type { ResueltoRuleta } from './RuletaJuego.tsx';
import type { AnimacionLottie, CadenaLuz, CapaLibre, Ficha, Juego, Simbolo } from './types.ts';

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Vista previa de la Ruleta: corre el motor real (`motor/ruleta.js`)
// localmente, con plata de mentira. El arte, las luces y las capas
// libres se editan en vivo desde el panel.
export function PreviewRuleta({ juego, simbolos, onClose }: {
  juego: Juego;
  simbolos: Simbolo[];
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const motorRef = useRef<MotorModulo | null>(null);
  const simbolosRef = useRef(simbolos);
  simbolosRef.current = simbolos;

  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [fichas, setFichas] = useState<Ficha[]>(() => fichasConDefaults(juego.fichas_cfg).fichas);
  const [planillaRev, setPlanillaRev] = useState(0);
  const guardarFichas = (fs: Ficha[]) => {
    setFichas(fs);
    const next = parcheFichas(juego, fs);
    supabase.from('juegos').update({ fichas_cfg: next }).eq('id', juego.id).then(() => {});
    (juego as { fichas_cfg?: unknown }).fichas_cfg = next;
  };

  useEffect(() => {
    let cancelado = false;
    let esc: Escenario | null = null;
    (async () => {
      motorRef.current = await cargarMotor('ruleta');
      const [{ data: cadenasLuces }, { data: capasLibres }, { data: animaciones }] = await Promise.all([
        supabase.from('cadenas_luces').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('capas_libres').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('animaciones_lottie').select('*').eq('juego_id', juego.id).order('orden'),
      ]);
      if (cancelado || !hostRef.current) return;

      esc = crearEscenario({
        modo: 'preview', esRuleta: true, juego, motor: MOTOR_STUB,
        simbolos: [], sonidos: [], efectos: [], premios: [], digitos: [], botones: [],
        cadenasLuces: (cadenasLuces as CadenaLuz[]) || [],
        capasLibres: (capasLibres as CapaLibre[]) || [],
        animaciones: (animaciones as AnimacionLottie[]) || [],
      });
      escRef.current = esc;
      esc.saldo = 10000;
      esc.saldoEl.textContent = '10.000';
      hostRef.current.appendChild(esc.wrap);
      setListo(true);
    })();
    return () => { cancelado = true; esc?.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolver = async (apuesta: number): Promise<ResueltoRuleta> => {
    const r = motorRef.current!.girar(simbolosRef.current) as unknown as {
      grilla: { slots: ResueltoRuleta['slots']; ganadora: number };
      premio: number; // multiplicador
      nivel: ResueltoRuleta['nivel'];
    };
    const esc = escRef.current!;
    const ganancia = r.premio * apuesta;
    return {
      slots: r.grilla.slots, ganadora: r.grilla.ganadora,
      premio: ganancia, nivel: r.nivel, saldo: esc.saldo - apuesta + ganancia,
    };
  };

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="hint">plata de mentira</span>
        <button onClick={() => setMostrarPanel((v) => !v)}>⚙ Ajustar</button>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>

      <div ref={hostRef} />

      {listo && escRef.current && (
        <>
          <RuletaJuego escenario={escRef.current} simbolos={simbolos} resolver={resolver} onAutoMovido={() => setPlanillaRev((n) => n + 1)} />
          <FichasEnEscenario
            juego={juego} escenario={escRef.current} fichas={fichas}
            editable
            onMover={(i, x, y) => guardarFichas(fichas.map((f, k) => (k === i ? { ...f, x, y } : f)))}
          />
        </>
      )}

      {listo && mostrarPanel && escRef.current && (
        <div style={{ position: 'relative', zIndex: 50 }}>
          <AjustePanel
            escenario={escRef.current}
            juego={juego}
            simbolos={[]}
            onGrillaCambio={() => {}}
            categorias={['capas', 'extras']}
            esMines
          />
          <ControlesAuto
            escenario={escRef.current}
            juego={juego}
            onPlanilla={() => setPlanillaRev((n) => n + 1)}
          />
          <button style={{ width: '100%', marginTop: 8 }} onClick={() => {
            const esc = escRef.current;
            if (!esc) return;
            supabase.from('juegos').update({ planilla: planillaJson(esc.planilla) }).eq('id', juego.id).then(() => {});
          }}>Guardar Auto</button>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
