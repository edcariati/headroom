import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro('E-mail ou senha incorretos.');
    setBusy(false);
  }

  return (
    <div className="centro">
      <form className="card login" onSubmit={entrar}>
        <h1>Projetos Cariati</h1>
        <p className="mudo">Setor de Projetos</p>
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" /></label>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
