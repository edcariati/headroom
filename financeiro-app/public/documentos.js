// Documentos do financeiro: comprovantes e notas fiscais anexados (guardados dentro do aplicativo), recibos e notas fiscais.
import { $, $$, api, brl, confirmar, dataBR, esc, hojeISO, lerArquivoBase64, modal, opcoes, parseDinheiro, porExtenso, qs, toast, urlArquivo } from './util.js';
import { animarContadores, estadoVazio, icon, kpi, revelar, skeletonPagina } from './ui.js';
import { cadastros } from './forms.js';

const CATEGORIAS = { comprovante: 'Comprovante', nota_fiscal: 'Nota fiscal', recibo: 'Recibo', contrato: 'Contrato', outro: 'Outro' };
const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ACEITA = '.pdf,.png,.jpg,.jpeg,.webp,.xml,application/pdf,image/png,image/jpeg,image/webp,text/xml';
const mimeDe = (f) => f.type || ({ xml: 'text/xml', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[(f.name.split('.').pop() || '').toLowerCase()] ?? '');

export async function enviarAnexo(arquivo, { vinculo, categoria = 'outro', descricao = '' }) {
  const dados = await lerArquivoBase64(arquivo);
  return api('anexos', { method: 'POST', body: { nome: arquivo.name, tipo: mimeDe(arquivo), dados, categoria, descricao, vinculo } });
}
const resumoXml = (x) => (x ? `Lido do XML: ${[x.numero && `nota ${x.numero}`, x.valor_cents != null && brl(x.valor_cents), x.data_emissao && dataBR(x.data_emissao), x.emitente].filter(Boolean).join(' · ')}` : '');
const itemAnexo = (a) => `<li class="anexo-item"><span class="esq">${icon('clipe')}<span><a href="${urlArquivo(a.id)}" target="_blank" rel="noopener"><b>${esc(a.nome)}</b></a>
  <small>${esc(CATEGORIAS[a.categoria] || a.categoria)} · ${tamanho(a.tamanho)} · ${dataBR((a.criado_em || '').slice(0, 10))}${a.descricao ? ` · ${esc(a.descricao)}` : ''}</small>${a.extraido ? `<small class="verde">${esc(resumoXml(a.extraido))}</small>` : ''}</span></span>
  <span class="dir"><a class="btn btn-sm" href="${urlArquivo(a.id)}" target="_blank" rel="noopener">Abrir</a><button type="button" class="btn btn-sm btn-danger" data-del-anexo="${a.id}" aria-label="Excluir ${esc(a.nome)}">${icon('lixo')}</button></span></li>`;

// ---------- recibo ----------
export function abrirRecibo(r) {
  const doc = r.pessoa_documento ? `, ${r.pessoa_documento.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'} ${esc(r.pessoa_documento)}` : '';
  const m = modal(`Recibo ${r.numero}`, `<div class="recibo" id="recibo-doc">
    <header class="recibo-topo"><img src="logo-cariati.png" alt="Cariati Arquitetura & Gestão"><div><strong>Cariati Arquitetura &amp; Gestão</strong><small>contato@cariati.com.br · 015 99841-9295 · www.cariatiarquitetura.com.br</small></div></header>
    <h2>RECIBO <span>Nº ${esc(r.numero)}</span></h2><div class="recibo-valor">${brl(r.valor_cents)}</div>
    <p>Recebemos de <b>${esc(r.pessoa_nome || 'cliente')}</b>${doc} a importância de <b>${esc(porExtenso(r.valor_cents))}</b>, referente a <b>${esc(r.descricao)}</b>,
      paga em <b>${dataBR(r.data)}</b>${r.forma ? ` por <b>${esc(r.forma)}</b>` : ''}${r.conta_nome ? ` (conta ${esc(r.conta_nome)})` : ''}.</p>
    ${r.observacao ? `<p>${esc(r.observacao)}</p>` : ''}
    <p>Por ser verdade, firmamos o presente recibo.</p>
    <div class="recibo-assin"><span>Data: ${dataBR(r.data)}</span><div><i></i>Cariati Arquitetura &amp; Gestão</div></div></div>`, {
    classe: 'recibo-dlg', chave: false,
    rodape: `<button type="button" class="btn btn-ghost" data-fechar>Fechar</button><button type="button" class="btn btn-primary" id="imprimir-recibo">${icon('impressora')}Imprimir ou salvar em PDF</button>` });
  $('#imprimir-recibo', m.dlg).onclick = () => {
    document.body.classList.add('imprimindo');
    const fim = () => { document.body.classList.remove('imprimindo'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    window.print();
    setTimeout(fim, 2000);
  };
}
export async function emitirRecibo(parcelaId, { forma, observacao, abrir = true } = {}) {
  const r = await api('recibos', { method: 'POST', body: { parcela_id: parcelaId, forma, observacao } });
  if (abrir) abrirRecibo(r);
  return r;
}

// ---------- documentos de uma parcela (anexos, recibo e nota fiscal) ----------
export function documentosParcela(item, aoMudar) {
  const rec = item.tipo === 'receita';
  const m = modal(`Documentos · ${item.nome}`, '<div id="doc-conteudo" class="empilha"></div>', { rodape: '<button type="button" class="btn btn-ghost" data-fechar>Fechar</button>', chave: false });
  const raiz = $('#doc-conteudo', m.dlg);
  async function desenhar() {
    const [anexos, recibos, notas] = await Promise.all([api(`anexos?${qs({ lancamento_id: item.lancamento_id })}`), rec ? api(`recibos?${qs({ parcela_id: item.id })}`) : [], rec ? api('notas') : []]);
    const meus = anexos.filter((a) => a.vinculo.tipo === 'lancamento' || a.vinculo.id === item.id);
    const nota = notas.find((n) => n.lancamento_id === item.lancamento_id);
    const pago = item.valor_pago_cents > 0;
    raiz.innerHTML = `
      <section><h3>Comprovantes e arquivos</h3>
        ${meus.length ? `<ul class="lista">${meus.map(itemAnexo).join('')}</ul>` : '<p class="suave">Nenhum arquivo anexado ainda.</p>'}
        <div class="anexo-envio"><select class="campo" id="anexo-cat" aria-label="Tipo do arquivo">${Object.entries(CATEGORIAS).filter(([k]) => k !== 'recibo').map(([k, r]) => `<option value="${k}"${k === (rec ? 'comprovante' : 'comprovante') ? ' selected' : ''}>${r}</option>`).join('')}</select>
          <label class="btn btn-sm anexo-btn">${icon('clipe')}Anexar arquivo<input type="file" id="anexo-arq" accept="${ACEITA}" hidden></label></div>
        <p class="suave" style="font-size:.78rem">PDF, imagem ou XML de até 3 MB. Fica guardado dentro do aplicativo. XML de nota fiscal tem número, valor e data lidos automaticamente.</p></section>
      ${rec ? `<section><h3>Recibo</h3>${recibos.length ? recibos.map((r) => `<p>${r.numero} · ${brl(r.valor_cents)} em ${dataBR(r.data)} <button type="button" class="btn btn-sm" data-ver-recibo="${r.id}">${icon('impressora')}Abrir recibo</button></p>`).join('')
        : pago ? `<p class="suave">Gere o recibo do recebimento para entregar ao cliente.</p><button type="button" class="btn btn-sm btn-primary" id="gerar-recibo">${icon('check')}Emitir recibo</button>` : '<p class="suave">O recibo fica disponível depois que o recebimento for registrado.</p>'}</section>
      <section><h3>Nota fiscal</h3>${nota ? `<p>${nota.status === 'emitida' ? `<span class="chip s-pago">${icon('check')}Emitida${nota.numero ? ' nº ' + esc(nota.numero) : ''}</span>` : `<span class="chip s-a_vencer">${icon('relogio')}A emitir</span>`} <span class="suave">${esc(nota.descricao_servico)} · ${brl(nota.valor_cents)}</span></p>
        <p><a class="btn btn-sm" href="#/notas">Abrir em Notas fiscais</a></p>`
        : '<p class="suave">O cliente pediu nota fiscal? Coloque na fila de emissão e acompanhe em Notas fiscais.</p><button type="button" class="btn btn-sm" id="pedir-nf">Cliente pediu NF</button>'}</section>` : ''}`;
  }
  m.dlg.addEventListener('change', async (e) => {
    if (e.target.id !== 'anexo-arq' || !e.target.files[0]) return;
    try {
      const a = await enviarAnexo(e.target.files[0], { vinculo: { tipo: 'parcela', id: item.id }, categoria: $('#anexo-cat', m.dlg).value });
      toast(a.extraido ? resumoXml(a.extraido) : 'Arquivo anexado.');
      await desenhar(); aoMudar?.();
    } catch (err) { toast(err.message, 'erro'); }
  });
  m.dlg.addEventListener('click', async (e) => {
    try {
      const del = e.target.closest('[data-del-anexo]');
      if (del && await confirmar('Excluir este arquivo anexado?')) { await api(`anexos/${del.dataset.delAnexo}`, { method: 'DELETE' }); toast('Arquivo excluído.'); await desenhar(); aoMudar?.(); }
      if (e.target.closest('#gerar-recibo')) { await emitirRecibo(item.id); await desenhar(); aoMudar?.(); }
      const ver = e.target.closest('[data-ver-recibo]');
      if (ver) abrirRecibo(await api(`recibos/${ver.dataset.verRecibo}`));
      if (e.target.closest('#pedir-nf')) { await api('notas', { method: 'POST', body: { lancamento_id: item.lancamento_id, parcela_id: item.id, valor_cents: item.valor_cents } }); toast('Nota fiscal colocada na fila de emissão.'); await desenhar(); aoMudar?.(); }
    } catch (err) { toast(err.message, 'erro'); }
  });
  desenhar().catch((err) => toast(err.message, 'erro'));
}

// Escolha de lançamento por busca (usada para anexar documento e para criar nota)
function seletorLancamento(raiz, { soReceita = false } = {}) {
  raiz.innerHTML = `<input class="campo" type="search" data-busca-lanc placeholder="Buscar por nome, cliente ou projeto" autocomplete="off" aria-label="Buscar lançamento"><div class="seletor-lista" data-lista-lanc></div>`;
  let escolhido = null, tmr;
  const buscar = async () => {
    const q = $('[data-busca-lanc]', raiz).value;
    const r = await api(`parcelas?${qs({ tipo: soReceita ? 'receita' : undefined, de: '2000-01-01', ate: '2100-12-31', busca: q, pageSize: 12 })}`);
    const vistos = new Set();
    const itens = r.itens.filter((i) => !vistos.has(i.lancamento_id) && vistos.add(i.lancamento_id));
    $('[data-lista-lanc]', raiz).innerHTML = itens.length ? itens.map((i) => `<label class="seletor-item"><input type="radio" name="lanc_escolhido" value="${i.id}" data-lanc="${i.lancamento_id}"${escolhido === i.id ? ' checked' : ''}><span><b>${esc(i.lancamento_nome)}</b><small>${esc(i.pessoa_nome || 'Sem pessoa')} · ${i.tipo === 'receita' ? 'Receita' : 'Despesa'} · ${brl(i.valor_cents)} · ${dataBR(i.vencimento)}</small></span></label>`).join('')
      : '<p class="suave" style="padding:var(--s3)">Nenhum lançamento encontrado.</p>';
  };
  raiz.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(buscar, 300); });
  raiz.addEventListener('change', (e) => { if (e.target.name === 'lanc_escolhido') escolhido = e.target.value; });
  buscar();
  return { escolhido: () => { const el = $('input[name=lanc_escolhido]:checked', raiz); return el ? { parcela: el.value, lancamento: el.dataset.lanc } : null; } };
}

// ---------- tela Documentos ----------
export async function documentosView(el) {
  const filtro = documentosView.filtro ||= { busca: '', categoria: '', aba: 'arquivos' };
  window.dispatchEvent(new CustomEvent('crumbs', { detail: ['Financeiro', 'Documentos'] }));
  if (el.dataset.tela !== 'doc') el.innerHTML = skeletonPagina();
  const [anexos, recibos] = await Promise.all([api(`anexos?${qs({ busca: filtro.busca, categoria: filtro.categoria })}`), api('recibos')]);
  el.dataset.tela = 'doc';
  const q = filtro.busca.toLowerCase();
  const recFiltrados = recibos.filter((r) => !q || `${r.numero} ${r.pessoa_nome || ''} ${r.descricao}`.toLowerCase().includes(q));
  const aba = filtro.aba;
  const tabela = anexos.length ? `<section class="glass reveal" style="margin-top:var(--s4)"><div class="tabela-wrap"><table class="tbl"><thead><tr><th>Arquivo</th><th>Tipo</th><th>Vinculado a</th><th>Dados da nota</th><th>Data</th><th></th></tr></thead><tbody>
    ${anexos.map((a) => `<tr><td class="nome" data-label="Arquivo"><strong>${esc(a.nome)}</strong><small>${tamanho(a.tamanho)}${a.descricao ? ' · ' + esc(a.descricao) : ''}</small></td><td data-label="Tipo"><span class="chip">${esc(CATEGORIAS[a.categoria] || a.categoria)}</span></td>
      <td data-label="Vinculado a">${esc(a.contexto || '—')}</td><td data-label="Dados da nota">${a.extraido ? `${a.extraido.numero ? 'Nº ' + esc(a.extraido.numero) : ''}${a.extraido.valor_cents != null ? ' · ' + brl(a.extraido.valor_cents) : ''}<small>${esc(a.extraido.emitente || '')}</small>` : '—'}</td>
      <td data-label="Data">${dataBR((a.criado_em || '').slice(0, 10))}</td><td class="acoes" data-label=""><div class="acoes-linha"><a class="btn btn-sm" href="${urlArquivo(a.id)}" target="_blank" rel="noopener">Abrir</a><button class="btn btn-sm btn-danger" data-del-anexo="${a.id}" aria-label="Excluir ${esc(a.nome)}">${icon('lixo')}</button></div></td></tr>`).join('')}</tbody></table></div></section>`
    : estadoVazio({ titulo: filtro.busca || filtro.categoria ? 'Nenhum documento encontrado' : 'Nenhum documento anexado', texto: filtro.busca || filtro.categoria ? 'Tente outro nome, número de nota ou tipo.' : 'Anexe comprovantes e notas fiscais para guardar tudo dentro do aplicativo e achar depois pela busca.', acaoRotulo: 'Anexar documento', acaoId: 'estado-novo' });
  const tabelaRec = recFiltrados.length ? `<section class="glass reveal" style="margin-top:var(--s4)"><div class="tabela-wrap"><table class="tbl"><thead><tr><th>Recibo</th><th>Cliente</th><th>Referente a</th><th class="num">Valor</th><th>Data</th><th></th></tr></thead><tbody>
    ${recFiltrados.map((r) => `<tr><td data-label="Recibo"><strong>${esc(r.numero)}</strong></td><td data-label="Cliente">${esc(r.pessoa_nome || '—')}</td><td class="nome" data-label="Referente a">${esc(r.descricao)}</td><td class="num" data-label="Valor"><b>${brl(r.valor_cents)}</b></td><td data-label="Data">${dataBR(r.data)}</td>
      <td class="acoes" data-label=""><button class="btn btn-sm" data-ver-recibo="${r.id}">${icon('impressora')}Abrir</button></td></tr>`).join('')}</tbody></table></div></section>`
    : estadoVazio({ titulo: 'Nenhum recibo emitido', texto: 'Ao registrar um recebimento, marque "Emitir recibo". Ele aparece aqui, com número sequencial.' });
  el.innerHTML = `
    <div class="filtros"><label class="pilula-vidro busca-campo">${icon('search')}<input class="campo" type="search" name="busca" placeholder="Buscar por arquivo, cliente, número da nota ou recibo" value="${esc(filtro.busca)}" aria-label="Pesquisar documentos"></label>
      ${aba === 'arquivos' ? `<select class="campo" name="categoria" aria-label="Tipo de documento" style="max-width:220px"><option value="">Todos os tipos</option>${Object.entries(CATEGORIAS).map(([k, r]) => `<option value="${k}"${filtro.categoria === k ? ' selected' : ''}>${r}</option>`).join('')}</select>` : ''}</div>
    <div class="grade-kpi tres">${kpi({ rotulo: 'Arquivos anexados', icone: 'clipe', valor: anexos.length, cor: 'azul', formato: 'int', tag: 'div' })}${kpi({ rotulo: 'Recibos emitidos', icone: 'impressora', valor: recibos.length, cor: 'violet', formato: 'int', tag: 'div' })}
      ${kpi({ rotulo: 'Notas fiscais anexadas', icone: 'contrato', valor: anexos.filter((a) => a.categoria === 'nota_fiscal').length, cor: 'verde', formato: 'int', tag: 'div' })}</div>
    <div class="tabs" role="tablist" style="margin-top:var(--s4)"><button class="tab${aba === 'arquivos' ? ' ativa' : ''}" data-aba="arquivos" role="tab" aria-selected="${aba === 'arquivos'}">Arquivos</button><button class="tab${aba === 'recibos' ? ' ativa' : ''}" data-aba="recibos" role="tab" aria-selected="${aba === 'recibos'}">Recibos</button></div>
    ${aba === 'arquivos' ? tabela : tabelaRec}`;
  const recarregar = () => documentosView(el);
  let tmr;
  $('[name=busca]', el).oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { filtro.busca = e.target.value; recarregar().then(() => { const b = $('[name=busca]', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }); }, 350); };
  const sel = $('[name=categoria]', el); if (sel) sel.onchange = (e) => { filtro.categoria = e.target.value; recarregar(); };
  el.onclick = async (e) => {
    try {
      const ab = e.target.closest('[data-aba]'); if (ab) { filtro.aba = ab.dataset.aba; return recarregar(); }
      if (e.target.closest('#estado-novo')) return formAnexar(recarregar);
      const del = e.target.closest('[data-del-anexo]');
      if (del && await confirmar('Excluir este arquivo anexado?')) { await api(`anexos/${del.dataset.delAnexo}`, { method: 'DELETE' }); toast('Arquivo excluído.'); recarregar(); }
      const ver = e.target.closest('[data-ver-recibo]'); if (ver) abrirRecibo(await api(`recibos/${ver.dataset.verRecibo}`));
    } catch (err) { toast(err.message, 'erro'); }
  };
  revelar(el); animarContadores(el);
}

