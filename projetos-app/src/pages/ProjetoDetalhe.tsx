import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { EtapaModelo, Historico, Projeto, ProjetoEtapa, Protocolo, ProtocoloTipo } from '../lib/types';
import { ETAPA_STATUS, FASES, PROJETO_STATUS, PROTOCOLO_TIPO, SETOR, fmtData } from '../lib/labels';
import {
  MAX_DIAS_PAUSA, MAX_RODADAS, concluirEtapa, diasDePausa, pausarProjeto, reabrirEtapa,
  registrarRodada, rescindirProjeto, retomarProjeto,
} from '../lib/flow';
import ProtocoloItem from '../components/ProtocoloItem';

const COM_RODADAS = new Set(['09', '13', '17']);

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [modelos, setModelos] = useState<EtapaModelo[]>([]);
  const [etapas, setEtapas] = useState<ProjetoEtapa[]>([]);
  const [hist, setHist] = useState<Historico[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');
  const [novoProt, setNovoProt] = useState<{ tipo: ProtocoloTipo; orgao: string; numero: string } | null>(null);

  const carregar = useCallback(async () => {
    const [p, m, e, h, pr] = await Promise.all([
      supabase.from('projetos').select('*, clientes(nome,codigo)').eq('id', id!).single(),
      supabase.from('etapa_modelos').select('*').order('ordem'),
      supabase.from('projeto_etapas').select('*').eq('projeto_id', id!),
      supabase.from('historico').select('*, profiles(nome)').eq('projeto_id', id!).order('created_at', { ascending: false }).limit(50),
      supabase.from('protocolos').select('*').eq('projeto_id', id!).order('created_at', { ascending: false }),
    ]);
    setProjeto(p.data as Projeto); setModelos((m.data as EtapaModelo[]) ?? []);
    setEtapas((e.data as ProjetoEtapa[]) ?? []); setHist((h.data as Historico[]) ?? []);
    setProtocolos((pr.data as Protocolo[]) ?? []);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const run = async (fn: () => Promise<unknown>) => {
    setErro('');
    try { await fn(); await carregar(); } catch (e) { setErro((e as Error).message); }
  };

  if (!projeto) return <p className="mudo">Carregando…</p>;
  const pausado = projeto.status === 'pausado';
  const dias = diasDePausa(projeto.pausado_em);
  const etapaDe = (cod: string) => etapas.find((e) => e.etapa_codigo === cod);

  return (
    <>
      <p><Link to="/projetos">← Projetos</Link></p>
      <div className="titulo">
        <div>
          <h1>{projeto.nome}</h1>
          <div className="mudo">{projeto.clientes?.nome}{projeto.clientes?.codigo ? ` · ${projeto.clientes.codigo}` : ''}</div>
        </div>
        <span className={`tag ${projeto.status}`}>{PROJETO_STATUS[projeto.status]}</span>
      </div>
      {erro && <p className="erro">{erro}</p>}

      <section className="card">
        <div className="chips">
          {projeto.tem_legal && <span className="chip">Legal{projeto.tipo_aprovacao ? ` · ${projeto.tipo_aprovacao}` : ''}</span>}
          {projeto.tem_interiores && <span className="chip">Interiores</span>}
          {projeto.tem_complementares && <span className="chip">Complementares</span>}
          {!projeto.tem_legal && !projeto.tem_interiores && !projeto.tem_complementares && <span className="chip">Somente arquitetônico</span>}
        </div>
        {pausado && (
          <p className={dias > MAX_DIAS_PAUSA ? 'erro' : 'aviso'}>
            Pausado desde {fmtData(projeto.pausado_em)} ({dias} dias){projeto.motivo_pausa ? ` — ${projeto.motivo_pausa}` : ''}.{' '}
            {dias > MAX_DIAS_PAUSA
              ? 'Passou de 180 dias: enviar o termo de rescisão por ausência de retomada.'
              : `Retomada possível até ${MAX_DIAS_PAUSA} dias (aditivo assinado).`}
          </p>
        )}
        <div className="acoes">
          {projeto.status === 'ativo' && <>
            <button onClick={() => { const m = prompt('Motivo da pausa (a pedido do cliente / sem retorno por 3 semanas):'); if (m) run(() => pausarProjeto(projeto.id, m)); }}>Pausar projeto</button>
          </>}
          {pausado && <>
            <button className="primario" onClick={() => run(() => retomarProjeto(projeto.id))}>Retomar (aditivo assinado)</button>
            {dias > MAX_DIAS_PAUSA && <button className="perigo" onClick={() => confirm('Marcar como rescindido?') && run(() => rescindirProjeto(projeto.id))}>Rescindir contrato</button>}
          </>}
        </div>
      </section>

      <h2>Etapas</h2>
      {[1, 2, 3, 4].map((fase) => (
        <section className="card" key={fase}>
          <h3>{fase}. {FASES[fase]}</h3>
          <ul className="etapas">
            {modelos.filter((m) => m.fase === fase).map((m) => {
              const e = etapaDe(m.codigo);
              if (!e) return null;
              const ativa = e.status === 'em_andamento';
              return (
                <li key={m.codigo} className={`et ${e.status}`}>
                  <div className="linha" onClick={() => setAberta(aberta === m.codigo ? null : m.codigo)}>
                    <span className="num">{m.codigo}</span>
                    <div className="grow">
                      <b>{m.titulo}</b>
                      <div className="pequeno mudo">
                        {m.setores.map((s) => SETOR[s]).join(' · ')}{m.cliente_participa ? ' · Cliente' : ''}
                        {m.aceite_formal ? ' · aceite formal' : ''}
                      </div>
                    </div>
                    <span className={`tag e-${e.status}`}>{ETAPA_STATUS[e.status]}</span>
                  </div>
                  {(aberta === m.codigo || ativa) && e.status !== 'nao_aplicavel' && (
                    <div className="detalhe">
                      <dl>
                        {m.entrada && <><dt>Entra</dt><dd>{m.entrada}</dd></>}
                        {m.saida && <><dt>Sai</dt><dd>{m.saida}</dd></>}
                        {m.regra && <><dt>Regra</dt><dd>{m.regra}</dd></>}
                        {e.iniciada_em && <><dt>Início</dt><dd>{fmtData(e.iniciada_em)}</dd></>}
                        {e.concluida_em && <><dt>Conclusão</dt><dd>{fmtData(e.concluida_em)}</dd></>}
                      </dl>
                      {COM_RODADAS.has(m.codigo) && (
                        <div className="rodadas">
                          Rodadas de ajuste: <b className={e.rodadas_ajuste > MAX_RODADAS ? 'alerta' : ''}>{e.rodadas_ajuste}</b> / {MAX_RODADAS}
                          {e.rodadas_ajuste >= MAX_RODADAS - 1 && ativa && <span className="aviso inline"> {e.rodadas_ajuste >= MAX_RODADAS ? 'Próximas rodadas têm custo adicional.' : 'Lembrar o cliente do limite na próxima reunião.'}</span>}
                          {ativa && !pausado && <button onClick={() => run(() => registrarRodada(projeto.id, e))}>+ Registrar rodada</button>}
                        </div>
                      )}
                      <div className="acoes">
                        {ativa && !pausado && <button className="primario" onClick={() => run(() => concluirEtapa(projeto.id, e, modelos, etapas))}>
                          {m.aceite_formal ? 'Aceite assinado — concluir' : 'Concluir etapa'}
                        </button>}
                        {e.status === 'concluida' && !pausado && <button onClick={() => confirm('Reabrir esta etapa? As etapas seguintes devem ser revistas.') && run(() => reabrirEtapa(projeto.id, e))}>Reabrir</button>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <h2>Protocolos</h2>
      <div className="pilha">
        {protocolos.map((p) => <ProtocoloItem key={p.id} p={p} onChange={carregar} />)}
        {protocolos.length === 0 && <p className="mudo">Nenhum protocolo neste projeto.</p>}
      </div>
      {novoProt ? (
        <form className="card form" onSubmit={(ev) => { ev.preventDefault(); run(async () => {
          const { error } = await supabase.from('protocolos').insert({ projeto_id: projeto.id, tipo: novoProt.tipo, orgao: novoProt.orgao || null, numero: novoProt.numero || null });
          if (error) throw error;
          setNovoProt(null);
        }); }}>
          <div className="duas">
            <label>Tipo<select value={novoProt.tipo} onChange={(e) => setNovoProt({ ...novoProt, tipo: e.target.value as ProtocoloTipo })}>
              {Object.entries(PROTOCOLO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Órgão<input value={novoProt.orgao} onChange={(e) => setNovoProt({ ...novoProt, orgao: e.target.value })} /></label>
          </div>
          <label>Número (se já houver)<input value={novoProt.numero} onChange={(e) => setNovoProt({ ...novoProt, numero: e.target.value })} /></label>
          <div className="acoes"><button className="primario">Adicionar</button><button type="button" onClick={() => setNovoProt(null)}>Cancelar</button></div>
        </form>
      ) : <button onClick={() => setNovoProt({ tipo: 'prefeitura', orgao: '', numero: '' })}>+ Novo protocolo</button>}

      <h2>Histórico</h2>
      <section className="card">
        <div className="nota">
          <input placeholder="Registrar nota ou decisão…" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button onClick={() => nota.trim() && run(async () => { await supabase.from('historico').insert({ projeto_id: projeto.id, tipo: 'nota', texto: nota.trim() }); setNota(''); })}>Registrar</button>
        </div>
        <ul className="hist">
          {hist.map((h) => (
            <li key={h.id}>
              <span className="mudo pequeno">{fmtData(h.created_at)} {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              <div>{h.etapa_codigo && <b>Etapa {h.etapa_codigo} · </b>}{h.texto}{h.profiles?.nome && <span className="mudo"> — {h.profiles.nome}</span>}</div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
