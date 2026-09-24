import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { crearEscenario } from './juego/escenario.ts';
import { RuletaBotones } from './RuletaBotones.tsx';
import { AjustePanel } from './AjustePanel.tsx';
import { AjusteRuletaControles } from './AjusteRuletaControles.tsx';
import { cfgDe, girarBotonesLocal, posControlesRuletaDe } from './juego/ruleta-botones.ts';
import type { Escenario } from './juego/escenario.ts';
import type { GiroBotones } from './RuletaBotones.tsx';
import type { AnimacionLottie, CadenaLuz, CapaLibre, Juego, PosControlesRuleta } from './types.ts';

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };

// Vista previa de la Ruleta de botones: corre el motor real
// (`motor/ruleta-botones.js`) localmente, con plata de mentira.
export function PreviewRuletaBotones({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [tab, setTab] = useState<'controles' | 'arte'>('controles');
  const cfg = cfgDe(juego);
  const [posCtl, setPosCtl] = useState<PosControlesRuleta>(() => posControlesRuletaDe(cfg));
  const [planillaRev, setPlanillaRev] = useState(0);

  useEffect(() => {
    let cancelado = false;
    let esc: Escenario | null = null;
    (async () => {
      const [{ data: cadenasLuces }, { data: capasLibres }, { data: animaciones }] = await Promise.all([
        supabase.from('cadenas_luces').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('capas_libres').select('*').eq('juego_id', juego.id).order('orden'),
        supabase.from('animaciones_lottie').select('*').eq('juego_id', juego.id).order('orden'),
      ]);
      if (cancelado || !hostRef.current) return;
      esc = crearEscenario({
        modo: 'preview', esRuletaBotones: true, juego, motor: MOTOR_STUB,
        simbolos: [], sonidos: [], efectos: [], premios: [], digitos: [], botones: [],
        cadenasLuces: (cadenasLuces as CadenaLuz[]) || [],
        capasLibres: (capasLibres as CapaLibre[]) || [],
        animaciones: (animaciones as AnimacionLottie[]) || [],
      });
      escRef.current = esc;
      hostRef.current.appendChild(esc.wrap);
      setListo(true);
    })();
    return () => { cancelado = true; esc?.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolver = async (apuestas: Record<number, number>, saldoActual: number): Promise<GiroBotones> => {
    const resultado = girarBotonesLocal(juego.ruleta_botones_cfg || {}, apuestas);
    return { resultado, saldo: saldoActual + resultado.premio };
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
        <RuletaBotones escenario={escRef.current} cfg={cfg} pos={posCtl} saldoInicial={10000} resolver={resolver} onAutoMovido={() => setPlanillaRev((n) => n + 1)} />
      )}

      {listo && mostrarPanel && escRef.current && (
        <div style={{ position: 'relative', zIndex: 50 }}>
          <div className="grupo-nav" style={{ marginBottom: 8 }}>
            <button className={`grupo-btn ${tab === 'controles' ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setTab('controles')}>Controles</button>
            <button className={`grupo-btn ${tab === 'arte' ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setTab('arte')}>Arte / luces</button>
          </div>
          {tab === 'arte'
            ? <AjustePanel escenario={escRef.current} juego={juego} simbolos={[]} onGrillaCambio={() => {}} categorias={['capas', 'extras']} esMines />
            : <AjusteRuletaControles juego={juego} escenario={escRef.current} pos={posCtl} onChange={setPosCtl} onPlanilla={() => setPlanillaRev((n) => n + 1)} />}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
