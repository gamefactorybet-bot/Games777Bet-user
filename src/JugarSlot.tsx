import { useEffect, useRef, useState } from 'react';
import { FichasEnEscenario } from './Fichas.tsx';
import { BotonAuto } from './BotonAuto.tsx';
import { useAutoplay } from './juego/autoplay.ts';
import { cargarMotor } from '../motor/registro.js';
import { mostrarTablaPagos } from './tabla-pagos.ts';
import { animarSimboloGanador, detenerAnimacionesSimbolos, detenerAnimacionesJuego } from './lottie.ts';
import { crearEscenario } from './juego/escenario.ts';
import { crearRodillosJugar } from './juego/rodillos-jugar.ts';
import { fetchJson, esperarRecursos, correrIntro } from './juego/recursos.ts';
import { planillaDe, posAuto } from './juego/planilla.ts';
import { PantallaCarga } from './PantallaCarga.tsx';
import type { Escenario } from './juego/escenario.ts';
import type { RodillosJugar } from './juego/rodillos-jugar.ts';
import type { DatosJuego, MotorModulo, ResultadoGiro } from './types.ts';

interface JugarSlotProps {
  datos: DatosJuego;
  saldoInicial: number;
  slug: string;
  token: string;
}

// Pantalla real de un slot. Cada giro lo resuelve el servidor
// (/api/jugar-girar); acá solo se muestra.
export function JugarSlot({ datos, saldoInicial, slug, token }: JugarSlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pantallaRef = useRef<HTMLDivElement>(null);
  const escRef = useRef<Escenario | null>(null);
  const rodRef = useRef<RodillosJugar | null>(null);
  const motorRef = useRef<MotorModulo | null>(null);

  const [progreso, setProgreso] = useState({ hechos: 0, total: 1 });
  const [pantallaVisible, setPantallaVisible] = useState(true);
  const [pantallaMontada, setPantallaMontada] = useState(true);
  const [escListo, setEscListo] = useState(false);
  const auto = useAutoplay();
  const girarRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelado = false;
    window.addEventListener('resize', alRedimensionar);
    window.addEventListener('orientationchange', alRedimensionar);

    (async () => {
      const motor = await cargarMotor(datos.juego.motor);
      if (cancelado || !hostRef.current) return;
      motorRef.current = motor;

      const esc = crearEscenario({
        modo: 'jugar', motor,
        juego: datos.juego, simbolos: datos.simbolos, sonidos: datos.sonidos, efectos: datos.efectos,
        premios: datos.premios, digitos: datos.digitos, capasLibres: datos.capasLibres,
        animaciones: datos.animaciones, cadenasLuces: datos.cadenasLuces, botones: datos.botones,
      });
      escRef.current = esc;
      esc.saldo = Number(saldoInicial);
      esc.saldoEl.textContent = esc.saldo.toLocaleString('es-PY');
      esc.el.style.opacity = '0';
      esc.el.style.transition = 'opacity .45s';
      hostRef.current.appendChild(esc.wrap);
      setEscListo(true);

      const rod = crearRodillosJugar(esc, motor, datos.simbolos);
      rodRef.current = rod;
      requestAnimationFrame(rod.pintarGrillaInicial);

      esc.btnGirar.addEventListener('click', girar);
      esc.el.querySelector('[data-info]')!.addEventListener('click', () => {
        if (escRef.current) mostrarTablaPagos(escRef.current.el, datos.simbolos, datos.juego);
      });

      const descarga = esperarRecursos(datos, (hechos, total) => setProgreso({ hechos, total }));
      const intro = (datos.animaciones || []).find((a) => a.evento === 'intro' && a.lottie_url);
      if (intro && pantallaRef.current) await correrIntro(intro, pantallaRef.current);
      await descarga;

      if (cancelado) return;
      esc.el.style.opacity = '1';
      setPantallaVisible(false);
      setTimeout(() => { if (!cancelado) setPantallaMontada(false); }, 400);
    })();

    return () => {
      cancelado = true;
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', alRedimensionar);
      rodRef.current?.destruir();
      escRef.current?.destruir();
      setEscListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alRedimensionar = () => {
    if (!escRef.current?.girando) rodRef.current?.pintarGrillaInicial();
  };

  const girar = async () => {
    const esc = escRef.current, rod = rodRef.current, motor = motorRef.current;
    if (!esc || !rod || !motor || esc.girando) return;
    if (esc.saldo < esc.apuesta) { alert('No te alcanza el saldo para esta apuesta.'); return; }

    esc.girando = true;
    esc.btnGirar.disabled = true;
    esc.ocultarPremio();

    if (esc.audios.musica_fondo && esc.audios.musica_fondo.paused) esc.audios.musica_fondo.play().catch(() => {});
    if (esc.audios.giro) { esc.audios.giro.currentTime = 0; esc.audios.giro.play().catch(() => {}); }

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
      auto.stop();
      return;
    }

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
    esc.btnGirar.disabled = auto.activo;
    auto.continuar(() => girarRef.current(), esc.saldo >= esc.apuesta);
  };
  girarRef.current = () => { void girar(); };

  useEffect(() => {
    const esc = escRef.current;
    if (esc) esc.btnGirar.disabled = auto.activo || esc.girando;
  }, [auto.activo]);

  const imagenCarga = (datos.juego.carga_url as string) || (datos.juego.portada_url as string) || null;
  const planilla = planillaDe(datos.juego);

  return (
    <>
      <div ref={hostRef} />
      {escListo && escRef.current && (
        <>
          {planilla.visibles.fichas && (
            <FichasEnEscenario juego={datos.juego} escenario={escRef.current} />
          )}
          {planilla.visibles.auto && (
          <BotonAuto
            host={escRef.current.el}
            {...posAuto(planilla, {
              x: escRef.current.posGirar.girar_x,
              y: escRef.current.posGirar.girar_y,
              tam: escRef.current.posGirar.girar_tamano,
            })}
            tam={planilla.autoTam}
            restantes={auto.restantes}
            activo={auto.activo}
            imagenUrl={planilla.autoImagen}
            disabled={escRef.current.saldo < escRef.current.apuesta}
            onStart={(n) => auto.start(n, () => girarRef.current())}
            onStop={auto.stop}
          />
          )}
        </>
      )}
      {pantallaMontada && (
        <PantallaCarga
          ref={pantallaRef}
          imagen={imagenCarga}
          nombre={datos.juego.nombre}
          hechos={progreso.hechos}
          total={progreso.total}
          visible={pantallaVisible}
        />
      )}
    </>
  );
}
