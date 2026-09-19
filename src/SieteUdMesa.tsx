import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { FichasStrip } from './Fichas.tsx';
import { BotonAuto } from './BotonAuto.tsx';
import { Pieza, type PatchPieza, type ValPieza } from './SieteUdPieza.tsx';
import { ZONAS, ZONA_INFO, pagoDe, campana, estiloImg, PIEZAS_SIETEUD } from './juego/sieteud.ts';
import type { EstadoSieteUd } from './juego/useSieteUd.ts';
import type { Ficha, PosControlesSieteUd, SieteUdCfg, ZonaSieteUd } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-PY');
type ElemId = keyof PosControlesSieteUd;
const TIPO = Object.fromEntries(PIEZAS_SIETEUD.map((p) => [p.id, p.tipo])) as Record<ElemId, 'punto' | 'ancho' | 'caja'>;

export interface EdicionMesa {
  seleccion: ElemId | null;
  onSelect: (id: ElemId) => void;
  onPatch: (id: ElemId, patch: PatchPieza) => void;
  /** Igual que onPatch, pero se llama una sola vez al soltar (para el historial). */
  onPatchFin: (id: ElemId, patch: PatchPieza) => void;
  bloqueadas: ElemId[];
  snap: boolean;
}

interface Props {
  cfg: SieteUdCfg;
  pos: PosControlesSieteUd;
  est: EstadoSieteUd;
  fichas: Ficha[];
  modoFichas: 'fila' | 'abanico';
  abanicoApertura?: number;
  abanicoArco?: number;
  minBet: number; maxBet: number; paso: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onApuesta: (n: number) => void;
  onZona: (z: ZonaSieteUd) => void;
  onJugar: () => void;
  onOtra: () => void;
  /** Desbloquea Web Audio en el tap (gesto del usuario, iOS). */
  onUnlock?: () => void;
  edicion?: EdicionMesa | null;
  /** mostrar el cartel de premio sin haber ganado (para ubicarlo). */
  cartelDemo?: boolean;
  auto?: {
    restantes: number; activo: boolean; disabled: boolean;
    onStart: (n: number) => void; onStop: () => void;
  };
}

