import { useEffect, useState } from 'react';
import { subirArchivo } from './juego/subir.ts';
import { fichasConDefaults } from '../motor/fichas.js';
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
  const conPos = ubicacion === 'arrastre';
  const [cfg, setCfg] = useState<FichasCfg>(() => fichasConDefaults(juego.fichas_cfg) as FichasCfg);
  useEffect(() => { setCfg(fichasConDefaults(juego.fichas_cfg) as FichasCfg); }, [juego.id]);
  const [msg, setMsg] = useState('');

  const guardar = (fichas: Ficha[]) => {
    const next = { fichas };
    setCfg(next);
    onCampo('fichas_cfg', next);
    setMsg('Guardado ✓');
  };
  const setFicha = (i: number, p: Partial<Ficha>) =>
    guardar(cfg.fichas.map((f, k) => (k === i ? { ...f, ...p } : f)));

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
                  {cfg.fichas.length > 1 && (
                    <button style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--danger)' }}
                      onClick={() => guardar(cfg.fichas.filter((_, k) => k !== i))}>Eliminar</button>
                  )}
                </div>

                <RangoMini etiqueta="Tamaño del botón" unidad="px" min={28} max={140} valor={f.tam} onInput={(n) => setFicha(i, { tam: n })} />
                <RangoMini etiqueta="Tamaño de la imagen" unidad="%" min={30} max={100} valor={f.imgTam} onInput={(n) => setFicha(i, { imgTam: n })} />
                {conPos && (
                  <>
                    <RangoMini etiqueta="Posición X" unidad="%" min={0} max={100} valor={f.x} onInput={(n) => setFicha(i, { x: n })} />
                    <RangoMini etiqueta="Posición Y" unidad="%" min={0} max={100} valor={f.y} onInput={(n) => setFicha(i, { y: n })} />
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

          <p className="hint" style={{ margin: '12px 0 0' }}>
            {ubicacion === 'tira' && <>En este juego las fichas van en una fila centrada, sin posición propia. {msg}</>}
            {ubicacion === 'grupo' && <>Las fichas se ubican todas juntas donde pongas el <b>grupo de fichas</b> (⚙ Ajustar → Capas). {msg}</>}
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