// Anexar documento a partir da tela Documentos: escolhe o arquivo e a que ele pertence.
export async function formAnexar(aoSalvar) {
  const c = await cadastros();
  const m = modal('Anexar documento', `
    <div class="linha2"><label class="f">Tipo *<select class="campo" name="categoria">${Object.entries(CATEGORIAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></label>
      <label class="f">Arquivo * <span class="suave">(PDF, imagem ou XML, até 3 MB)</span><input class="campo" type="file" name="arquivo" accept="${ACEITA}" required></label></div>
    <label class="f">Descrição<input class="campo" name="descricao" autocomplete="off" placeholder="Ex.: Comprovante do Pix da 2ª parcela"></label>
    <label class="f">Vincular a *<select class="campo" name="vinculo_tipo"><option value="lancamento">Receita ou despesa</option><option value="pessoa">Cliente ou fornecedor</option><option value="contrato">Projeto</option></select></label>
    <div data-alvo-lanc></div>
    <label class="f" data-alvo-pessoa hidden>Cliente ou fornecedor<select class="campo" name="pessoa_id">${opcoes(c.pessoas, '', 'Escolha…')}</select></label>
    <label class="f" data-alvo-contrato hidden>Projeto<select class="campo" name="contrato_id">${opcoes(c.contratos, '', 'Escolha…', (x) => `${x.codigo} - ${x.nome}`)}</select></label>`, {
    rotulo: 'Anexar', chave: 'anexar',
    onSubmit: async (d) => {
      const arquivo = d.arquivo;
      if (!arquivo?.name) throw new Error('Escolha o arquivo.');
      let vinculo;
      if (d.vinculo_tipo === 'lancamento') { const e = lanc.escolhido(); if (!e) throw new Error('Escolha a receita ou despesa.'); vinculo = { tipo: 'parcela', id: e.parcela }; }
      else if (d.vinculo_tipo === 'pessoa') { if (!d.pessoa_id) throw new Error('Escolha o cliente ou fornecedor.'); vinculo = { tipo: 'pessoa', id: d.pessoa_id }; }
      else { if (!d.contrato_id) throw new Error('Escolha o projeto.'); vinculo = { tipo: 'contrato', id: d.contrato_id }; }
      const a = await enviarAnexo(arquivo, { vinculo, categoria: d.categoria, descricao: d.descricao });
      toast(a.extraido ? resumoXml(a.extraido) : 'Documento anexado.');
      aoSalvar?.();
    },
  });
  const f = $('form', m.dlg);
  const lanc = seletorLancamento($('[data-alvo-lanc]', m.dlg));
  const alternar = () => { const t = f.vinculo_tipo.value; $('[data-alvo-lanc]', m.dlg).hidden = t !== 'lancamento'; $('[data-alvo-pessoa]', m.dlg).hidden = t !== 'pessoa'; $('[data-alvo-contrato]', m.dlg).hidden = t !== 'contrato'; };
  f.vinculo_tipo.addEventListener('change', alternar); alternar();
}