export function SieteUdMesa({
  cfg, pos, est, fichas, modoFichas, abanicoApertura, abanicoArco, minBet, maxBet, paso, canvasRef,
  onApuesta, onZona, onJugar, onOtra, onUnlock, edicion, cartelDemo, auto,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const editando = !!edicion;
  const seleccion = edicion?.seleccion ?? null;
  const { fase, res } = est;
  const rolling = fase === 'rolling';
  const suma = res?.suma ?? null;
  const zg = res?.zonaGanadora ?? null;
  const revelado = res != null;
  const lucky = suma === 7;
  const barras = campana(cfg.caras);
  const sumColor = lucky ? '#f3d27a' : fase === 'gano' ? 'var(--ok)' : fase === 'perdio' ? 'var(--danger)' : 'var(--accent)';
  const cartelVisible = est.cartel != null || cartelDemo;
  const cartelLucky = (est.cartel != null && lucky) || (cartelDemo && est.zona === 'siete');
  const estiloZonas = cfg.estilos.zonas;
  const estiloBoton = cfg.estilos.boton;
  const dados = (res?.dados as [number, number] | undefined) ?? null;
  const fichaActiva = fichas.find((f) => Math.round(f.valor) === Math.round(est.apuesta)) ?? null;

  const P = (id: ElemId, children: ReactNode, zBase?: number) => (
    <Pieza
      id={id} tipo={TIPO[id]} v={pos[id] as ValPieza} seleccion={seleccion}
      onSelect={edicion?.onSelect} onPatch={edicion?.onPatch} onPatchFin={edicion?.onPatchFin} stageRef={stageRef}
      zBase={zBase} bloqueada={edicion?.bloqueadas.includes(id)} snap={edicion?.snap}
      oculta={cfg.editor.ocultas.includes(id)}
    >{children}</Pieza>
  );

  return (
    <div ref={stageRef} style={{ position: 'absolute', inset: 0, touchAction: editando ? 'none' : undefined, fontFamily: 'var(--in-body, inherit)' }}>
      {editando && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
          backgroundSize: '10% 10%',
        }}>
          <i style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(107,138,253,.75)' }} />
          <i style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed rgba(107,138,253,.75)' }} />
        </div>
      )}

      {P('saldo', (
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 5px rgba(0,0,0,.5)' }}>
          <span className="hint" style={{ margin: 0, fontSize: 9, textTransform: 'uppercase' }}>Saldo</span>
          <strong style={{ display: 'block', fontSize: 15, color: 'var(--text)' }}>{fmt(est.saldo)}</strong>
        </div>
      ))}

      {P('historial', (
        <div className="sud-hist" aria-label="Últimas sumas">
          {est.hist.length === 0
            ? <span className="sud-hist-vacio">—</span>
            : est.hist.slice(0, 8).map((h, i) => (
              <span key={h.id} className={`sud-hist-n ${h.zona}${h.gano ? ' ok' : ''}${i === 0 ? ' nuevo' : ''}`}>{h.n}</span>
            ))}
        </div>
      ))}

      {P('mesa', (
        <div style={{ width: '100%', height: '100%' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      ))}

      {cartelVisible && P('cartel', (
        <div style={{
          width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', position: 'relative', display: 'grid', placeItems: 'center',
          border: cartelLucky ? '1px solid #e8c583' : '1px solid var(--accent)',
          backgroundColor: 'var(--surface-alt)',
          boxShadow: cartelLucky
            ? '0 22px 55px -14px rgba(0,0,0,.65), 0 0 28px rgba(232,197,131,.35)'
            : '0 22px 55px -14px rgba(0,0,0,.6)',
          animation: est.cartel != null ? 'sud-cartel .45s cubic-bezier(.2,1.35,.4,1)' : undefined,
        }}>
          {cfg.cartelUrl && <span aria-hidden style={estiloImg(cfg.cartelUrl, cfg.arte.cartel)} />}
          <div style={{
            position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 12,
            background: cartelLucky
              ? 'linear-gradient(180deg,rgba(80,50,8,.28),rgba(0,0,0,.72))'
              : 'linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.6))',
          }}>
            <span aria-hidden className="sud-shine" />
            <div>
              <b style={{
                display: 'block', fontWeight: 800, color: '#fff', fontSize: 'clamp(16px,5vw,28px)',
                letterSpacing: cartelLucky ? '.08em' : undefined,
                textShadow: cartelLucky ? '0 2px 16px rgba(232,197,131,.7), 0 2px 12px rgba(0,0,0,.65)' : '0 2px 12px rgba(0,0,0,.65)',
              }}>{cartelLucky ? '¡LUCKY 7!' : '¡GANASTE!'}</b>
              <span style={{
                fontFamily: 'var(--in-num, monospace)', fontSize: 'clamp(12px,3.4vw,17px)',
                color: cartelLucky ? '#f3d27a' : 'var(--ok)',
              }}>
                {est.cartel != null
                  ? <CountUp to={est.cartel} lucky={!!cartelLucky} />
                  : `+${fmt(Math.round(est.apuesta * pagoDe(cfg, est.zona)))}`}
              </span>
            </div>
          </div>
        </div>
      ), 8)}
      <style>{CSS_SUD}</style>

      {P('suma', (
        <div className={`sud-placa${lucky && revelado ? ' lucky' : ''}${rolling && !revelado ? ' wait' : ''}`}
          style={{ animation: revelado ? 'sud-suma .35s cubic-bezier(.2,1.4,.4,1)' : undefined }}>
          <CaraMini n={rolling && !revelado ? 0 : (dados ? dados[0] : 3)} gold={lucky && revelado} />
          <span className="sud-op">+</span>
          <CaraMini n={rolling && !revelado ? 0 : (dados ? dados[1] : 4)} gold={lucky && revelado} />
          <span className="sud-op">=</span>
          <strong style={{ color: sumColor, textShadow: lucky && revelado ? '0 0 14px rgba(243,210,122,.5)' : undefined }}>
            {rolling && !revelado ? <span className="sud-dots">•••</span> : suma ?? 7}
          </strong>
          {revelado && zg && (
            <span className="sud-tag">{zg === 'abajo' ? 'ABAJO' : zg === 'siete' ? 'LUCKY 7' : 'ARRIBA'}</span>
          )}
        </div>
      ))}

      {P('campana', (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, width: '100%' }}>
          {barras.map((b) => {
            const on = suma === b.suma && revelado;
            const es7 = b.zona === 'siete';
            return (
              <div key={b.suma} style={{
                flex: 1, minWidth: 0, borderRadius: '3px 3px 0 0',
                height: `${Math.round(b.frac * 100 * (on ? 1.08 : 1))}%`,
                background: es7 ? 'var(--accent)' : 'var(--surface-alt)',
                opacity: on ? 1 : es7 ? 0.7 : 0.45,
                outline: on ? `1px solid ${lucky ? '#f3d27a' : 'var(--accent)'}` : 'none',
                boxShadow: on && lucky ? '0 0 10px rgba(243,210,122,.45)' : undefined,
                transition: 'height .25s ease, opacity .2s',
              }} />
            );
          })}
        </div>
      ))}

      {P('zonas', (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, width: '100%', pointerEvents: editando ? 'none' : 'auto', overflow: 'visible', paddingBottom: 10 }}>
          {ZONAS.map((z) => {
            const selZ = est.zona === z;
            const win = (fase === 'gano' || fase === 'perdio') && zg === z;
            const lost = fase === 'perdio' && selZ && !win;
            return (
              <button key={z} disabled={rolling} onClick={() => { onUnlock?.(); if (!rolling) onZona(z); }} style={zonaBtn(win, selZ, lost, fase, estiloZonas, z === 'siete')}>
                <div style={{ fontWeight: 800, fontSize: `${11.5 * estiloZonas.escala / 100}px`, letterSpacing: z === 'siete' ? '.04em' : undefined, color: z === 'siete' ? estiloZonas.acento : estiloZonas.texto }}>{ZONA_INFO[z].nombre}</div>
                <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: 9.5, color: 'var(--text-dim)', margin: '2px 0 5px' }}>{ZONA_INFO[z].rango}</div>
                <div style={{ fontFamily: 'var(--in-num, monospace)', fontSize: `${14 * estiloZonas.escala / 100}px`, color: win || lost ? estiloZonas.texto : estiloZonas.acento }}>{pagoDe(cfg, z).toFixed(2)}×</div>
                {selZ && <ChipZona valor={est.apuesta} imagen={fichaActiva?.imagen_url ?? null} win={win} lost={lost} />}
              </button>
            );
          })}
        </div>
      ))}

      {P('apuesta', (
        <div style={{ pointerEvents: editando ? 'none' : 'auto' }}>
          {fichas.length > 0
            ? <FichasStrip fichas={fichas} apuesta={est.apuesta} bloqueado={rolling} onElegir={onApuesta} modo={modoFichas} abanicoApertura={abanicoApertura} abanicoArco={abanicoArco} />
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button disabled={rolling} onClick={() => onApuesta(Math.max(minBet, est.apuesta - paso))} style={stepBtn}>−</button>
                <span style={{ minWidth: 96, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  <span className="hint" style={{ display: 'block', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>Apuesta</span>
                  <strong style={{ fontSize: 15, color: 'var(--text)' }}>{fmt(est.apuesta)}</strong>
                </span>
                <button disabled={rolling} onClick={() => onApuesta(Math.min(maxBet, est.apuesta + paso))} style={stepBtn}>+</button>
              </div>
            )}
        </div>
      ))}

      {P('boton', (
        <div>
        {auto && !editando && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <BotonAuto enFlujo restantes={auto.restantes} activo={auto.activo} disabled={auto.disabled}
              onStart={auto.onStart} onStop={auto.onStop} />
          </div>
        )}
        <button
          className="jg-play-flow"
          onClick={() => {
            if (editando) return;
            onUnlock?.();
            onJugar();
          }}
          disabled={rolling || !!auto?.activo || est.saldo < est.apuesta}
          style={{
            position: 'relative', overflow: 'hidden',
            width: '100%', border: `1px solid ${estiloBoton.borde}`, borderRadius: estiloBoton.radio, cursor: editando ? 'move' : 'pointer',
            fontFamily: 'var(--in-num, var(--in-body, inherit))', fontWeight: 800, letterSpacing: '.12em', fontSize: `${16 * estiloBoton.escala / 100}px`, color: estiloBoton.texto,
            ...(cfg.botonImg
              ? { aspectRatio: '5 / 1', textShadow: '0 1px 4px rgba(0,0,0,.6)' }
              : { padding: '13px 0', background: (rolling || est.saldo < est.apuesta) ? estiloBoton.bloqueado : estiloBoton.fondo, boxShadow: `0 10px 26px -8px rgba(0,0,0,${estiloBoton.sombra / 100})` }),
            opacity: (rolling || est.saldo < est.apuesta) ? 0.72 : 1,
            transition: 'transform .12s ease, opacity .15s',
          }}>
          {cfg.botonImg && <span aria-hidden style={estiloImg(cfg.botonImg, cfg.arte.boton)} />}
          {rolling && <span aria-hidden className="sud-shine" />}
          <span style={{ position: 'relative' }}>{rolling ? 'TIRANDO' : 'TIRAR'}</span>
        </button>
        </div>
      ))}
    </div>
  );
}

