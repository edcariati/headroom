import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { configurado, supabase } from './lib/supabase';
import Login from './pages/Login';
import Painel from './pages/Painel';
import Projetos from './pages/Projetos';
import ProjetoDetalhe from './pages/ProjetoDetalhe';
import NovoProjeto from './pages/NovoProjeto';
import Protocolos from './pages/Protocolos';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configurado) {
    return (
      <div className="centro"><div className="card">
        <h2>Configure o Supabase</h2>
        <p>Crie o arquivo <code>.env</code> a partir de <code>.env.example</code> com a URL e a chave anon do projeto.</p>
      </div></div>
    );
  }
  if (session === undefined) return <div className="centro">Carregando…</div>;
  if (!session) return <Login />;

  return (
    <div className="app">
      <header className="topo">
        <strong>Projetos Cariati</strong>
        <nav>
          <NavLink to="/" end>Painel</NavLink>
          <NavLink to="/projetos">Projetos</NavLink>
          <NavLink to="/protocolos">Protocolos</NavLink>
        </nav>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/projetos/novo" element={<NovoProjeto />} />
          <Route path="/projetos/:id" element={<ProjetoDetalhe />} />
          <Route path="/protocolos" element={<Protocolos />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
