import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Protocolo, ProtocoloStatus } from '../lib/types';
import { PROTOCOLO_STATUS } from '../lib/labels';
import ProtocoloItem from '../components/ProtocoloItem';

export default function Protocolos() {
  const [lista, setLista] = useState<Protocolo[]>([]);
  const [filtro, setFiltro] = useState<ProtocoloStatus | 'abertos' | 'todos'>('abertos');

  const carregar = useCallback(() => {
    supabase.from('protocolos').select('*, projetos(nome, clientes(nome))')
      .order('prazo', { ascending: true, nullsFirst: false })
      .then(({ data }) => setLista((data as Protocolo[]) ?? []));
  }, []);
  useEffect(carregar, [carregar]);

  const visiveis = lista.filter((p) =>
    filtro === 'todos' ? true : filtro === 'abertos' ? p.status !== 'entregue_ao_cliente' : p.status === filtro);

  return (
    <>
      <div className="titulo"><h1>Protocolos</h1></div>
      <p className="mudo">Acompanhamento de protocolos na Prefeitura, condomínio e outros órgãos. Para criar um novo, abra o projeto.</p>
      <div className="filtros">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="abertos">Em aberto</option>
          <option value="todos">Todos</option>
          {Object.entries(PROTOCOLO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="pilha">
        {visiveis.map((p) => <ProtocoloItem key={p.id} p={p} onChange={carregar} mostrarProjeto />)}
        {visiveis.length === 0 && <p className="mudo">Nenhum protocolo.</p>}
      </div>
    </>
  );
}
