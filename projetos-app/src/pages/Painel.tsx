import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { EtapaModelo, Projeto, Protocolo } from '../lib/types';
import { FASES, diasAte, fmtData, statusProtocolo } from '../lib/labels';
import { MAX_DIAS_PAUSA, diasDePausa } from '../lib/flow';

export default function Painel() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [modelos, setModelos] = useState<EtapaModelo[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);

  useEffect(() => {
    supabase.from('projetos').select('*, clientes(nome,codigo), projeto_etapas(etapa_codigo,status)')
      .in('status', ['ativo', 'pausado']).order('created_at', { ascending: false })
      .then(({ data }) => setProjetos((data as Projeto[]) ?? []));
    supabase.from('etapa_modelos').select('*').order('ordem').then(({ data }) => setModelos((data as EtapaModelo[]) ?? []));
    supabase.from('protocolos').select('*, projetos(nome, clientes(nome))')
      .not('status', 'in', '(entregue_ao_cliente)').order('prazo', { ascending: true, nullsFirst: false })
      .then(({ data }) => setProtocolos((data as Protocolo[]) ?? []));
  }, []);

  const etapaAtual = (p: Projeto) => {
    const cod = p.projeto_etapas?.find((e) => e.status === 'em_andamento')?.etapa_codigo;
    return modelos.find((m) => m.codigo === cod);
  };
  const ativos = projetos.filter((p) => p.status === 'ativo');
  const pausados = projetos.filter((p) => p.status === 'pausado');
  const porFase = [1, 2, 3, 4].map((f) => ({ fase: f, itens: ativos.filter((p) => etapaAtual(p)?.fase === f) }));
  const atencao = protocolos.filter((p) => p.status === 'exigencia' || (diasAte(p.prazo) ?? 99) <= 3);
  const pausaCritica = pausados.filter((p) => diasDePausa(p.pausado_em) > MAX_DIAS_PAUSA - 30);

  return (
    <>
      <div className="titulo"><h1>Painel</h1><Link className="primario btn" to="/projetos/novo">+ Novo projeto</Link></div>
      <div className="kpis">
        <div className="kpi"><b>{ativos.length}</b><span>projetos ativos</span></div>
        <div className="kpi"><b>{pausados.length}</b><span>pausados</span></div>
        <div className="kpi"><b>{protocolos.length}</b><span>protocolos abertos</span></div>
        <div className="kpi"><b className={atencao.length ? 'alerta' : ''}>{atencao.length}</b><span>pedem atenção</span></div>
      </div>

      {(atencao.length > 0 || pausaCritica.length > 0) && (
        <section className="card">
          <h2>Atenção</h2>
          <ul className="lista">
            {atencao.map((p) => (
              <li key={p.id}><Link to={`/projetos/${p.projeto_id}`}>
                <b>{p.projetos?.nome}</b> · {p.projetos?.clientes?.nome}
                <span className="mudo"> — {statusProtocolo(p.tipo, p.status)}{p.prazo ? `, prazo ${fmtData(p.prazo)}` : ''}</span>
              </Link></li>
            ))}
            {pausaCritica.map((p) => (
              <li key={p.id}><Link to={`/projetos/${p.id}`}>
                <b>{p.nome}</b> · pausado há {diasDePausa(p.pausado_em)} dias
                <span className="mudo"> — retomada só até {MAX_DIAS_PAUSA} dias</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="fases">
        {porFase.map(({ fase, itens }) => (
          <section className="card" key={fase}>
            <h2>{fase}. {FASES[fase]} <span className="badge">{itens.length}</span></h2>
            {itens.length === 0 && <p className="mudo">Nenhum projeto nesta fase.</p>}
            <ul className="lista">
              {itens.map((p) => (
                <li key={p.id}><Link to={`/projetos/${p.id}`}>
                  <b>{p.nome}</b>
                  <span className="mudo"> · {p.clientes?.nome}</span>
                  <span className="etapa">{etapaAtual(p)?.codigo} · {etapaAtual(p)?.rotulo}</span>
                </Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