function zonaBtn(win: boolean, sel: boolean, lost: boolean, fase: string, e: SieteUdCfg['estilos']['zonas'], luckyZona: boolean): CSSProperties {
  const fondo = win ? e.gana : lost ? e.pierde : sel ? e.seleccionado : e.fondo;
  const borde = win ? (luckyZona ? '#e8c583' : e.gana) : lost ? e.pierde : sel ? e.acento : e.borde;
  return {
    position: 'relative', overflow: 'visible',
    padding: '10px 4px 14px', borderRadius: e.radio, textAlign: 'center', cursor: fase === 'rolling' ? 'default' : 'pointer',
    border: `1px solid ${borde}`, background: fondo,
    boxShadow: win && luckyZona
      ? `0 7px 18px rgba(0,0,0,${e.sombra / 100}), 0 0 16px rgba(232,197,131,.4)`
      : sel || win ? `0 7px 18px rgba(0,0,0,${e.sombra / 100})` : luckyZona ? 'inset 0 1px 0 rgba(232,197,131,.18)' : undefined,
    opacity: (fase === 'gano' || fase === 'perdio') && !win && !lost ? 0.4 : 1,
    animation: win ? 'sud-win .55s ease' : undefined,
    transition: 'opacity .2s, box-shadow .2s, background .2s',
  };
}

