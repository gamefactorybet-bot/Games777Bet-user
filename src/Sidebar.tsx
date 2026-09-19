import type { VistaPanel } from './App.tsx';

interface SidebarProps {
  vista: VistaPanel;
  cantidadJuegos: number;
  cantidadListos: number;
  email: string;
  onIr: (v: VistaPanel) => void;
  onSalir: () => void;
}

/**
 * Barra lateral del panel. Solo lleva a los tres lugares que existen
 * de verdad (Juegos, Catálogo, Clientes). Los perfiles y la rotación
 * de RTP viven dentro del editor de cada juego, no acá.
 */
export function Sidebar({ vista, cantidadJuegos, cantidadListos, email, onIr, onSalir }: SidebarProps) {
  return (
    <aside className="side">
      <div className="side-brand">
        <img className="logo" src="/icon-192.png" alt="" />
        <b>gameswin777</b>
      </div>

      <div className="side-label">Contenido</div>
      <button className={`side-item ${vista === 'juegos' ? 'on' : ''}`} onClick={() => onIr('juegos')}>
        <IconoGrilla />
        Juegos
        <span className="side-count">{cantidadJuegos}</span>
      </button>
      <button className={`side-item ${vista === 'catalogo' ? 'on' : ''}`} onClick={() => onIr('catalogo')}>
        <IconoCapas />
        Catálogo
        <span className="side-count">{cantidadListos}</span>
      </button>

      <div className="side-label">Operación</div>
      <button className={`side-item ${vista === 'clientes' ? 'on' : ''}`} onClick={() => onIr('clientes')}>
        <IconoClientes />
        Clientes
      </button>
      <button className={`side-item ${vista === 'apariencia' ? 'on' : ''}`} onClick={() => onIr('apariencia')}>
        <IconoApariencia />
        Apariencia
      </button>

      <div className="side-foot">
        <div className="side-who" title={email}>{email}</div>
        <button className="side-item" onClick={onSalir}>
          <IconoSalir />
          Salir
        </button>
      </div>
    </aside>
  );
}

/* Íconos: trazo simple, heredan color del texto. */
function IconoGrilla() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconoCapas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 8 9 5 9-5" />
    </svg>
  );
}
function IconoClientes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconoApariencia() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="10.5" r="2.5" />
      <circle cx="17.5" cy="14.5" r="2.5" /><circle cx="9" cy="18" r="2.5" />
    </svg>
  );
}
function IconoSalir() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
