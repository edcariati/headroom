import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Protocolo, ProtocoloStatus } from '../lib/types';
import { PROTOCOLO_TIPO, diasAte, fmtData, opcoesStatus, statusProtocolo } from '../lib/labels';

export default function ProtocoloItem({ p, onChange, mostrarProjeto }: {
  p: Protocolo; onChange: () => void; mostrarProjeto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState('');
  const dias = diasAte(p.prazo);
  const urgente = p.status === 'exigencia' || (dias !== null && dias <= 3 && p.status !== 'entregue_ao_cliente');

  async function mudarStatus(status: ProtocoloStatus) {
    const patch: Partial<Protocolo> = { status };
    if (status === 'protocolado' && p.tipo !== 'entrega_cliente' && !p.data_protocolo) patch.data_protocolo = new Date().toISOString().slice(0, 10);
    await supabase.from('protocolos').update(patch).eq('id', p.id);
    await supabase.from('protocolo_andamentos').insert({ protocolo_id: p.id, status, texto: `Status: ${statusProtocolo(p.tipo, status)}` });
    await supabase.from('historico').insert({ projeto_id: p.projeto_id, tipo: 'protocolo', texto: `${PROTOCOLO_TIPO[p.tipo]}${p.numero ? ' ' + p.numero : ''}: ${statusProtocolo(p.tipo, status)}` });
    onChange();
  }
  async function salvar(campos: Partial<Protocolo>) {
    await supabase.from('protocolos').update(campos).eq('id', p.id);
    onChange();
  }
  async function anotar() {
    if (!nota.trim()) return;
    await supabase.from('protocolo_andamentos').insert({ protocolo_id: p.id, texto: nota.trim() });
    setNota('');
    onChange();
  }

  return (
    <div className={`card protocolo ${urgente ? 'urgente' : ''}`}>
      <div className="linha" onClick={() => setAberto(!aberto)}>
        <div>
          <b>{PROTOCOLO_TIPO[p.tipo]}{p.orgao ? ` · ${p.orgao}` : ''}</b>
          {p.numero && <span className="mudo"> · nº {p.numero}</span>}
          {mostrarProjeto && p.projetos && (
            <div className="pequeno"><Link to={`/projetos/${p.projeto_id}`} onClick={(e) => e.stopPropagation()}>{p.projetos.nome}</Link>
              <span className="mudo"> · {p.projetos.clientes?.nome}</span></div>
          )}
        </div>
        <div className="dir">
          <span className={`tag p-${p.status}`}>{statusProtocolo(p.tipo, p.status)}</span>
          {p.prazo && <div className={`pequeno ${urgente ? 'alerta' : 'mudo'}`}>prazo {fmtData(p.prazo)}{dias !== null && ` (${dias < 0 ? `${-dias}d atrasado` : `${dias}d`})`}</div>}
        </div>
      </div>
      {aberto && (
        <div className="detalhe">
          <div className="duas">
            <label>Status
              <select value={p.status} onChange={(e) => mudarStatus(e.target.value as ProtocoloStatus)}>
                {opcoesStatus(p.tipo).map((k) => <option key={k} value={k}>{statusProtocolo(p.tipo, k)}</option>)}
              </select>
            </label>
            <label>Número<input defaultValue={p.numero ?? ''} onBlur={(e) => e.target.value !== (p.numero ?? '') && salvar({ numero: e.target.value || null })} /></label>
          </div>
          <div className="duas">
            <label>{p.tipo === 'entrega_cliente' ? 'Entregue em' : 'Protocolado em'}<input type="date" defaultValue={p.data_protocolo ?? ''} onBlur={(e) => salvar({ data_protocolo: e.target.value || null })} /></label>
            <label>{p.tipo === 'entrega_cliente' ? 'Data da entrega' : 'Próximo prazo'}<input type="date" defaultValue={p.prazo ?? ''} onBlur={(e) => salvar({ prazo: e.target.value || null })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={p.cliente_notificado} onChange={(e) => salvar({ cliente_notificado: e.target.checked })} />{p.tipo === 'entrega_cliente' ? 'Cliente avisado da data' : 'Cliente notificado da entrada'}</label>
          <div className="nota">
            <input placeholder="Registrar andamento (ex.: exigência recebida, retorno do fiscal…)" value={nota} onChange={(e) => setNota(e.target.value)} />
            <button onClick={anotar}>Registrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