const PIP: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function CaraMini({ n, gold }: { n: number; gold?: boolean }) {
  const on = new Set(PIP[n] || []);
  return (
    <span className={`sud-cara${gold ? ' gold' : ''}${n ? '' : ' empty'}`}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={on.has(i) ? 'on' : ''} />)}
    </span>
  );
}

function CountUp({ to, lucky }: { to: number; lucky: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || to <= 0) { setN(to); return; }
    const dur = lucky ? 920 : 560;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const ease = 1 - (1 - p) ** 3;
      setN(Math.round(to * ease));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, lucky]);
  return <>+{fmt(n)}</>;
}

function ChipZona({ valor, imagen, win, lost }: { valor: number; imagen: string | null; win: boolean; lost: boolean }) {
  const corto = valor >= 1_000_000 ? `${(valor / 1_000_000).toFixed(valor % 1_000_000 ? 1 : 0)}M`
    : valor >= 1000 ? `${(valor / 1000).toFixed(valor % 1000 ? 1 : 0)}k`
    : String(Math.round(valor));
  return (
    <span aria-hidden className={`sud-chip${win ? ' win' : ''}${lost ? ' lost' : ''}`}>
      <i style={{
        background: imagen
          ? `center / cover no-repeat url("${imagen}")`
          : 'radial-gradient(circle at 35% 30%, var(--accent-hover, #7d99ff), var(--accent, #6b8afd))',
      }}>{!imagen ? corto : null}</i>
    </span>
  );
}

