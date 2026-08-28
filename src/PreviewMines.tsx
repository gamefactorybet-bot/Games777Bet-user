import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TableroMines } from './TableroMines.tsx';
import {
  colocarMinas, multiplicador, puedeRetirar, margenDe, estadoInicial, TOTAL,
} from './juego/mines.ts';
import type { EstadoPartida } from './juego/mines.ts';
import type { Juego } from './types.ts';

interface PreviewMinesProps {
  juego: Juego;
  onClose: () => void;
}

// Vista previa de Mines: corre la mecánica completa localmente con la
// misma matemática que el servidor (`motor/mines-clasico.js`), con
// plata de mentira. No toca la red.
export function PreviewMines({ juego, onClose }: PreviewMinesProps) {
  const minBet = Number(juego.min_bet) || 1000;
  const maxBet = Number(juego.max_bet) || 100000;
  const paso = Number(juego.paso_apuesta) || 500;
  const margen = margenDe(juego);

  const minasSecretas = useRef<number[]>([]);
  const [estado, setEstado] = useState<EstadoPartida>(() => estadoInicial(3, minBet, 10000));

  const iniciar = () => {
    if (estado.saldo < estado.apuesta) return;
    minasSecretas.current = colocarMinas(estado.minas);
    setEstado((e) => ({
      ...estadoInicial(e.minas, e.apuesta, e.saldo - e.apuesta),
      fase: 'en_curso',
    }));
  };

  const revelar = (casilla: number) => {
    setEstado((e) => {
      if (e.fase !== 'en_curso' || e.reveladas.includes(casilla)) return e;

      if (minasSecretas.current.includes(casilla)) {
        return { ...e, fase: 'perdida', minasPos: minasSecretas.current, ganancia: 0 };
      }

      const reveladas = [...e.reveladas, casilla];
      const aciertos = reveladas.length;
      return {
        ...e,
        reveladas,
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, width: 340, maxWidth: '92vw' }}>
        <strong style={{ flex: 1 }}>Vista previa · Mines</strong>
        <button onClick={onClose}>✕ Cerrar prueba</button>
      </div>
      <TableroMines
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
      <p className="hint" style={{ width: 340, maxWidth: '92vw', margin: 0 }}>
        Corre local con plata de mentira. Tablero de {TOTAL} casillas · RTP ≈ {(100 - margen * 100).toFixed(1)}%.
      </p>
    </div>
  );

  return createPortal(overlay, document.body);
}