// ---------- tela Notas fiscais ----------
const STATUS_NOTA = { a_emitir: ['a_vencer', 'A emitir'], emitida: ['pago', 'Emitida'] };
async function textoEmissao(n) {
  const c = await cadastros();
  const p = c.pessoas.find((x) => x.id === n.pessoa_id) || {};
  const end = [[p.endereco, p.numero].filter(Boolean).join(', '), p.complemento, p.bairro, [p.cidade, p.estado].filter(Boolean).join('/'), p.cep && `CEP ${p.cep}`].filter(Boolean).join(' - ');
  return [`Tomador: ${p.nome || '—'}`, `${p.natureza === 'juridica' ? 'CNPJ' : 'CPF'}: ${p.documento || '—'}`, `E-mail: ${p.email || '—'}`, `Telefone: ${p.telefone || '—'}`, `Endereço: ${end || '—'}`,
    `Serviço: ${n.descricao_servico}`, `Valor: ${brl(n.valor_cents)}`, `Competência: ${dataBR(n.competencia)}`, `Consumidor final: ${p.consumidor_final_nfse === true ? 'sim' : p.consumidor_final_nfse === false ? 'não' : 'não informado'}`].join('\n');
}
function formNotaEmitida(n, aoSalvar) {
  const m = modal('Registrar nota emitida', `<p class="suave">${esc(n.descricao_servico)} · ${brl(n.valor_cents)}</p>
    <label class="f">Arquivo da nota (XML ou PDF)<input class="campo" type="file" name="arquivo" accept="${ACEITA}"><span class="dica">Com o XML, o número e a data são lidos automaticamente.</span></label>
    <div class="linha2"><label class="f">Número da nota *<input class="campo" name="numero" required autocomplete="off" value="${esc(n.numero || '')}"></label>
      <label class="f">Data de emissão *<input class="campo" type="date" name="data_emissao" required value="${n.data_emissao || hojeISO()}"></label></div>
    <label class="f">Observação<input class="campo" name="observacao" autocomplete="off" value="${esc(n.observacao || '')}"></label>`, {
    rotulo: 'Registrar emissão', chave: `nota:${n.id}`,
    onSubmit: async (d) => {
      let anexo_id = n.anexo_id;
      if (d.arquivo?.name) { const a = await enviarAnexo(d.arquivo, { vinculo: { tipo: 'nota', id: n.id }, categoria: 'nota_fiscal', descricao: `Nota fiscal ${d.numero}` }); anexo_id = a.id; }
      await api(`notas/${n.id}`, { method: 'PUT', body: { status: 'emitida', numero: d.numero, data_emissao: d.data_emissao, observacao: d.observacao, anexo_id } });
      toast('Nota fiscal registrada.'); aoSalvar?.();
    },
  });
  // ao escolher o XML, preenche número e data
  $('[name=arquivo]', m.dlg).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f || !/xml$/i.test(f.name)) return;
    try {
      const t = await f.text();
      const num = /<(?:\w+:)?(?:nNF|NumeroNfse|Numero)[^>]*>(\d+)</i.exec(t)?.[1], dt = /<(?:\w+:)?(?:dhEmi|DataEmissao|dEmi)[^>]*>(\d{4}-\d{2}-\d{2})/i.exec(t)?.[1];
      const form = $('form', m.dlg);
      if (num) form.numero.value = num; if (dt) form.data_emissao.value = dt;
      if (num || dt) toast('Número e data lidos do XML.');
    } catch { /* o servidor lê de novo ao enviar */ }
  });
}
export function formNovaNota(aoSalvar) {
  const m = modal('Nova nota fiscal', `<p class="suave">Escolha a receita que precisa de nota fiscal.</p><div data-alvo-lanc></div>
    <label class="f">Descrição do serviço na nota<input class="campo" name="descricao_servico" autocomplete="off" placeholder="Se vazio, usa o nome da receita"></label>`, {
    rotulo: 'Colocar na fila', chave: 'nota:nova',
    onSubmit: async (d) => {
      const e = lanc.escolhido(); if (!e) throw new Error('Escolha a receita.');
      await api('notas', { method: 'POST', body: { lancamento_id: e.lancamento, parcela_id: e.parcela, descricao_servico: d.descricao_servico || undefined } });
      toast('Nota na fila de emissão.'); aoSalvar?.();
    },
  });
  const lanc = seletorLancamento($('[data-alvo-lanc]', m.dlg), { soReceita: true });
}
export async function notasView(el) {
  const filtro = notasView.filtro ||= { status: '' };
  window.dispatchEvent(new CustomEvent('crumbs', { detail: ['Financeiro', 'Notas fiscais'] }));
  if (el.dataset.tela !== 'nf') el.innerHTML = skeletonPagina();
  const notas = await api(`notas?${qs({ status: filtro.status })}`);
  el.dataset.tela = 'nf';
  const todas = filtro.status ? await api('notas') : notas;
  const aEmitir = todas.filter((n) => n.status === 'a_emitir');
  el.innerHTML = `
    <section class="glass painel reveal"><h3>Emissão eletrônica (NFS-e)</h3>
      <p>Hoje o aplicativo organiza o pedido e guarda a nota: o cliente pede a NF, ela entra na fila <b>A emitir</b> com todos os dados prontos para copiar, e depois você registra o número e anexa o XML ou PDF.</p>
      <p class="suave" style="margin-top:var(--s2)">A emissão automática, sem sair do aplicativo, depende de ligar o emissor da prefeitura ou de um provedor de notas. Quando você escolher o emissor, esta mesma fila passa a enviar a nota sozinha.</p></section>
    <div class="grade-kpi tres" style="margin-top:var(--s4)">${kpi({ rotulo: 'A emitir', icone: 'relogio', valor: aEmitir.length, cor: aEmitir.length ? 'laranja' : 'verde', formato: 'int', status: 'a_emitir', ativo: filtro.status === 'a_emitir' })}
      ${kpi({ rotulo: 'Emitidas', icone: 'check', valor: todas.filter((n) => n.status === 'emitida').length, cor: 'verde', formato: 'int', status: 'emitida', ativo: filtro.status === 'emitida' })}
      ${kpi({ rotulo: 'Valor a emitir', icone: 'contrato', valor: aEmitir.reduce((s, n) => s + n.valor_cents, 0), cor: 'azul', tag: 'div' })}</div>
    ${notas.length ? `<section class="glass reveal" style="margin-top:var(--s4)"><div class="tabela-wrap"><table class="tbl"><thead><tr><th>Cliente e serviço</th><th class="num">Valor</th><th>Competência</th><th>Situação</th><th>Nota</th><th></th></tr></thead><tbody>
      ${notas.map((n) => `<tr><td class="nome" data-label="Cliente"><strong>${esc(n.pessoa_nome || 'Sem cliente')}</strong><small>${esc(n.descricao_servico)}</small></td><td class="num" data-label="Valor"><b>${brl(n.valor_cents)}</b></td><td data-label="Competência">${dataBR(n.competencia)}</td>
        <td data-label="Situação"><span class="chip s-${STATUS_NOTA[n.status][0]}">${icon(n.status === 'emitida' ? 'check' : 'relogio')}${STATUS_NOTA[n.status][1]}</span></td>
        <td data-label="Nota">${n.numero ? `Nº ${esc(n.numero)}<small>${n.data_emissao ? dataBR(n.data_emissao) : ''}</small>` : '—'}${n.anexo ? `<small><a href="${urlArquivo(n.anexo.id)}" target="_blank" rel="noopener">${esc(n.anexo.nome)}</a></small>` : ''}</td>
        <td class="acoes" data-label=""><div class="acoes-linha">${n.status === 'a_emitir' ? `<button class="btn btn-sm" data-copiar="${n.id}">Copiar dados</button><button class="btn btn-sm btn-ok" data-emitida="${n.id}">${icon('check')}Registrar emissão</button>` : `<button class="btn btn-sm" data-emitida="${n.id}">${icon('editar')}Editar</button>`}
          <button class="btn btn-sm btn-danger" data-del-nota="${n.id}" aria-label="Excluir nota">${icon('lixo')}</button></div></td></tr>`).join('')}</tbody></table></div></section>`
    : estadoVazio({ titulo: 'Nenhuma nota fiscal por aqui', texto: 'Quando um cliente pedir nota fiscal, marque no lançamento ou use "Nova nota". Ela entra na fila de emissão.', acaoRotulo: 'Nova nota', acaoId: 'estado-novo' })}`;
  const recarregar = () => notasView(el);
  el.onclick = async (e) => {
    try {
      if (e.target.closest('#estado-novo')) return formNovaNota(recarregar);
      const k = e.target.closest('.kpi[data-status]'); if (k) { filtro.status = filtro.status === k.dataset.status ? '' : k.dataset.status; return recarregar(); }
      const cp = e.target.closest('[data-copiar]');
      if (cp) { const t = await textoEmissao(notas.find((n) => n.id === cp.dataset.copiar)); try { await navigator.clipboard.writeText(t); toast('Dados copiados. Cole no emissor da nota.'); } catch { toast(t, { duracao: 12000, tipo: 'info' }); } }
      const em = e.target.closest('[data-emitida]'); if (em) formNotaEmitida(notas.find((n) => n.id === em.dataset.emitida), recarregar);
      const del = e.target.closest('[data-del-nota]'); if (del && await confirmar('Excluir esta nota fiscal da lista?')) { await api(`notas/${del.dataset.delNota}`, { method: 'DELETE' }); toast('Nota excluída.'); recarregar(); }
    } catch (err) { toast(err.message, 'erro'); }
  };
  revelar(el); animarContadores(el);
}
