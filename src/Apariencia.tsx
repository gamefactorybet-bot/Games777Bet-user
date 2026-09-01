import { useState } from 'react';
import {
  TEMAS, APARIENCIA_DEFECTO,
  cargarApariencia, guardarApariencia, aplicarApariencia,
  type Apariencia as AparienciaT, type Tema,
} from './apariencia.ts';

function degradado(t: Tema) {
  return `linear-gradient(135deg, ${t.amb[0]}, ${t.amb[1]} 55%, ${t.amb[2]})`;
}

function Toggle({ etiqueta, valor, onCambio }: { etiqueta: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <div
      className={`ap-tgl ${valor ? 'on' : ''}`}
      role="switch"
      aria-checked={valor}
      tabIndex={0}
      onClick={() => onCambio(!valor)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCambio(!valor); } }}
    >
      <span>{etiqueta}</span>
      <span className="box" />
    </div>
  );
}

/**
 * Pantalla de apariencia: elegir hasta 2 temas de vidrio, y ajustar
 * opacidad, desenfoque, gotas y fondo. Todo se aplica en vivo (escribe
 * en :root) y se guarda en localStorage.
 */
export function Apariencia() {
  const [ap, setAp] = useState<AparienciaT>(cargarApariencia);

  const aplicar = (sig: AparienciaT) => {
    aplicarApariencia(sig);
    guardarApariencia(sig);
    setAp(sig);
  };
  const set = (cambio: Partial<AparienciaT>) => aplicar({ ...ap, ...cambio });

  const toggleTema = (id: string) => {
    const temas = [...ap.temas];
    const i = temas.indexOf(id);
    if (i > -1) {
      if (temas.length > 1) temas.splice(i, 1); // nunca dejar la lista vacía
    } else {
      if (temas.length >= 2) temas.shift();     // máximo 2, entra el nuevo
      temas.push(id);
    }
    aplicar({ ...ap, temas });
  };

  const nombres = ap.temas.map((id) => TEMAS.find((t) => t.id === id)?.nombre).filter(Boolean).join(' + ');

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Tema de color</strong>
        <p className="hint" style={{ marginBottom: 14 }}>
          Elegí hasta 2. El fondo mezcla sus colores en un degradado que se mueve despacio —
          con uno solo queda más sobrio, con dos toma vida.
        </p>
        <div className="ap-grid">
          {TEMAS.map((t) => {
            const i = ap.temas.indexOf(t.id);
            return (
              <button
                key={t.id}
                className={`ap-sw ${i > -1 ? 'on' : ''}`}
                onClick={() => toggleTema(t.id)}
              >
                <div className="grad" style={{ background: degradado(t) }} />
                <div className="pick">{ap.temas.length > 1 && i > -1 ? i + 1 : '✓'}</div>
                <div className="lbl"><span className="ac" style={{ background: t.accent }} />{t.nombre}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Vidrio y fondo</strong>
        <p className="hint" style={{ marginBottom: 16 }}>Se guarda en este navegador.</p>

        <div className="ap-ctl">
          <div className="row"><label htmlFor="ap-op">Opacidad de los paneles</label><span>{ap.opacidad}%</span></div>
          <input id="ap-op" type="range" min={30} max={100} value={ap.opacidad}
            onChange={(e) => set({ opacidad: Number(e.target.value) })} />
        </div>
        <div className="ap-ctl">
          <div className="row"><label htmlFor="ap-blur">Desenfoque</label><span>{ap.desenfoque} px</span></div>
          <input id="ap-blur" type="range" min={0} max={30} value={ap.desenfoque}
            onChange={(e) => set({ desenfoque: Number(e.target.value) })} />
        </div>
        <div className="ap-ctl">
          <div className="row"><label htmlFor="ap-fondo">Intensidad del degradado de fondo</label><span>{ap.fondo}%</span></div>
          <input id="ap-fondo" type="range" min={0} max={90} value={ap.fondo}
            onChange={(e) => set({ fondo: Number(e.target.value) })} />
        </div>

        <Toggle etiqueta="Gotas de agua sobre el vidrio" valor={ap.gotas} onCambio={(v) => set({ gotas: v })} />
        <Toggle etiqueta="Movimiento (el fondo respira lento)" valor={ap.movimiento} onCambio={(v) => set({ movimiento: v })} />

        <button style={{ marginTop: 14 }} onClick={() => aplicar({ ...APARIENCIA_DEFECTO })}>
          Restablecer
        </button>
      </div>

      <div className="card">
        <strong style={{ fontSize: 15 }}>Vista previa</strong>
        <p className="hint" style={{ marginBottom: 14 }}>{nombres}</p>
        <div className="ap-preview">
          <div className="ambient" aria-hidden>
            <b className="a1" /><b className="a2" /><b className="a3" /><b className="a4" /><b className="a5" />
          </div>
          <div className="pv-side">
            <div className="pv-on">Juegos</div>
            <div>Catálogo</div>
            <div>Clientes</div>
          </div>
          <div className="pv-main">
            <div className="pv-card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge listo">Listo</span>
              <span className="badge en_prueba">En prueba</span>
              <span className="badge pub">Publicado</span>
            </div>
            <div className="pv-card">Fortuna Dorada · Slot 5×3</div>
          </div>
        </div>
      </div>
    </>
  );
}
