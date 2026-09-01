import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { crearEscenario } from './juego/escenario.ts';
import { Raspadita } from './Raspadita.tsx';
import { RaspaditaMesa } from './RaspaditaMesa.tsx';
import { AjustePanel } from './AjustePanel.tsx';
import { AjusteRaspaControles } from './AjusteRaspaControles.tsx';
import { cfgDe, estadoInicial, posControlesRaspaDe, jugarLocal } from './juego/raspadita.ts';
import { temaRaspaDe } from './juego/raspadita-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { AnimacionLottie, CadenaLuz, CapaLibre, EstadoRaspa, Juego, PosControlesRaspa, TiradaRaspa } from './types.ts';

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };
const SALDO_DEMO = 10000;

// Vista previa de la raspadita: corre el motor localmente con plata
// de mentira. Arte y controles se editan en vivo desde ⚙ Ajustar.
export function PreviewRaspadita({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);

  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaRaspaDe(cfg.tema), [cfg.tema]);
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [tab, setTab] = useState<'controles' | 'arte'>('controles');
  const [posCtl, setPosCtl] = useState<PosControlesRaspa>(() => posControlesRaspaDe(cfg));
  const [estado, setEstado] = useState<EstadoRaspa>(() => estadoInicial(minBet, SALDO_DEMO));
  const [tirada, setTirada] = useState<TiradaRaspa | null>(null);
  const [revelado, setRevelado] = useState(false);

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
        modo: 'preview', esRaspadita: true, juego, motor: MOTOR_STUB,
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

  const comprar = () => {
    setEstado((e) => {
      if ((tirada && !revelado) || e.saldo < e.apuesta) return e;
      setRevelado(false);
      setTirada(jugarLocal(cfg));
      return { ...e, saldo: e.saldo - e.apuesta, error: null };
    });
  };

  const revelar = (mult: number) => {
    setEstado((e) => ({
      ...e,
      saldo: e.saldo + Math.round(e.apuesta * mult),
      historial: [mult, ...e.historial].slice(0, 30),
    }));
    setRevelado(true);
  };

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="hint">plata de mentira</span>
        <button onClick={() => setMostrarPanel((v) => !v)}>⚙ Ajustar</button>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>

      <div ref={hostRef} />

      {listo && escRef.current && (
        <>
          <Raspadita
            escenario={escRef.current} juego={juego} cfg={cfg} tema={tema} pos={posCtl}
            tirada={tirada} apuesta={estado.apuesta} onRevelar={revelar}
          />
          <RaspaditaMesa
            escenario={escRef.current} cfg={cfg} pos={posCtl} estado={estado}
            minBet={minBet} maxBet={maxBet} pasoApuesta={paso} raspando={!!tirada && !revelado}
            onComprar={comprar}
            onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
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
            : <AjusteRaspaControles juego={juego} escenario={escRef.current} pos={posCtl} onChange={setPosCtl} />}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
