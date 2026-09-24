import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Ruleta } from './Ruleta.tsx';
import { slotsDe } from './juego/ruleta-botones.ts';
import { cargarFuenteTema, temaDe } from './juego/ruleta-temas.ts';
import { BotonAuto } from './BotonAuto.tsx';
import { propsAuto } from './juego/planilla.ts';
import { useAutoplay } from './juego/autoplay.ts';
import type { Escenario } from './juego/escenario.ts';
import type { PosControlesRuleta, ResueltoBotones, RuletaBotonesCfg, RuletaSlot } from './types.ts';

export interface GiroBotones {
  resultado: ResueltoBotones;
  /** Saldo después del giro (el servidor lo devuelve; la vista previa
   *  lo calcula desde `saldoActual`). */
  saldo: number;
}

interface RuletaBotonesProps {
  escenario: Escenario;
  cfg: RuletaBotonesCfg;
  /** Posición/tamaño de los controles (ya resuelta con defaults). */
  pos: PosControlesRuleta;
  saldoInicial: number;
  /** Debita el total y devuelve el giro resuelto. `apuestas` = { idx: monto };
   *  `saldoActual` ya viene neto de lo apostado en esta ronda. */
  resolver: (apuestas: Record<number, number>, saldoActual: number) => Promise<GiroBotones>;
  onAutoMovido?: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');

/** Ancla un elemento por su centro en (x%, y%) de la pantalla. */
const centrado = (p: { x: number; y: number }): CSSProperties => ({
  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)',
});