const CSS_SUD = `
@keyframes sud-cartel{from{opacity:0;transform:scale(.78)}to{opacity:1;transform:scale(1)}}
@keyframes sud-suma{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}
@keyframes sud-win{0%,100%{transform:scale(1)}40%{transform:scale(1.045)}}
@keyframes sud-shine-move{from{transform:translateX(-140%) rotate(18deg)}to{transform:translateX(220%) rotate(18deg)}}
@keyframes sud-dots{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes sud-chip-in{from{opacity:0;transform:translateX(-50%) translateY(6px) scale(.55)}to{opacity:1;transform:translateX(-50%) scale(1)}}
.sud-shine{position:absolute;inset:-20% -40%;pointer-events:none;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.22) 50%,transparent 60%);animation:sud-shine-move 1.1s ease}
.sud-dots{display:inline-block;letter-spacing:.18em;animation:sud-dots 1s ease infinite}
.sud-placa{display:flex;align-items:center;gap:6px;padding:5px 12px 5px 7px;border-radius:13px;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.1);box-shadow:0 10px 22px -12px rgba(0,0,0,.55);white-space:nowrap}
.sud-placa.lucky{border-color:rgba(232,197,131,.45);box-shadow:0 10px 22px -12px rgba(0,0,0,.55),0 0 16px rgba(232,197,131,.25)}
.sud-placa.wait{opacity:.8}
.sud-placa strong{font-family:var(--in-num,monospace);font-size:26px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;min-width:1.2em}
.sud-op{color:var(--text-dim);font-size:13px;font-weight:700}
.sud-tag{font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--text-dim)}
.sud-placa.lucky .sud-tag{color:#f3d27a}
.sud-cara{width:22px;height:22px;border-radius:5px;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;padding:3px;gap:1px;background:linear-gradient(145deg,#f6f1e6,#c4b498);box-shadow:0 2px 6px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.28);flex-shrink:0}
.sud-cara.gold{background:linear-gradient(145deg,#f4d78a,#8a5410)}
.sud-cara.empty{opacity:.38}
.sud-cara i{width:3.5px;height:3.5px;border-radius:50%;margin:auto;background:transparent}
.sud-cara i.on{background:#1a1d24}
.sud-cara.gold i.on{background:#3a2108}
.sud-chip{position:absolute;left:50%;bottom:-12px;width:28px;height:28px;border-radius:50%;pointer-events:none;z-index:2;transform:translateX(-50%);animation:sud-chip-in .32s cubic-bezier(.2,1.3,.4,1);box-shadow:0 4px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)}
.sud-chip i{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;font-size:8px;font-weight:800;color:#fff;font-family:var(--in-num,monospace)}
.sud-chip.win{box-shadow:0 0 0 2px #e8c583,0 0 12px rgba(232,197,131,.55),0 4px 10px rgba(0,0,0,.45)}
.sud-chip.lost{filter:grayscale(.55) brightness(.72);opacity:.55}
.sud-hist{display:flex;align-items:center;gap:4px;max-width:210px;padding:3px 10px 3px 4px;border-radius:99px;background:rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);overflow:hidden;mask-image:linear-gradient(90deg,#000 84%,transparent);-webkit-mask-image:linear-gradient(90deg,#000 84%,transparent)}
.sud-hist-vacio{font-size:11px;color:var(--text-dim);padding:0 8px;opacity:.55}
.sud-hist-n{flex-shrink:0;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;font-variant-numeric:tabular-nums;font-family:var(--in-num,monospace);color:#d5dde8;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}
.sud-hist-n.abajo{background:rgba(80,140,220,.22);border-color:rgba(120,170,255,.28);color:#c5d8ff}
.sud-hist-n.arriba{background:rgba(220,90,70,.2);border-color:rgba(255,140,120,.28);color:#ffc8bc}
.sud-hist-n.siete{background:linear-gradient(180deg,#f3d27a,#b8862a);border-color:#e8c583;color:#2a1a04;box-shadow:0 2px 8px rgba(184,134,42,.4)}
.sud-hist-n.ok:not(.siete){box-shadow:0 0 0 1px rgba(79,208,138,.35)}
.sud-hist-n.nuevo{animation:sud-hist-in .35s cubic-bezier(.2,1.35,.4,1)}
@keyframes sud-hist-in{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){
  .sud-shine{animation:none;display:none}
  .sud-dots{animation:none}
  .sud-chip{animation:none}
  .sud-hist-n.nuevo{animation:none}
}
`;

const stepBtn: CSSProperties = {
  width: 38, height: 42, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-alt)',
  color: 'var(--text)', fontSize: 19, fontWeight: 700, cursor: 'pointer',
};
