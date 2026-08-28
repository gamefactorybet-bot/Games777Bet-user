import { useState } from 'react';
import { supabase } from './supabase.ts';

interface LoginProps {
  /** Se llama cuando el ingreso fue exitoso. */
  onEntrar: () => void;
}

export function Login({ onEntrar }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    if (!email.trim() || !password) {
      setMsgError(true);
      setMsg('Completá email y contraseña.');
      return;
    }

    setCargando(true);
    setMsgError(false);
    setMsg('Entrando...');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setCargando(false);

    if (error) {
      setMsgError(true);
      setMsg('Email o contraseña incorrectos.');
      return;
    }

    setMsg('');
    onEntrar();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 340, width: '100%' }}>
        <h2 style={{ marginTop: 0 }}>gameswin777</h2>
        <p className="hint" style={{ marginBottom: 16 }}>Ensamblador de juegos. Acceso solo para vos.</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label style={{ display: 'block', marginTop: 10 }}>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
          />
        </label>

        <button
          className="primary"
          style={{ width: '100%', marginTop: 16 }}
          disabled={cargando}
          onClick={entrar}
        >
          Entrar
        </button>
        <p className={msgError ? 'hint error' : 'hint'}>{msg}</p>
      </div>
    </div>
  );
}
