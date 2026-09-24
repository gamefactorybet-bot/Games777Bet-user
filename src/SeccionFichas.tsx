import { useEffect, useState } from 'react';
import { subirArchivo } from './juego/subir.ts';
import { fichasCfgSlot } from '../motor/fichas.js';
import type { Ficha, FichasCfg, Juego } from './types.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');

// Editor de las fichas de apuesta rápida. Sirve para cualquier motor —
// se muestra en "Jugabilidad" de todos. Guarda en `juegos.fichas_cfg`.
export function SeccionFichas({ juego, onCampo, ubicacion = 'arrastre' }: {
  juego: Juego;
  onCampo: (campo: string, valor: unknown) => void | Promise<void>;
  /** Cómo se ubican las fichas en este motor:
   *  - 'arrastre': se arrastran en la vista previa, posición por ficha.
   *  - 'tira': fila centrada (Limbo/Dice), sin posición.
   *  - 'grupo': van juntas donde se ubica el grupo de fichas (slots/ruleta). */
  ubicacion?: 'arrastre' | 'tira' | 'grupo';
}) {
  const conPos = ubicacion === 'arrastre' || ubicacion === 'grupo';
  // El abanico va en todos: arrastre (ancla libre), tira (centrado) y
  // grupo (slots: el ancla es la posición de la primera ficha / grupo).
  const conAbanico = true;
  const cfgDe = (j: Juego) => fichasCfgSlot(j.fichas_cfg) as FichasCfg;
  const [cfg, setCfg] = useState<FichasCfg>(() => cfgDe(juego));
  useEffect(() => { setCfg(cfgDe(juego)); }, [juego.id]);
  const [msg, setMsg] = useState('');

  const guardar = (fichas: Ficha[], sinCaja = cfg.sinCaja, modo = cfg.modo, extra: Partial<FichasCfg> = {}) => {
    const next: FichasCfg = {
      fichas, sinCaja, modo,
      abanicoApertura: cfg.abanicoApertura, abanicoArco: cfg.abanicoArco,
      abanicoOrden: cfg.abanicoOrden, abanicoSale: cfg.abanicoSale,
      ...extra,
    };
    setCfg(next);
    onCampo('fichas_cfg', next);
    setMsg('Guardado ✓');
  };
  const setFicha = (i: number, p: Partial<Ficha>) =>
    guardar(cfg.fichas.map((f, k) => (k === i ? { ...f, ...p } : f)));
  const moverFicha = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cfg.fichas.length) return;
    const fichas = cfg.fichas.slice();
    const [item] = fichas.splice(i, 1);
    fichas.splice(j, 0, item);
    guardar(fichas);
  };

  const usar = cfg.fichas.length > 0;
  const minBet = Number(juego.min_bet) || 1000;

  return (
    <div className="card fade-in" style={{ marginTop: 16 }}>
      <strong style={{ fontSize: 15 }}>Fichas de apuesta rápida</strong>
      <p className="hint" style={{ marginBottom: 12 }}>
        Botones redondos para fijar la apuesta de una. Sirve para cualquier juego.
        Cada ficha tiene su valor, una imagen redonda con su tamaño, el tamaño del botón y su posición.
        Sin fichas cargadas, el juego usa los −/+ de siempre.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: usar ? 16 : 0 }}>
        <input
          type="checkbox"
          checked={usar}
          onChange={(e) => {
            if (e.target.checked && !usar) {
              guardar([1, 2, 5, 20].map((m, k) => ({
                valor: minBet * m, imagen_url: null,
                x: 26 + k * 16, y: 88, tam: 54, imgTam: 88,
              })));
            } else if (!e.target.checked) {
              guardar([]);
            }
          }}
        />
        Usar fichas en este juego
      </label>

      {usar && (
        <>
          {conAbanico && (
            <div className="grupo-nav" style={{ marginBottom: 14 }}>
              <button className={`grupo-btn ${cfg.modo !== 'abanico' ? 'on' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'fila')}>Fila (todas visibles)</button>
              <button className={`grupo-btn ${cfg.modo === 'abanico' ? 'on' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  const gx = Number(juego.fichas_x ?? 50);
                  const gy = Number(juego.fichas_y ?? 88);
                  const fichas = ubicacion === 'grupo'
                    ? cfg.fichas.map((f, i) => (i === 0 ? { ...f, x: gx, y: gy } : f))
                    : cfg.fichas;
                  guardar(fichas, cfg.sinCaja, 'abanico');
                }}>Abanico (una sola)</button>
            </div>
          )}
          {cfg.modo === 'abanico' && conAbanico && (
            <div style={{ margin: '0 0 14px' }}>
              <p className="hint" style={{ margin: '0 0 10px' }}>
                Solo se ve la ficha activa. Al tocarla se abren las demás alrededor; elegir una
                la reemplaza y todo se repliega.
                {conPos && ' La posición de la primera ficha es la del botón cerrado.'}
                {ubicacion === 'grupo' && ' En slots, el ancla es la posición de la primera ficha (slider o arrastre en la Vista previa).'}
                {ubicacion === 'tira' && ' En este juego el abanico queda centrado.'}
              </p>
              <RangoMini
                etiqueta="Apertura (qué tan lejos vuelan)"
                unidad="%"
                min={50} max={220}
                valor={cfg.abanicoApertura ?? 100}
                onInput={(n) => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoApertura: n })}
              />
              <RangoMini
                etiqueta="Arco (qué tan abierto, hacia arriba)"
                unidad="°"
                min={70} max={180}
                valor={cfg.abanicoArco ?? 136}
                onInput={(n) => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoArco: n })}
              />
              {(
                <>
                  <p className="hint" style={{ margin: '12px 0 8px' }}>
                    Orden en el arco, de izquierda a derecha. Cada ficha se queda en su lugar; la activa deja el hueco.
                  </p>
                  <div className="grupo-nav" style={{ marginBottom: 8 }}>
                    <button type="button" className={`grupo-btn ${cfg.abanicoOrden === 'valor' ? 'on' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoOrden: 'valor' })}>Menor a mayor</button>
                    <button type="button" className={`grupo-btn ${cfg.abanicoOrden === 'lista' ? 'on' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoOrden: 'lista' })}>Como la lista</button>
                    <button type="button" className={`grupo-btn ${cfg.abanicoOrden === 'valor-inv' ? 'on' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoOrden: 'valor-inv' })}>Mayor a menor</button>
                  </div>
                  <p className="hint" style={{ margin: '0 0 8px' }}>De qué lado empiezan a salir.</p>
                  <div className="grupo-nav" style={{ marginBottom: 4 }}>
                    <button type="button" className={`grupo-btn ${cfg.abanicoSale === 'centro' ? 'on' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoSale: 'centro' })}>Centro</button>
                    <button type="button" className={`grupo-btn ${cfg.abanicoSale === 'izquierda' ? 'on' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoSale: 'izquierda' })}>Izquierda</button>
                    <button type="button" className={`grupo-btn ${cfg.abanicoSale === 'derecha' ? 'on' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => guardar(cfg.fichas, cfg.sinCaja, 'abanico', { abanicoSale: 'derecha' })}>Derecha</button>
                  </div>
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cfg.fichas.map((f, i) => (
              <div key={i} style={{ border: '1px solid var(--border-soft)', borderRadius: 10, padding: 12, background: 'var(--surface-alt)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <label
                    title={f.imagen_url ? 'Cambiar · clic derecho para quitar' : 'Subir imagen redonda'}
                    onContextMenu={(e) => { e.preventDefault(); if (f.imagen_url) setFicha(i, { imagen_url: null }); }}
                    style={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden',
                      border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: 'var(--text-dim)',
                      background: f.imagen_url
                        ? `center/cover no-repeat var(--bg) url("${f.imagen_url}")`
                        : 'radial-gradient(circle at 35% 30%, var(--accent-hover), var(--accent))',
                    }}
                  >
                    {!f.imagen_url && '+'}
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
                      const url = await subirArchivo(file, `fichas/${juego.id}`);
                      if (url) setFicha(i, { imagen_url: url });
                    }} />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Valor
                    <input type="number" min={1} value={f.valor}
                      onChange={(e) => setFicha(i, { valor: Math.max(1, Number(e.target.value) || 1) })}
                      style={{ width: 96, marginLeft: 6, fontFamily: 'var(--mono)', textAlign: 'center' }} />
                  </label>
                  {cfg.modo === 'abanico' && cfg.abanicoOrden === 'lista' && cfg.fichas.length > 1 && (
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button type="button" title="Subir en el abanico" disabled={i === 0}
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => moverFicha(i, -1)}>↑</button>
                      <button type="button" title="Bajar en el abanico" disabled={i === cfg.fichas.length - 1}
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => moverFicha(i, 1)}>↓</button>
                    </span>
                  )}
                  {cfg.fichas.length > 1 && (
                    <button style={{ marginLeft: cfg.modo === 'abanico' && cfg.abanicoOrden === 'lista' ? 0 : 'auto', fontSize: 12, color: 'var(--danger)' }}
                      onClick={() => guardar(cfg.fichas.filter((_, k) => k !== i))}>Eliminar</button>
                  )}
                </div>

                <RangoMini etiqueta="Tamaño del botón" unidad="px" min={28} max={140} valor={f.tam} onInput={(n) => setFicha(i, { tam: n })} />
                <RangoMini etiqueta="Tamaño de la imagen" unidad="%" min={30} max={100} valor={f.imgTam} onInput={(n) => setFicha(i, { imgTam: n })} />
                {conPos && (cfg.modo !== 'abanico' || i === 0) && (
                  <>
                    <RangoMini etiqueta={cfg.modo === 'abanico' ? 'Posición X (botón)' : 'Posición X'} unidad="%" min={0} max={100} valor={f.x} onInput={(n) => setFicha(i, { x: n })} />
                    <RangoMini etiqueta={cfg.modo === 'abanico' ? 'Posición Y (botón)' : 'Posición Y'} unidad="%" min={0} max={100} valor={f.y} onInput={(n) => setFicha(i, { y: n })} />
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            className="add-sym"
            style={{ marginTop: 12 }}
            onClick={() => guardar([...cfg.fichas, {
              valor: minBet * 10, imagen_url: null, x: 50, y: 88, tam: 54, imgTam: 88,
            }])}
          >+ Agregar ficha</button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '16px 0 0' }}>
            <input
              type="checkbox"
              checked={!!cfg.sinCaja}
              onChange={(e) => guardar(cfg.fichas, e.target.checked)}
            />
            Dejar solo las fichas (ocultar el recuadro de apuesta)
          </label>

          <p className="hint" style={{ margin: '10px 0 0' }}>
            {ubicacion === 'tira' && <>En este juego las fichas van en una fila centrada, sin posición propia. {msg}</>}
            {ubicacion === 'grupo' && <>Cada ficha tiene su posición (sliders acá, o arrastrala en la <b>Vista previa</b>). {msg}</>}
            {ubicacion === 'arrastre' && <>También podés arrastrarlas en la <b>Vista previa</b> (⚙ Ajustar → Controles → <b>Fichas</b>). {msg}</>}
          </p>
        </>
      )}
    </div>
  );
}

function RangoMini({ etiqueta, unidad, min, max, valor, onInput }: {
  etiqueta: string; unidad?: string; min: number; max: number; valor: number; onInput: (n: number) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 3 }}>
        <span>{etiqueta}</span>
        <b style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt(valor)}{unidad ? ' ' + unidad : ''}</b>
      </div>
      <input type="range" min={min} max={max} value={valor}
        onChange={(e) => onInput(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}
