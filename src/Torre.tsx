import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { crearEscenario } from './juego/escenario.ts';
import { TorreJuego, type TorreApi } from './TorreJuego.tsx';
import { fichasConDefaults } from '../motor/fichas.js';
import { AjustePanel } from './AjustePanel.tsx';
import { AjusteTorreControles } from './AjusteTorreControles.tsx';
import { cfgDe, cfgConDefaults, multPiso, posControlesTorreDe, sortearTrampas } from './juego/torre.ts';
import { temaTorreDe } from './juego/torre-temas.ts';
import { cfgConDefaults as _cfgTorre } from '../motor/torre.js';
import type { Escenario } from './juego/escenario.ts';
import type { AnimacionLottie, CadenaLuz, CapaLibre, Ficha, Juego, PosControlesTorre, TorreCfg } from './types.ts';

export const cfgTorreDe = (juego: Juego): TorreCfg => _cfgTorre(juego.torre_cfg) as TorreCfg;

const MOTOR_STUB = { COLUMNAS: 1, FILAS: 1, FILA_PAGO: 0 };
const SALDO_DEMO = 50000;

// Vista previa de la Torre: corre la mecánica localmente con plata de
// mentira. Arte y controles se editan en vivo desde ⚙ Ajustar.
export function PreviewTorre({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);

  const cfg = useMemo(() => cfgDe(juego), [juego]);
  const tema = useMemo(() => temaTorreDe(cfg.tema), [cfg.tema]);
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;
  const contadorMs = Number(juego.contador_ms ?? 900);

  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [tab, setTab] = useState<'controles' | 'arte'>('controles');
  const [posCtl, setPosCtl] = useState<PosControlesTorre>(() => posControlesTorreDe(cfg));
  const [ajusteElem, setAjusteElem] = useState('torre');
  const [fichas, setFichas] = useState<Ficha[]>(() => fichasConDefaults(juego.fichas_cfg).fichas);
  const sinCaja = fichas.length > 0 && !!fichasConDefaults(juego.fichas_cfg).sinCaja;
  const modoFichas = fichasConDefaults(juego.fichas_cfg).modo;
  const guardarFichas = (fs: Ficha[]) => {
    setFichas(fs);
    const next = { fichas: fs, sinCaja: !!fichasConDefaults(juego.fichas_cfg).sinCaja, modo: fichasConDefaults(juego.fichas_cfg).modo };
    supabase.from('juegos').update({ fichas_cfg: next }).eq('id', juego.id).then(() => {});
    (juego as { fichas_cfg?: unknown }).fichas_cfg = next;
  };

  const saldoRef = useRef(SALDO_DEMO);
  const trampasRef = useRef<number[][]>([]);
  const pisoRef = useRef(1);
  const apuestaRef = useRef(0);

  const api = useMemo<TorreApi>(() => {
    const c = cfgConDefaults(cfg);
    return {
      iniciar: async (apuesta) => {
        trampasRef.current = sortearTrampas(c);
        pisoRef.current = 1;
        apuestaRef.current = apuesta;
        saldoRef.current -= apuesta;
        return { saldo: saldoRef.current };
      },
      subir: async (piso, casilla) => {
        const esTrampa = (trampasRef.current[piso - 1] || []).includes(casilla);
        if (esTrampa) {
          return { trampa: true, piso, casilla, estado: 'perdida', trampasReveladas: trampasRef.current };
        }
        const nuevoPiso = piso + 1;
        pisoRef.current = nuevoPiso;
        const m = multPiso(c, piso);
        if (nuevoPiso > c.pisos) {
          const ganancia = Math.round(apuestaRef.current * m);
          saldoRef.current += ganancia;
          return { trampa: false, piso: nuevoPiso, casilla, top: true, multiplicador: m, ganancia, saldo: saldoRef.current, trampasReveladas: trampasRef.current, estado: 'retirada' };
        }
        return { trampa: false, piso: nuevoPiso, casilla, top: false, multiplicador: m, estado: 'en_curso' };
      },
      retirar: async () => {
        const m = multPiso(c, pisoRef.current - 1);
        const ganancia = Math.round(apuestaRef.current * m);
        saldoRef.current += ganancia;
        return { ganancia, multiplicador: m, saldo: saldoRef.current, trampasReveladas: trampasRef.current };
      },
    };
  }, [cfg]);

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
        modo: 'preview', esTorre: true, juego, motor: MOTOR_STUB,
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

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="hint">plata de mentira</span>
        <button onClick={() => setMostrarPanel((v) => !v)}>⚙ Ajustar</button>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>

      <div ref={hostRef} />

      {listo && escRef.current && (
        <TorreJuego
          escenario={escRef.current} juego={juego} cfg={cfg} tema={tema} pos={posCtl}
          fichas={fichas} sinCaja={sinCaja} modoFichas={modoFichas} saldoInicial={SALDO_DEMO}
          minBet={minBet} maxBet={maxBet} paso={paso} contadorMs={contadorMs} api={api}
          fichasEditables={mostrarPanel && tab === 'controles' && ajusteElem === 'fichas'}
          onMoverFicha={(i, x, y) => guardarFichas(fichas.map((ff, k) => (k === i ? { ...ff, x, y } : ff)))}
          premioDemo={mostrarPanel && tab === 'controles' && ajusteElem === 'premio' ? 12345 : null}
        />
      )}

      {listo && mostrarPanel && escRef.current && (
        <div style={{ position: 'relative', zIndex: 50 }}>
          <div className="grupo-nav" style={{ marginBottom: 8 }}>
            <button className={`grupo-btn ${tab === 'controles' ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setTab('controles')}>Controles</button>
            <button className={`grupo-btn ${tab === 'arte' ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setTab('arte')}>Arte / luces</button>
          </div>
          {tab === 'arte'
            ? <AjustePanel escenario={escRef.current} juego={juego} simbolos={[]} onGrillaCambio={() => {}} categorias={['capas', 'extras']} esMines />
            : <AjusteTorreControles juego={juego} escenario={escRef.current} pos={posCtl} onChange={setPosCtl} onElem={setAjusteElem} />}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
