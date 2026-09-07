import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { crearEscenario } from './juego/escenario.ts';
import { Plinko } from './Plinko.tsx';
import { PlinkoMesa } from './PlinkoMesa.tsx';
import { Fichas } from './Fichas.tsx';
import { fichasConDefaults } from '../motor/fichas.js';
import { AjustePanel } from './AjustePanel.tsx';
import { AjustePlinkoControles } from './AjustePlinkoControles.tsx';
import { cfgDe, estadoInicial, posControlesPlinkoDe, tirarLocal } from './juego/plinko.ts';
import { temaPlinkoDe } from './juego/plinko-temas.ts';
import type { Escenario } from './juego/escenario.ts';
import type { AnimacionLottie, CadenaLuz, CapaLibre, EstadoPlinko, Ficha, Juego, PosControlesPlinko, TiradaResuelta } from './types.ts';

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };
const SALDO_DEMO = 10000;

// Vista previa del Plinko: corre el motor localmente con plata de
// mentira. Arte y controles se editan en vivo desde ⚙ Ajustar.
export function PreviewPlinko({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);

  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaPlinkoDe(cfg.tema), [cfg.tema]);
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;

  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [tab, setTab] = useState<'controles' | 'arte'>('controles');
  const [posCtl, setPosCtl] = useState<PosControlesPlinko>(() => posControlesPlinkoDe(cfg));
  const [ajusteElem, setAjusteElem] = useState('boton');
  const [fichas, setFichas] = useState<Ficha[]>(() => fichasConDefaults(juego.fichas_cfg).fichas);
  const sinCaja = fichas.length > 0 && !!fichasConDefaults(juego.fichas_cfg).sinCaja;
  const modoFichas = fichasConDefaults(juego.fichas_cfg).modo;
  const guardarFichas = (fs: Ficha[]) => {
    setFichas(fs);
    const next = { fichas: fs, sinCaja: !!fichasConDefaults(juego.fichas_cfg).sinCaja, modo: fichasConDefaults(juego.fichas_cfg).modo };
    supabase.from('juegos').update({ fichas_cfg: next }).eq('id', juego.id).then(() => {});
    (juego as { fichas_cfg?: unknown }).fichas_cfg = next;
  };
  const [estado, setEstado] = useState<EstadoPlinko>(() => estadoInicial(minBet, SALDO_DEMO, cfg));
  const [tirada, setTirada] = useState<TiradaResuelta | null>(null);

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
        modo: 'preview', esPlinko: true, juego, motor: MOTOR_STUB,
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

  const soltar = () => {
    setEstado((e) => {
      if (tirada || e.saldo < e.apuesta) return e;
      const t = tirarLocal(cfg, e.filas, e.riesgo);
      setTirada(t);
      return { ...e, saldo: e.saldo - e.apuesta, error: null };
    });
  };

  const alCaer = (mult: number) => {
    setEstado((e) => ({
      ...e,
      saldo: e.saldo + Math.round(e.apuesta * mult),
      historial: [mult, ...e.historial].slice(0, 30),
    }));
    setTirada(null);
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
          <Plinko
            escenario={escRef.current} cfg={cfg} tema={tema}
            filas={estado.filas} riesgo={estado.riesgo}
            tirada={tirada} onLand={alCaer}
          />
          <PlinkoMesa
            escenario={escRef.current} cfg={cfg} pos={posCtl} estado={estado}
            minBet={minBet} maxBet={maxBet} pasoApuesta={paso} cayendo={!!tirada}
            ocultarApuesta={fichas.length > 0}
            ocultarCaja={sinCaja}
            onSoltar={soltar}
            onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
            onCambiarFilas={(n) => setEstado((e) => ({ ...e, filas: n }))}
            onCambiarRiesgo={(r) => setEstado((e) => ({ ...e, riesgo: r }))}
          />
          {fichas.length > 0 && (
            <Fichas
              host={escRef.current.el} fichas={fichas} apuesta={estado.apuesta}
              bloqueado={!!tirada}
              editable={mostrarPanel && tab === 'controles' && ajusteElem === 'fichas'}
              onElegir={(v) => setEstado((e) => ({ ...e, apuesta: v }))}
              onMover={(i, x, y) => guardarFichas(fichas.map((f, k) => (k === i ? { ...f, x, y } : f)))}
              modo={modoFichas}
            />
          )}
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
            : <AjustePlinkoControles juego={juego} escenario={escRef.current} pos={posCtl} onChange={setPosCtl} onElem={setAjusteElem} />}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
