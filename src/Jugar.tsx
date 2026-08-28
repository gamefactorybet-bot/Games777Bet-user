import './styles.css';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cargarMotor } from '../motor/registro.js';
import { mostrarTablaPagos } from './tabla-pagos.ts';
import { animarSimboloGanador, detenerAnimacionesSimbolos, detenerAnimacionesJuego } from './lottie.ts';
import { crearEscenario } from './juego/escenario.ts';
import { crearRodillosJugar } from './juego/rodillos-jugar.ts';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { PantallaCarga } from './PantallaCarga.tsx';
import type { Escenario } from './juego/escenario.ts';
import type { RodillosJugar } from './juego/rodillos-jugar.ts';
import type { DatosJuego, MotorModulo, ResultadoGiro } from './types.ts';

// Pantalla jugable real, sin login: la abre directo el jugador cuando
// toca el juego en el portal de Win777, con ?slug=...&token=... en la
// URL. El token identifica al jugador pero por sí solo no mueve plata:
// cada giro lo resuelve el servidor (/api/jugar-girar), nunca acá.

const prevenir = (e: Event) => e.preventDefault();

export function Jugar() {
  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const rodRef = useRef<RodillosJugar | null>(null);
  const motorRef = useRef<MotorModulo | null>(null);
  const datosRef = useRef<DatosJuego | null>(null);
  const credRef = useRef<{ slug: string; token: string }>({ slug: '', token: '' });

  const [fase, setFase] = useState<'cargando' | 'error' | 'jugando'>('cargando');
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug') || '';
    const token = params.get('token') || '';
    credRef.current = { slug, token };

    document.addEventListener('contextmenu', prevenir);
    document.addEventListener('dragstart', prevenir);
    window.addEventListener('resize', alRedimensionar);
    window.addEventListener('orientationchange', alRedimensionar);

    let cancelado = false;

    if (!slug || !token) {
      setError('Falta el juego o el token de acceso.');
      setFase('error');
    } else {
      (async () => {
        try {
          const [datos, balance] = await Promise.all([
            fetchJson<DatosJuego>(`/api/jugar-datos?slug=${encodeURIComponent(slug)}`),
            fetchJson<{ saldo: number }>(`/api/jugar-balance?token=${encodeURIComponent(token)}`),
          ]);
          const motor = await cargarMotor(datos.juego.motor);
          if (cancelado || !hostRef.current) return;

          datosRef.current = datos;
          motorRef.current = motor;

          const esc = crearEscenario({
            modo: 'jugar', motor,
            juego: datos.juego, simbolos: datos.simbolos, sonidos: datos.sonidos, efectos: datos.efectos,
            premios: datos.premios, digitos: datos.digitos, capasLibres: datos.capasLibres,
            animaciones: datos.animaciones, cadenasLuces: datos.cadenasLuces, botones: datos.botones,
          });
          escRef.current = esc;
          esc.saldo = Number(balance.saldo);
          esc.saldoEl.textContent = esc.saldo.toLocaleString('es-PY');
          esc.el.style.opacity = '0';
          esc.el.style.transition = 'opacity .45s';
          hostRef.current.appendChild(esc.wrap);

          const rod = crearRodillosJugar(esc, motor, datos.simbolos);
          rodRef.current = rod;
          requestAnimationFrame(rod.pintarGrillaInicial);

          esc.btnGirar.addEventListener('click', girar);
          esc.el.querySelector('[data-info]')!.addEventListener('click', () => {
            if (escRef.current && datosRef.current) mostrarTablaPagos(escRef.current.el, datosRef.current.simbolos, datosRef.current.juego);
          });

          setFase('jugando');

          // La descarga empieza YA; la intro (si hay) corre en paralelo.
          const descarga = esperarRecursos(datos, (hechos, total) => setProgreso({ hechos, total }));
          const intro = (datos.animaciones || []).find((a) => a.evento === 'intro' && a.lottie_url);
          if (intro && pantallaRef.current) await correrIntro(intro, pantallaRef.current);
          await descarga;

          if (cancelado) return;
          esc.el.style.opacity = '1';
          setPantallaVisible(false);
          setTimeout(() => { if (!cancelado) setPantallaMontada(false); }, 400);
        } catch (err) {
          if (!cancelado) {
            setError((err as Error).message || 'No se pudo cargar el juego.');
            setFase('error');
          }
        }
      })();
    }

    return () => {
      cancelado = true;
      document.removeEventListener('contextmenu', prevenir);
      document.removeEventListener('dragstart', prevenir);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', alRedimensionar);
      rodRef.current?.destruir();
      escRef.current?.destruir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alRedimensionar = () => {
    if (!escRef.current?.girando) rodRef.current?.pintarGrillaInicial();
  };

  const girar = async () => {
    const esc = escRef.current, rod = rodRef.current, motor = motorRef.current, datos = datosRef.current;
    if (!esc || !rod || !motor || !datos || esc.girando) return;
    if (esc.saldo < esc.apuesta) { alert('No te alcanza el saldo para esta apuesta.'); return; }

    esc.girando = true;
    esc.btnGirar.disabled = true;
    esc.ocultarPremio();

    if (esc.audios.musica_fondo && esc.audios.musica_fondo.paused) esc.audios.musica_fondo.play().catch(() => {});
    if (esc.audios.giro) { esc.audios.giro.currentTime = 0; esc.audios.giro.play().catch(() => {}); }

    const { slug, token } = credRef.current;
    // El pedido sale YA, pero no se espera acá: sigue de largo.
    const pedido = fetchJson<ResultadoGiro>('/api/jugar-girar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta: esc.apuesta, clientId: crypto.randomUUID() }),
    });

    rod.limpiarGanadoras();
    detenerAnimacionesSimbolos();
    detenerAnimacionesJuego();
    esc.lanzarAnimaciones('girar');

    const arranque = rod.arrancar();

    let resultado: ResultadoGiro;
    try {
      resultado = await pedido;
    } catch (err) {
      rod.detener();
      alert((err as Error).message || 'No se pudo resolver el giro. Probá de nuevo.');
      esc.girando = false;
      esc.btnGirar.disabled = false;
      return;
    }

    // Un mínimo de giro parejo antes de empezar a frenar.
    const restante = 750 / esc.velocidad - (Date.now() - arranque);
    if (restante > 0) await new Promise((r) => setTimeout(r, restante));

    const { grilla, premio, nivel, saldo: saldoNuevo, simbolosGanadores } = resultado;
    const { COLUMNAS, FILA_PAGO } = motor;

    const ranuras = Array.from({ length: COLUMNAS }, (_, col) => rod.frenar(col, grilla[col]));
    await rod.esperarFrenado();

    esc.saldo = Number(saldoNuevo);
    esc.saldoEl.textContent = esc.saldo.toLocaleString('es-PY');

    if (premio > 0 && nivel) {
      esc.mostrarPremio(premio, nivel);
      esc.lanzarAnimaciones(nivel === 'premio_mayor' ? 'premio_mayor' : 'premio_chico');

      const columnasGanadoras = simbolosGanadores?.length ? simbolosGanadores : Array.from({ length: COLUMNAS }, (_, i) => i);
      for (let col = 0; col < COLUMNAS; col++) {
        if (!columnasGanadoras.includes(col)) continue;
        const celdaGanadora = rod.celdaEn(col, ranuras[col] + FILA_PAGO);
        if (!celdaGanadora) continue;
        celdaGanadora.classList.add('celda-ganadora');
        animarSimboloGanador(celdaGanadora, grilla[col][FILA_PAGO], nivel);
      }

      const ef = datos.efectos.find((e) => e.tipo === 'premio' && e.nivel_premio === nivel);
      if (ef) {
        const efectoPremio = esc.efectoPremio;
        efectoPremio.className = 'efecto-premio';
        efectoPremio.style.animation = 'none';
        void efectoPremio.offsetWidth;
        efectoPremio.style.cssText = `position:absolute; inset:0; pointer-events:none; ${ef.posicion === 'linea' ? 'top:33%; height:33%;' : ''}`;
        efectoPremio.style.animation = '';
      }
      const sonidoPremio = nivel === 'premio_mayor' ? esc.audios.premio_grande : esc.audios.premio_chico;
      if (sonidoPremio) { sonidoPremio.currentTime = 0; sonidoPremio.play().catch(() => {}); }
    }

    esc.girando = false;
    esc.btnGirar.disabled = false;
  };

  if (fase === 'error') {
    return <p style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</p>;
  }

  const juego = datosRef.current?.juego;
  const imagenCarga = juego ? ((juego.carga_url as string) || (juego.portada_url as string) || null) : null;

  return (
    <>
      <style>{`
        body { overflow: hidden; }
        #app, #app * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        #app img { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
        #app button, #app button * { pointer-events: auto; }
      `}</style>

      <div ref={hostRef} />

      {pantallaMontada && (
        <PantallaCarga
          ref={pantallaRef}
          imagen={imagenCarga}
          nombre={juego?.nombre || ''}
          hechos={progreso.hechos}
          total={progreso.total}
          visible={pantallaVisible}
        />
      )}
    </>
  );
}

createRoot(document.getElementById('app')!).render(<Jugar />);
