import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase.ts';
import { TableroMines } from './TableroMines.tsx';
import { AjustePanel } from './AjustePanel.tsx';
import { AjusteMinesControles } from './AjusteMinesControles.tsx';
import { crearEscenario } from './juego/escenario.ts';
import {
  colocarMinas, multiplicador, puedeRetirar, margenDe, estadoInicial, posControlesDe,
} from './juego/mines.ts';
import type { Escenario } from './juego/escenario.ts';
import type { EstadoPartida } from './juego/mines.ts';
import type { AnimacionLottie, CadenaLuz, CapaLibre, Juego, PosControlesMines } from './types.ts';

interface PreviewMinesProps {
  juego: Juego;
  onClose: () => void;
}

const MOTOR_STUB = { COLUMNAS: 5, FILAS: 5, FILA_PAGO: 0 };

// Vista previa de Mines: corre la mecánica completa localmente con la
// misma matemática que el servidor (`motor/mines-clasico.js`), con
// plata de mentira. El escenario (arte, luces, capas libres) y los
// controles (saldo, multiplicador, botón…) se editan en vivo.
export function PreviewMines({ juego, onClose }: PreviewMinesProps) {
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;
  const margen = margenDe(juego);

  const minasSecretas = useRef<number[]>([]);
  const [estado, setEstado] = useState<EstadoPartida>(() => estadoInicial(3, minBet, 10000));
  const [posCtl, setPosCtl] = useState<PosControlesMines>(() => posControlesDe(juego));

  const hostRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const [listo, setListo] = useState(false);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [tab, setTab] = useState<'arte' | 'controles'>('controles');

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
        modo: 'preview', esMines: true, juego, motor: MOTOR_STUB,
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

  const iniciar = () => {
    if (estado.saldo < estado.apuesta) return;
    minasSecretas.current = colocarMinas(estado.minas);
    setEstado((e) => ({ ...estadoInicial(e.minas, e.apuesta, e.saldo - e.apuesta), fase: 'en_curso' }));
  };

  const revelar = (casilla: number) => {
    setEstado((e) => {
      if (e.fase !== 'en_curso' || e.reveladas.includes(casilla)) return e;
      if (minasSecretas.current.includes(casilla)) {
        return { ...e, fase: 'perdida', minasPos: minasSecretas.current, clicMina: casilla, ganancia: 0 };
      }
      const reveladas = [...e.reveladas, casilla];
      const aciertos = reveladas.length;
      return {
        ...e, reveladas,
        multiplicador: multiplicador(e.minas, aciertos, margen),
        puedeRetirar: puedeRetirar(e.minas, aciertos),
      };
    });
  };

  const retirar = () => {
    setEstado((e) => {
      if (e.fase !== 'en_curso' || !e.puedeRetirar) return e;
      const ganancia = e.apuesta * e.multiplicador;
      return { ...e, fase: 'retirada', minasPos: minasSecretas.current, ganancia, saldo: e.saldo + ganancia };
    });
  };

  const nueva = () => setEstado((e) => estadoInicial(e.minas, e.apuesta, e.saldo));

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 60, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="hint">plata de mentira · RTP ≈ {(100 - margen * 100).toFixed(1)}%</span>
        <button onClick={() => setMostrarPanel((v) => !v)}>⚙ Ajustar</button>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>

      <div ref={hostRef} />

      {listo && escRef.current && (
        <TableroMines
          escenario={escRef.current}
          pos={posCtl}
          juego={juego}
          estado={estado}
          minBet={minBet}
          maxBet={maxBet}
          pasoApuesta={paso}
          onIniciar={iniciar}
          onRevelar={revelar}
          onRetirar={retirar}
          onCambiarApuesta={(n) => setEstado((e) => ({ ...e, apuesta: n }))}
          onCambiarMinas={(n) => setEstado((e) => ({ ...e, minas: n }))}
          onNueva={nueva}
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
            : <AjusteMinesControles juego={juego} pos={posCtl} onChange={setPosCtl} />}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
