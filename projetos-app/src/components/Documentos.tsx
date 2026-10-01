import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Modelo { id: string; nome: string; padrao_arquivo: string | null }
interface Doc { id: string; modelo_id: string | null; nome: string; codigo_arquivo: string | null; arquivo_path: string; arquivo_nome: string; created_at: string }

const limpar = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');

export default function Documentos({ projetoId, etapaCodigo, clienteCodigo }: {
  projetoId: string; etapaCodigo: string; clienteCodigo: string | null;
}) {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    const [m, d] = await Promise.all([
      supabase.from('documento_modelos').select('id,nome,padrao_arquivo').eq('etapa_codigo', etapaCodigo).order('ordem'),
      supabase.from('projeto_documentos').select('*').eq('projeto_id', projetoId).eq('etapa_codigo', etapaCodigo).order('created_at'),
    ]);
    setModelos((m.data as Modelo[]) ?? []); setDocs((d.data as Doc[]) ?? []);
  }, [projetoId, etapaCodigo]);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(file: File, modelo: Modelo | null) {
    setBusy(modelo?.id ?? 'avulso'); setErro('');
    try {
      const path = `${projetoId}/${etapaCodigo}/${Date.now()}-${limpar(file.name)}`;
      const up = await supabase.storage.from('documentos').upload(path, file);
      if (up.error) throw up.error;
      const codigo = modelo?.padrao_arquivo?.replace('CAXXXXXX', clienteCodigo ?? 'CAXXXXXX') ?? null;
      const ins = await supabase.from('projeto_documentos').insert({
        projeto_id: projetoId, etapa_codigo: etapaCodigo, modelo_id: modelo?.id ?? null,
        nome: modelo?.nome ?? file.name, codigo_arquivo: codigo, arquivo_path: path, arquivo_nome: file.name,
      });
      if (ins.error) throw ins.error;
      await supabase.from('historico').insert({ projeto_id: projetoId, etapa_codigo: etapaCodigo, tipo: 'nota', texto: `Documento anexado: ${modelo?.nome ?? file.name}` });
      await carregar();
    } catch (e) { setErro((e as Error).message); } finally { setBusy(null); }
  }

  async function abrir(d: Doc) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.arquivo_path, 120);
    if (error) return setErro(error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  const Envio = ({ modelo, rotulo }: { modelo: Modelo | null; rotulo: string }) => (
    <label className="upload">
      {busy === (modelo?.id ?? 'avulso') ? 'Enviando…' : rotulo}
      <input type="file" hidden disabled={busy !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f, modelo); e.target.value = ''; }} />
    </label>
  );

  return (
    <div className="docs">
      <b className="pequeno mudo">Documentos</b>
      {erro && <p className="erro">{erro}</p>}
      {modelos.map((m) => {
        const feitos = docs.filter((d) => d.modelo_id === m.id);
        const codigo = m.padrao_arquivo?.replace('CAXXXXXX', clienteCodigo ?? 'CAXXXXXX');
        return (
          <div className="doc" key={m.id}>
            <div className="grow">
              <div>{m.nome}</div>
              <div className="pequeno mudo">{codigo ? <code>{codigo}</code> : 'sem necessidade de salvamento'}</div>
              {feitos.map((d) => <div key={d.id} className="pequeno"><button className="link" onClick={() => abrir(d)}>📎 {d.arquivo_nome}</button></div>)}
            </div>
            {m.padrao_arquivo && <Envio modelo={m} rotulo={feitos.length ? '+ Nova versão' : 'Anexar'} />}
          </div>
        );
      })}
      {docs.filter((d) => !d.modelo_id).map((d) => (
        <div className="doc" key={d.id}><button className="link" onClick={() => abrir(d)}>📎 {d.arquivo_nome}</button></div>
      ))}
      <Envio modelo={null} rotulo="+ Outro arquivo" />
    </div>
  );
}
