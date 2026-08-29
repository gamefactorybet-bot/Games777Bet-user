import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ruleta } from './Ruleta.tsx';
import { slotsDe } from './juego/ruleta.ts';
import type { Escenario } from './juego/escenario.ts';
import type { NivelPremio, RuletaSlot, Simbolo } from './types.ts';

export interface ResueltoRuleta {
  slots: RuletaSlot[];
  ganadora: number;
  /** Plata ganada (ya multiplicada por la apuesta). 0 = perdió. */
  premio: number;
  nivel: NivelPremio | null;
  saldo: number;
}

interface RuletaJuegoProps {
  escenario: Escenario;
  simbolos: Simbolo[];
  /** Debita la apuesta y devuelve el resultado del giro. */
  resolver: (apuesta: number) => Promise<ResueltoRuleta>;
}

// Pega la rueda con el escenario: engancha el botón de girar, corre la
// animación hasta el resultado que devuelve `resolver`, y al frenar
// actualiza el saldo y dispara el cuadro de premio del escenario.
// Sirve igual para la vista previa (resolver local) y la pantalla real
// (resolver contra /api/jugar-girar).
export function RuletaJuego({ escenario, simbolos, resolver }: RuletaJuegoProps) {
  const [slots, setSlots] = useState<RuletaSlot[]>(() => slotsDe(simbolos));
  const [objetivo, setObjetivo] = useState<number | null>(null);
  const [resultado, setResultado] = useState('');
  const pendiente = useRef<ResueltoRuleta | null>(null);
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;

  // Reconstruir la rueda si cambian los símbolos y no está girando.
  useEffect(() => {
    if (objetivo == null) setSlots(slotsDe(simbolos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simbolos]);

  useEffect(() => {
    const esc = escenario;
    const girar = async () => {
      if (esc.girando) return;
      if (esc.saldo < esc.apuesta) { setResultado('No te alcanza el saldo para esa apuesta.'); return; }
      esc.girando = true;
      esc.btnGirar.disabled = true;
      esc.ocultarPremio();
      setResultado('');
      if (esc.audios.giro) { esc.audios.giro.currentTime = 0; esc.audios.giro.play().catch(() => {}); }
      if (esc.audios.musica_fondo?.paused) esc.audios.musica_fondo.play().catch(() => {});
      esc.lanzarAnimaciones('girar');
      try {
        const r = await resolverRef.current(esc.apuesta);
        pendiente.current = r;
        setSlots(r.slots);
        setObjetivo(r.ganadora);
      } catch (err) {
        esc.girando = false;
        esc.btnGirar.disabled = false;
        setResultado((err as Error).message || 'No se pudo resolver el giro.');
      }
    };
    esc.btnGirar.addEventListener('click', girar);
    return () => esc.btnGirar.removeEventListener('click', girar);
  }, [escenario]);

  const alLlegar = () => {
    const r = pendiente.current;
    setObjetivo(null);
    if (!r) return;
    const apuesta = escenario.apuesta;
    escenario.saldo = r.saldo;
    escenario.saldoEl.textContent = r.saldo.toLocaleString('es-PY');

    if (r.premio > 0 && r.nivel) {
      escenario.mostrarPremio(r.premio, r.nivel);
      escenario.lanzarAnimaciones(r.nivel === 'premio_mayor' ? 'premio_mayor' : 'premio_chico');
      const s = escenario.audios[r.nivel === 'premio_mayor' ? 'premio_grande' : 'premio_chico'];
      if (s) { s.currentTime = 0; s.play().catch(() => {}); }
      setResultado(`Cayó ${r.slots[r.ganadora]?.et ?? ''} · +${Math.round(r.premio).toLocaleString('es-PY')}`);
    } else {
      setResultado(`Cayó ${r.slots[r.ganadora]?.et ?? '×0'} · perdés ${Math.round(apuesta).toLocaleString('es-PY')}`);
    }
    escenario.girando = false;
    escenario.btnGirar.disabled = false;
  };

  return (
    <>
      {createPortal(<Ruleta slots={slots} objetivo={objetivo} onLlegada={alLlegar} />, escenario.grillaEl)}
      {createPortal(
        <p style={{
          position: 'absolute', left: '50%', bottom: '13%', transform: 'translateX(-50%)',
          margin: 0, zIndex: 11, textAlign: 'center', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
          pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,.6)',
          color: resultado.startsWith('Cayó') && resultado.includes('+')
            ? 'var(--ok)'
            : resultado.includes('perdés') ? 'var(--danger)' : 'var(--text)',
        }}>{resultado}</p>,
        escenario.el,
      )}
    </>
  );
}