// La "mesa" de la ruleta de botones: la rueda va en la caja del
// escenario, y todo lo demás (fichas, botones, girar, saldo) en una
// capa aparte. Sirve para la vista previa (resolver local) y la
// pantalla real (resolver contra /api/ruleta-botones-girar).
export function RuletaBotones({ escenario, cfg, pos, saldoInicial, resolver, onAutoMovido }: RuletaBotonesProps) {
  const numeros = cfg.numeros;
  const slotsBase = useMemo(() => slotsDe(numeros), [numeros]);

  const tema = useMemo(() => temaDe(cfg.tema), [cfg.tema]);

  // El tema pinta el escenario: fondo, variables CSS y fuente. Se
  // setea sobre `escenario.el` (la rueda es descendiente y la capa se
  // portalea ahí), y se revierte solo lo que se tocó.
  useEffect(() => {
    cargarFuenteTema(tema);
    const el = escenario.el;
    const prevBg = el.style.background;
    if (tema.stageBg) el.style.background = tema.stageBg;
    const claves = Object.keys(tema.vars);
    for (const k of claves) el.style.setProperty(k, tema.vars[k]);
    if (tema.font) el.style.setProperty('--rb-body', tema.font.family);
    return () => {
      el.style.background = prevBg;
      for (const k of claves) el.style.removeProperty(k);
      el.style.removeProperty('--rb-body');
    };
  }, [tema, escenario]);

  const [slots, setSlots] = useState<RuletaSlot[]>(slotsBase);
  const [objetivo, setObjetivo] = useState<number | null>(null);
  const [saldo, setSaldo] = useState(saldoInicial);
  const [fichaActiva, setFichaActiva] = useState(cfg.fichas[Math.min(2, cfg.fichas.length - 1)] ?? cfg.fichas[0] ?? 1000);
  const [apuestas, setApuestas] = useState<Record<number, number[]>>({});
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [sorp, setSorp] = useState<{ num: number; mult: number } | null>(null);
  const pendiente = useRef<GiroBotones | null>(null);
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;
  const auto = useAutoplay();
  const girarRef = useRef<() => void>(() => {});
  const lastApuestas = useRef<Record<number, number[]>>({});

  useEffect(() => { if (objetivo == null) setSlots(slotsDe(numeros)); }, [numeros, objetivo]);
  useEffect(() => { if (!cfg.fichas.includes(fichaActiva)) setFichaActiva(cfg.fichas[0] ?? 1000); }, [cfg.fichas, fichaActiva]);

  // El tema puede repintar las tajadas: cada `et` toma el color de su
  // posición en la paleta del tema (si no hay, queda el color propio).
  const colorNum = (i: number) => (tema.seg && tema.seg[i]) || numeros[i]?.color || 'var(--border)';
  const grosor = Math.max(0, Math.round(Number(cfg.bordeGrosor ?? 3)));
  const skin = cfg.botonFondo || null;
  const slotsPintados = useMemo(() => {
    const seg = tema.seg;
    if (!seg) return slots;
    return slots.map((s) => {
      const i = numeros.findIndex((n) => n.et === s.et);
      return i >= 0 && seg[i] ? { ...s, color: seg[i] } : s;
    });
  }, [slots, tema, numeros]);

  const montoEn = (i: number) => (apuestas[i] || []).reduce((a, v) => a + v, 0);
  const total = numeros.reduce((a, _n, i) => a + montoEn(i), 0);

  const poner = (i: number) => {
    if (girando) return;
    if (saldo < fichaActiva) { setResultado('No te alcanza el saldo para esa ficha.'); return; }
    setSaldo((s) => s - fichaActiva);
    setApuestas((a) => ({ ...a, [i]: [...(a[i] || []), fichaActiva] }));
    setResultado('');
  };
  const sacar = (i: number) => {
    if (girando || !(apuestas[i] && apuestas[i].length)) return;
    setApuestas((a) => {
      const pila = [...(a[i] || [])];
      const dev = pila.pop() || 0;
      setSaldo((s) => s + dev);
      return { ...a, [i]: pila };
    });
  };
  const limpiar = () => {
    if (girando) return;
    setSaldo((s) => s + total);
    setApuestas({});
    setSorp(null);
    setObjetivo(null);
    setResultado('');
  };

  const girar = async () => {
    if (girando) return;
    if (total <= 0) { setResultado('Poné al menos una ficha en un número.'); auto.stop(); return; }
    setGirando(true);
    setResultado('');
    escenario.lanzarAnimaciones('girar');
    if (escenario.audios.giro) { escenario.audios.giro.currentTime = 0; escenario.audios.giro.play().catch(() => {}); }
    if (escenario.audios.musica_fondo?.paused) escenario.audios.musica_fondo.play().catch(() => {});

    lastApuestas.current = apuestas;
    const montos: Record<number, number> = {};
    numeros.forEach((_n, i) => { const m = montoEn(i); if (m > 0) montos[i] = m; });

    try {
      const g = await resolverRef.current(montos, saldo);
      pendiente.current = g;
      setSlots(g.resultado.slots);
      setSorp(g.resultado.sorpresa);
      setObjetivo(g.resultado.ganadora);
    } catch (err) {
      setGirando(false);
      setResultado((err as Error).message || 'No se pudo resolver el giro.');
      auto.stop();
    }
  };
  girarRef.current = () => { void girar(); };

  const alLlegar = () => {
    const g = pendiente.current;
    setObjetivo(null);
    if (!g) { setGirando(false); return; }
    const r = g.resultado;
    setSaldo(g.saldo);
    setApuestas({});

    const et = r.slots[r.ganadora]?.et ?? '';
    if (r.premio > 0) {
      const s = escenario.audios[r.conSorpresa ? 'premio_grande' : 'premio_chico'];
      if (s) { s.currentTime = 0; s.play().catch(() => {}); }
      escenario.lanzarAnimaciones(r.conSorpresa ? 'premio_mayor' : 'premio_chico');
      setResultado(r.conSorpresa
        ? `✨ ¡SORPRESA! Cayó ${et} con ×${r.sorpresa?.mult} → cobrás ${fmt(r.premio)}`
        : `Cayó ${et} → cobrás ${fmt(r.premio)}`);
    } else {
      setResultado(`Cayó ${et} · no le pusiste fichas`);
    }
    setGirando(false);
    const tot = Object.values(lastApuestas.current).reduce((s, arr) => s + arr.reduce((a, b) => a + b, 0), 0);
    auto.continuar(() => {
      setApuestas(lastApuestas.current);
      window.setTimeout(() => girarRef.current(), 30);
    }, g.saldo >= tot && tot > 0);
  };

  // ---------------- Render ----------------
  const capa = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none', fontFamily: 'var(--rb-body, inherit)' }}>
      {/* Sorpresa */}
      <div style={{
        ...centrado(pos.sorpresa),
        maxWidth: '90%', textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '6px 12px',
        borderRadius: 999, whiteSpace: 'nowrap',
        background: sorp ? 'var(--rb-gold-soft, rgba(240,192,64,.14))' : 'transparent',
        border: sorp ? '1px solid var(--rb-gold, #f0c040)' : '1px solid transparent',
        color: sorp ? 'var(--rb-gold, #f0c040)' : 'var(--text-dim)',
      }}>
        {sorp
          ? <>✨ Sorpresa: el <b>{numeros[sorp.num]?.et}</b> puede pagar <b>×{sorp.mult}</b></>
          : girando ? 'Girando…' : 'Girá para ver si sale un multiplicador sorpresa'}
      </div>

      {/* Fichas */}
      <div style={{
        ...centrado(pos.fichas), maxWidth: '92%',
        display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', pointerEvents: 'auto',
      }}>
        {cfg.fichas.map((v) => (
          <button key={v} onClick={() => setFichaActiva(v)} style={{
            minWidth: 46, padding: '5px 9px', borderRadius: 999, fontWeight: 700, fontSize: 11.5,
            border: `2px solid ${v === fichaActiva ? 'var(--accent)' : 'var(--border)'}`,
            background: v === fichaActiva ? 'var(--accent-soft)' : 'var(--rb-btn-bg, var(--surface-alt))',
            color: v === fichaActiva ? 'var(--accent-text, #fff)' : 'var(--text)',
          }}>{fmt(v)}</button>
        ))}
      </div>

      {/* Botones de multiplicador */}
      <div style={{
        position: 'absolute', left: `${pos.botones.x}%`, top: `${pos.botones.y}%`, transform: 'translate(-50%,-50%)',
        width: `${pos.botones.ancho}%`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, pointerEvents: 'auto',
      }}>
        {numeros.map((n, i) => {
          const monto = montoEn(i);
          const cnt = (apuestas[i] || []).length;
          const esSorp = !!sorp && sorp.num === i;
          const gana = objetivo != null && slots[objetivo] && numeros[i]?.et === slots[objetivo].et && !girando;
          return (
            <div key={i}
              onClick={() => poner(i)}
              onContextMenu={(e) => { e.preventDefault(); sacar(i); }}
              style={{
                position: 'relative', aspectRatio: '1.4', borderRadius: 'var(--rb-radius, 8px)', cursor: 'pointer', overflow: 'hidden',
                borderStyle: 'solid',
                borderWidth: esSorp ? Math.max(grosor, 2) : grosor,
                borderColor: esSorp ? 'var(--rb-gold, #f0c040)' : colorNum(i),
                boxShadow: 'inset 0 0 0 1px var(--border)',
                background: skin
                  ? `center/cover no-repeat url("${skin}")`
                  : (esSorp ? 'var(--rb-gold-soft, rgba(240,192,64,.14))' : 'var(--rb-btn-bg, var(--surface-alt))'),
                outline: gana ? '2px solid var(--ok)' : 'none', outlineOffset: -2,
              }}>
              {skin && (
                <span style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: esSorp ? 'rgba(240,192,64,.22)' : 'linear-gradient(rgba(0,0,0,.06), rgba(0,0,0,.38))',
                }} />
              )}
              {esSorp && (
                <span style={{
                  position: 'absolute', top: 3, right: 3, zIndex: 2, fontSize: 9, fontWeight: 800,
                  color: '#1a1400', background: 'var(--rb-gold, #f0c040)', borderRadius: 999, padding: '1px 5px',
                }}>×{sorp!.mult}</span>
              )}
              <span style={{
                position: 'absolute', inset: 0, zIndex: 1, padding: 4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                textShadow: skin ? '0 1px 3px rgba(0,0,0,.65)' : 'none',
              }}>
                {n.img && (
                  <span style={{
                    width: 20, height: 20, flexShrink: 0, borderRadius: 5,
                    backgroundImage: `url("${n.img}")`, backgroundSize: 'contain',
                    backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                  }} />
                )}
                <span style={{ fontSize: n.img ? 15 : 18, fontWeight: 800, fontFamily: 'var(--rb-font-display, inherit)', lineHeight: 1 }}>{n.et}</span>
                {monto > 0
                  ? <>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text, #fff)', background: 'var(--accent)', borderRadius: 999, padding: '0 6px' }}>{cnt} · {fmt(monto)}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: skin ? '#8affc8' : 'var(--ok)' }}>→ {fmt(monto * n.mult * (esSorp ? sorp!.mult : 1))}</span>
                    </>
                  : <span className="hint" style={{ margin: 0, fontSize: 9, color: skin ? 'rgba(255,255,255,.82)' : undefined }}>tocá</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Saldo */}
      <div style={{ ...centrado(pos.saldo), textAlign: 'center', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
        <strong style={{ display: 'block', fontSize: 14 }}>{fmt(saldo)}</strong>
      </div>

      {/* Apostado + Limpiar */}
      <div style={{
        ...centrado(pos.apostado), display: 'flex', alignItems: 'center', gap: 8,
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', pointerEvents: 'auto',
      }}>
        <div style={{ textAlign: 'center' }}>
          <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Apostado</span>
          <strong style={{ display: 'block', fontSize: 14 }}>{fmt(total)}</strong>
        </div>
        <button onClick={limpiar} disabled={girando} style={{ fontSize: 12 }}>Limpiar</button>
      </div>

      {/* Girar */}
      <BotonAuto
        host={escenario.el}
        {...propsAuto(escenario.planilla, { x: pos.girar.x, y: pos.girar.y, tam: pos.girar.ancho })}
        restantes={auto.restantes} activo={auto.activo}
        onMover={onAutoMovido ? (x, y) => { escenario.setAutoPos(x, y); onAutoMovido(); } : undefined}
        disabled={girando || total <= 0}
        onStart={(n) => auto.start(n, () => girarRef.current())} onStop={auto.stop}
      />
      <button className={pos.girar.imagen_url ? 'jg-play' : 'primary jg-play'} onClick={girar} disabled={girando || auto.activo} style={{
        position: 'absolute', left: `${pos.girar.x}%`, top: `${pos.girar.y}%`, transform: 'translate(-50%,-50%)',
        width: pos.girar.ancho, height: pos.girar.alto, pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 'var(--rb-radius, 8px)',
        background: pos.girar.imagen_url
          ? `center/100% 100% no-repeat url("${pos.girar.imagen_url}")`
          : 'var(--rb-spin-bg, var(--accent))',
        color: 'var(--rb-spin-ink, var(--accent-text, #fff))',
        boxShadow: pos.girar.imagen_url ? 'none' : 'var(--rb-spin-shadow, none)',
        textShadow: pos.girar.imagen_url ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
        fontFamily: 'var(--rb-font-display, inherit)', fontWeight: 800, letterSpacing: 1,
      }}>Girar</button>

      {/* Resultado */}
      <p style={{
        ...centrado(pos.resultado),
        margin: 0, textAlign: 'center', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
        color: resultado.includes('SORPRESA') ? 'var(--rb-gold, #f0c040)'
          : resultado.includes('cobrás') ? 'var(--ok)'
          : resultado.includes('no le pusiste') ? 'var(--danger)' : 'var(--text)',
        textShadow: '0 1px 4px rgba(0,0,0,.6)',
      }}>{resultado}</p>
    </div>
  );

  return (
    <>
      {tema.deco && createPortal(
        <div aria-hidden style={{
          position: 'absolute', inset: '-22px', borderRadius: 20, overflow: 'hidden',
          pointerEvents: 'none', zIndex: -1,
        }} dangerouslySetInnerHTML={{ __html: tema.deco }} />,
        escenario.el,
      )}
      {createPortal(
        <Ruleta slots={slotsPintados} objetivo={objetivo} onLlegada={alLlegar} girando={girando}
          tema={tema.id === 'clasico' ? undefined : tema.wheel} />,
        escenario.grillaEl,
      )}
      {createPortal(capa, escenario.el)}
    </>
  );
}
