import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Cliente, Profile } from '../lib/types';
import { TIPOS_APROVACAO } from '../lib/labels';

export default function NovoProjeto() {
  const nav = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipe, setEquipe] = useState<Profile[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [novoCliente, setNovoCliente] = useState({ nome: '', codigo: '', categoria: '', premium: false, telefone: '', email: '' });
  const [nome, setNome] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [legal, setLegal] = useState(false);
  const [interiores, setInteriores] = useState(false);
  const [compl, setCompl] = useState(false);
  const [aprovacao, setAprovacao] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('clientes').select('*').order('nome').then(({ data }) => setClientes((data as Cliente[]) ?? []));
    supabase.from('profiles').select('*').order('nome').then(({ data }) => setEquipe((data as Profile[]) ?? []));
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErro('');
    try {
      let cid = clienteId;
      if (!cid) {
        const { data, error } = await supabase.from('clientes').insert({
          nome: novoCliente.nome, codigo: novoCliente.codigo || null, categoria: novoCliente.categoria || null,
          premium: novoCliente.premium, telefone: novoCliente.telefone || null, email: novoCliente.email || null,
        }).select('id').single();
        if (error) throw error;
        cid = data.id;
      }
      const { data, error } = await supabase.from('projetos').insert({
        cliente_id: cid, nome, responsavel_id: responsavel || null, tem_legal: legal,
        tem_interiores: interiores, tem_complementares: compl, tipo_aprovacao: legal ? aprovacao || null : null,
      }).select('id').single();
      if (error) throw error;
      nav(`/projetos/${data.id}`);
    } catch (err) {
      setErro((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="titulo"><h1>Novo projeto</h1></div>
      <form className="card form" onSubmit={salvar}>
        <label>Cliente
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">+ Cadastrar novo cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.codigo ? ` (${c.codigo})` : ''}</option>)}
          </select>
        </label>
        {!clienteId && (
          <fieldset>
            <legend>Dados do cliente</legend>
            <label>Nome<input required value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} /></label>
            <div className="duas">
              <label>Código<input placeholder="CA000123" value={novoCliente.codigo} onChange={(e) => setNovoCliente({ ...novoCliente, codigo: e.target.value })} /></label>
              <label>Categoria
                <select value={novoCliente.categoria} onChange={(e) => setNovoCliente({ ...novoCliente, categoria: e.target.value })}>
                  <option value="">—</option>{['A', 'B', 'C', 'D'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <div className="duas">
              <label>Telefone<input value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })} /></label>
              <label>E-mail<input type="email" value={novoCliente.email} onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={novoCliente.premium} onChange={(e) => setNovoCliente({ ...novoCliente, premium: e.target.checked })} />Cliente premium (pendrive na entrega)</label>
          </fieldset>
        )}
        <label>Nome do projeto<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label>Responsável
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            <option value="">—</option>{equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Escopo contratado (além do arquitetônico)</legend>
          <label className="check"><input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} />Projeto legal (aprovação na Prefeitura)</label>
          {legal && (
            <label>Tipo de aprovação
              <select value={aprovacao} onChange={(e) => setAprovacao(e.target.value)}>
                <option value="">—</option>{TIPOS_APROVACAO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          )}
          <label className="check"><input type="checkbox" checked={interiores} onChange={(e) => setInteriores(e.target.checked)} />Interiores (estudo + detalhamento)</label>
          <label className="check"><input type="checkbox" checked={compl} onChange={(e) => setCompl(e.target.checked)} />Projetos complementares</label>
        </fieldset>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={busy}>{busy ? 'Criando…' : 'Criar projeto'}</button>
      </form>
    </>
  );
}
