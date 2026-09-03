import { useMemo, useRef, useState } from 'react';
import { fetchJson } from './juego/recursos.ts';
import { InstantShell } from './InstantShell.tsx';
import { fichasDe } from '../motor/fichas.js';
import { temaInstantDe } from './juego/instant-temas.ts';
import { SieteUdMesa, type JugarSieteUd } from './SieteUdMesa.tsx';
import { AjusteSieteUdControles } from './AjusteSieteUdControles.tsx';
import { cfgConDefaults as _cfg, tirar as _tirarLocal } from '../motor/sieteud.js';
import { posControlesSieteUdDe } from './juego/sieteud.ts';
import type {
  DatosJuego, Juego, PosControlesSieteUd, ResultadoInstant, SieteUdCfg, TiradaInstant,
} from './types.ts';

type ElemId = keyof PosControlesSieteUd;

export const cfgSieteUdDe = (juego: Juego): SieteUdCfg => _cfg(juego.sieteud_cfg) as SieteUdCfg;

// ---- Pantalla real ----
export function JugarSieteUd({ datos, saldoInicial, slug, token }: {
  datos: DatosJuego; saldoInicial: number; slug: string; token: string;
}) {
  const juego = datos.juego;
  const cfg = useMemo(() => cfgSieteUdDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const pos = useRef(posControlesSieteUdDe(cfg)).current;

  const jugar: JugarSieteUd = async (zona, apuesta) => {
    const r = await fetchJson<ResultadoInstant>('/api/jugar-instant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, zona, clientId: crypto.randomUUID() }),
    });
    return { resultado: r.resultado, premio: r.premio, saldo: r.saldo };
  };

  return (
    <InstantShell
      nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || null} tema={tema}
      mostrarNombre={(juego.mostrar_nombre ?? true) as boolean}
      cargaImagen={(juego.carga_url as string) || (juego.portada_url as string) || null}
    >
      <SieteUdMesa cfg={cfg} pos={pos} fichas={fichas} saldoInicial={Number(saldoInicial)}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar} />
    </InstantShell>
  );
}

// ---- Vista previa (plata de mentira + ⚙ Ajustar) ----
export function PreviewSieteUd({ juego, onClose }: { juego: Juego; onClose: () => void }) {
  const cfg = useMemo(() => cfgSieteUdDe(juego), [juego]);
  const fichas = useMemo(() => fichasDe(juego), [juego]);
  const tema = useMemo(() => temaInstantDe(cfg.tema), [cfg.tema]);
  const saldoRef = useRef(10000);

  const [ajustar, setAjustar] = useState(false);
  const [elem, setElem] = useState<ElemId>('mesa');
  const [pos, setPos] = useState<PosControlesSieteUd>(() => posControlesSieteUdDe(cfg));

  const jugar: JugarSieteUd = async (zona, apuesta) => {
    const r = _tirarLocal(juego.sieteud_cfg, zona) as TiradaInstant & { mult: number };
    const premio = r.gano ? Math.round(apuesta * (r.mult || 0)) : 0;
    saldoRef.current = saldoRef.current - apuesta + premio;
    return { resultado: { ...r, tipo: 'sieteud' as const }, premio, saldo: saldoRef.current };
  };

  return (
    <InstantShell nombre={juego.nombre} fondoUrl={(juego.fondo_url as string) || null} tema={tema} demo onCerrar={onClose}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 60 }}>
        <button onClick={() => setAjustar((v) => !v)}>{ajustar ? '✓ Listo' : '⚙ Ajustar'}</button>
      </div>

      <SieteUdMesa
        cfg={cfg} pos={pos} fichas={fichas} saldoInicial={10000}
        minBet={Number(juego.min_bet) || 1000} maxBet={Number(juego.max_bet) || 100000}
        paso={Number(juego.paso_apuesta) || 500} onJugar={jugar}
        ajusteElem={ajustar ? elem : null}
        onSelectPieza={setElem}
        onPatchPieza={(id, patch) => setPos((p) => ({ ...p, [id]: { ...p[id], ...patch } }))}
        cartelDemo={ajustar && elem === 'cartel'}
      />

      {ajustar && (
        <div style={{ position: 'absolute', top: 52, left: 12, zIndex: 60 }}>
          <AjusteSieteUdControles juego={juego} pos={pos} elem={elem} onChange={setPos} onElem={setElem} />
        </div>
      )}
    </InstantShell>
  );
}
