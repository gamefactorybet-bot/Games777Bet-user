import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { crearEscenario } from './juego/escenario.ts';
import { Crash } from './Crash.tsx';
import { CrashMesa } from './CrashMesa.tsx';
import { AjustePanel } from './AjustePanel.tsx';
import { AjusteCrashControles } from './AjusteCrashControles.tsx';
import { cfgDe, estadoInicial, posControlesCrashDe, resolverRetiro, sortearReventon } from './juego/crash.ts';
import { temaCrashDe } from './juego/crash-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { AnimacionLottie, CadenaLuz, CapaLibre, EstadoCrash, Juego, PosControlesCrash } from './types.ts';

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };
const SALDO_DEMO = 10000;

// Vista previa del Crash: corre el motor localmente con plata de
// mentira. El escenario (arte, luces) y los controles se editan en
// vivo desde ⚙ Ajustar.
export function PreviewCrash({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const crashRef = useRef(0);
  const multVivoRef = useRef(1);
  const cerrarTimer = useRef<number | undefined>(undefined);

  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaCrashDe(cfg.tema), [cfg.tema]);
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [tab, setTab] = useState<'controles' | 'arte'>('controles');
  const [posCtl, setPosCtl] = useState<PosControlesCrash>(() => posControlesCrashDe(cfg));
  const [estado, setEstado] = useState<EstadoCrash>(() => estadoInicial(minBet, SALDO_DEMO, cfg));

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
        modo: 'preview', esCrash: true, juego, motor: MOTOR_STUB,
        simbolos: [], sonidos: [], efectos: [], premios: [], digitos: [], botones: [],
        cadenasLuces: (cadenasLuces as CadenaLuz[]) || [],
        capasLibres: (capasLibres as CapaLibre[]) || [],
        animaciones: (animaciones as AnimacionLottie[]) || [],
      });
      escRef.current = esc;
      hostRef.current.appendChild(esc.wrap);
      setListo(true);
    })();
    return () => { cancelado = true; window.clearTimeout(cerrarTimer.current); esc?.destruir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apostar = () => {
    setEstado((e) => {
      if (e.fase !== 'inactiva' || e.saldo < e.apuesta) return e;
      crashRef.current = sortearReventon(cfg);
      multVivoRef.current = 1;
      return {
        ...e, fase: 'en_curso', saldo: e.saldo - e.apuesta, multiplicador: 1,
        roundId: crypto.randomUUID(), inicioTs: Date.now(), reventadoEn: null, ganancia: null, error: null,
      };
    });
  };

  const cerrarRonda = (objetivoAuto?: number) => {
    setEstado((e) => {
      if (e.fase !== 'en_curso' || e.inicioTs == null) return e;
      const r = resolverRetiro({
        inicioTs: e.inicioTs, ahoraTs: Date.now(), puntoCrash: crashRef.current,
        apuesta: e.apuesta, cfg, objetivoAuto,
      });
      const hist = [r.reventadoEn, ...e.historial].slice(0, 30);
      window.clearTimeout(cerrarTimer.current);
      cerrarTimer.current = window.setTimeout(nueva, r.gano ? 1800 : 2100);
      return r.gano
        ? { ...e, fase: 'retirada', multiplicador: r.multiplicador, ganancia: r.premio, saldo: e.saldo + r.premio, reventadoEn: r.reventadoEn, historial: hist }
        : { ...e, fase: 'reventada', multiplicador: r.multiplicador, ganancia: 0, reventadoEn: r.reventadoEn, historial: hist };
    });
  };

  const nueva = () => setEstado((e) => (
    e.fase === 'en_curso' ? e
      : { ...estadoInicial(e.apuesta, e.saldo < e.apuesta ? SALDO_DEMO : e.saldo, cfg), autoActivo: e.autoActivo, autoObjetivo: e.autoObjetivo, historial: e.historial }
  ));

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="hint">plata de mentira · RTP {(cfg.rtp * 100).toFixed(1)}%</span>
        <button onClick={() => setMostrarPanel((v) => !v)}>⚙ Ajustar</button>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>

      <div ref={hostRef} />

      {listo && escRef.current && (
        <>
          <Crash
            escenario={escRef.current} cfg={cfg} tema={tema} pos={posCtl} estado={estado}
            multVivoRef={multVivoRef}
            onAuto={(obj) => cerrarRonda(obj)}
            onTope={() => cerrarRonda()}
          />
          <CrashMesa
            escenario={escRef.current} cfg={cfg} pos={posCtl} estado={estado}
            minBet={minBet} maxBet={maxBet} pasoApuesta={paso}
            onApostar={apostar}
            onRetirar={() => cerrarRonda()}
            onNueva={nueva}
            onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
            onCambiarAuto={(activo, objetivo) => setEstado((e) => ({ ...e, autoActivo: activo, autoObjetivo: objetivo }))}
          />
        </>
      )}

      {listo && mostrarPanel && escRef.current && (
        <div style={{ position: 'relative', zIndex: 50 }}>
          <div className="grupo-nav" style={{ marginBottom: 8 }}>
            <button className={`grupo-btn ${tab === 'controles' ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setTab('controles')}>Controles</button>
            <button className={`grupo-btn ${tab === 'arte' ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setTab('arte')}>Arte / luces</button>
          </div>
          {tab === 'arte'
            ? <AjustePanel escenario={escRef.current} juego={juego} simbolos={[]} onGrillaCambio={() => {}} categorias={['capas', 'extras']} esMines />
            : <AjusteCrashControles juego={juego} escenario={escRef.current} pos={posCtl} onChange={setPosCtl} />}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
