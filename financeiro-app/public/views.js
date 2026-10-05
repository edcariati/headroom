import { $, $$, CORES, MESES, MES_CURTO, STATUS, api, brl, confirmar, controlePeriodo, dataBR, esc, getPeriodo, grafico, ligarPeriodo, opcoes, qs, rotuloMes, toast, urlApi } from './util.js';
import { CADASTROS, GRUPOS, cadastros, formBaixa, formCadastro, formEditarParcela, formLancamento, formTransferencia, limparCache } from './forms.js';

const sv = (c) => `<span class="${c < 0 ? 'vermelho' : 'verde'}">${brl(c)}</span>`;
const vazio = (msg) => `<div class="vazio">${esc(msg)}</div>`;
const tabs = (lista, ativa) => `<div class="tabs" role="tablist">${lista.map(([k, r]) => `<button class="tab${k === ativa ? ' ativa' : ''}" data-tab="${k}" role="tab">${esc(r)}</button>`).join('')}</div>`;
const anoAtual = new Date().getFullYear();
const seletorAno = (ano) => `<select class="campo" name="ano" aria-label="Ano">${[anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map((a) => `<option${a === ano ? ' selected' : ''}>${a}</option>`).join('')}</select>`;

// ---------- Resumo ----------
export async function resumo(el) {
  const p = getPeriodo();
  const r = await api(`resumo?${qs(p)}`);
  const kpi = (rot, d, cor, destino) => `<button class="kpi" data-ir="${destino}"><span class="rot">${rot}<span class="qtd">${d.qtd}</span></span><div class="val ${cor}">${brl(d.valor)}</div></button>`;
  const prox = (lista, tipo) => lista.length ? `<ul class="lista-simples">${lista.map((i) => `<li><span>${esc(i.nome)}<small>${esc(i.pessoa || '')}</small></span>
    <span style="text-align:right"><strong>${brl(i.valor_cents)}</strong><small class="${i.status === 'vencido' ? 'vermelho' : ''}">${dataBR(i.vencimento)}${i.status === 'vencido' ? ' · vencido' : ''}</small></span></li>`).join('')}</ul>` : vazio(`Nenhuma ${tipo} em aberto no período.`);
  const maxRD = Math.max(r.receitas.realizado.valor, r.despesas.realizado.valor, 1);
  el.innerHTML = `
    <div class="barra">${controlePeriodo(p)}</div>
    <div class="grid resumo-topo">
      <div class="card"><h3>Contas <button class="btn mini" data-ir="contas" style="float:right">Extratos</button></h3>
        <div class="suave">Saldo atual</div><div style="font-size:24px;font-weight:700" class="${r.saldo_total_cents < 0 ? 'vermelho' : ''}">${brl(r.saldo_total_cents)}</div>
        <ul class="lista-simples" style="margin-top:8px">${r.contas.map((c) => `<li><span>${esc(c.nome)}</span>${sv(c.saldo_cents)}</li>`).join('') || '<li class="suave">Nenhuma conta. Cadastre em Cadastros.</li>'}</ul></div>
      <div><h3 style="margin:0 0 8px;font-size:14px;color:var(--suave)">Receitas</h3><div class="mini-cards">
        ${kpi('Em aberto', r.receitas.em_aberto, 'laranja', 'receitas?status=em_aberto')}${kpi('Vencido', r.receitas.vencido, 'vermelho', 'receitas?status=vencido')}${kpi('Recebido', r.receitas.realizado, 'verde', 'receitas?status=pago')}</div></div>
      <div><h3 style="margin:0 0 8px;font-size:14px;color:var(--suave)">Despesas</h3><div class="mini-cards">
        ${kpi('Em aberto', r.despesas.em_aberto, 'laranja', 'despesas?status=em_aberto')}${kpi('Vencido', r.despesas.vencido, 'vermelho', 'despesas?status=vencido')}${kpi('Pagas', r.despesas.realizado, 'verde', 'despesas?status=pago')}</div></div>
      <div class="card"><h3>Resultado (recebido − pago)</h3><div style="font-size:24px;font-weight:700">${sv(r.balanco_cents)}</div>
        <div class="barra-res"><i style="background:var(--verde);width:${(r.receitas.realizado.valor / maxRD) * 100}%"></i><i style="background:var(--vermelho);width:${(r.despesas.realizado.valor / maxRD) * 100}%"></i></div>
        <div class="legenda"><span><i style="background:var(--verde)"></i>Receitas</span><span><i style="background:var(--vermelho)"></i>Despesas</span></div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>Próximas receitas <button class="btn mini" data-ir="receitas" style="float:right">Ver todas</button></h3>${prox(r.proximas_receitas, 'receita')}</div>
      <div class="card"><h3>Próximas despesas <button class="btn mini" data-ir="despesas" style="float:right">Ver todas</button></h3>${prox(r.proximas_despesas, 'despesa')}</div>
    </div>`;
  ligarPeriodo(el, () => resumo(el));
  el.onclick = (e) => { const b = e.target.closest('[data-ir]'); if (b) location.hash = `#/${b.dataset.ir}`; };
}

// ---------- Receitas e Despesas ----------
const estadoLista = { receita: { status: '', busca: '', page: 1 }, despesa: { status: '', busca: '', page: 1 } };

export async function lista(el, tipo, query = {}) {
  const e = estadoLista[tipo];
  if (query.status !== undefined) { e.status = query.status; e.page = 1; }
  const p = getPeriodo();
  const rec = tipo === 'receita';
  const params = { tipo, ...p, status: e.status, busca: e.busca, page: e.page, pageSize: 25 };
  const r = await api(`parcelas?${qs(params)}`);
  const fx = [['vencidos', 'Vencidos', 'vencido', 'vermelho'], ['vence_hoje', 'Vence hoje', 'vence_hoje', 'laranja'], ['a_vencer', 'A vencer', 'a_vencer', 'laranja'],
    ['pagos', rec ? 'Recebidos' : 'Pagos', 'pago', 'verde'], ['total', 'Total do período', '', 'azul']];
  const paginas = Math.ceil(r.total_itens / r.pageSize);
  const linhas = r.itens.map((i) => `<tr>
    <td>${esc(i.nome)}${i.recorrente ? ' <span title="Recorrente">↻</span>' : ''}${i.etiquetas ? '<br>' + i.etiquetas.split(',').map((t) => `<span class="chip">${esc(t.trim())}</span>`).join('') : ''}</td>
    <td class="num ${rec ? 'verde' : 'vermelho'}">${brl(i.valor_cents)}${i.valor_pago_cents && i.status !== 'pago' ? `<br><small class="suave">pago ${brl(i.valor_pago_cents)}</small>` : ''}</td>
    <td>${dataBR(i.vencimento)}</td><td>${dataBR(i.data_pagamento)}</td><td>${esc(i.pessoa_nome || '-')}</td><td>${esc(i.categoria_nome || '-')}</td>
    <td>${esc(i.contrato_codigo || '-')}</td><td class="status s-${i.status}">${STATUS[i.status]}</td>
    <td class="acoes">${i.status !== 'pago' ? `<button class="btn mini primary" data-acao="baixar" data-id="${i.id}">${rec ? 'Receber' : 'Pagar'}</button> ` : `<button class="btn mini" data-acao="estornar" data-id="${i.id}">Estornar</button> `}
      ${i.valor_pago_cents === 0 ? `<button class="btn mini" data-acao="editar" data-id="${i.id}">Editar</button> ` : ''}<button class="btn mini perigo" data-acao="excluir" data-id="${i.id}" data-lanc="${i.lancamento_id}" title="Exclui o lançamento inteiro, com todas as parcelas">Excluir</button></td></tr>`).join('');
  el.innerHTML = `
    <div class="barra">${controlePeriodo(p)}<span class="espaco"></span>
      <input class="campo" type="search" name="busca" placeholder="Pesquisar por nome, cliente ou nota fiscal" value="${esc(e.busca)}" style="min-width:330px">
      <a class="btn" href="${urlApi(`parcelas.csv?${qs({ tipo, ...p, status: e.status, busca: e.busca })}`)}">Exportar planilha</a>
      <button class="btn primary" data-acao="novo">${rec ? 'Nova receita' : 'Nova despesa'}</button></div>
    <div class="faixas">${fx.map(([k, rot, st, cor]) => `<button class="faixa${e.status === st || (st === 'pago' && false) ? ' ativa' : ''}" data-status="${st}">
      <span class="rot">${rot}<span class="qtd">${r.faixas[k].qtd}</span></span><div class="val ${cor}">${brl(r.faixas[k].valor)}</div></button>`).join('')}</div>
    <div class="card" style="margin-bottom:16px"><h3>Gráfico de ${rec ? 'receitas' : 'despesas'} por mês de vencimento</h3>
      ${grafico(r.grafico.map((m) => ({ rotulo: rotuloMes(m.mes), partes: [{ valor: m.pago, cor: CORES.pago }, { valor: m.atrasado, cor: CORES.atrasado }, { valor: m.previsto, cor: CORES.previsto }] })))}
      <div class="legenda"><span><i style="background:var(--pago)"></i>${rec ? 'Recebido' : 'Pago'}</span><span><i style="background:var(--atraso)"></i>Atrasado</span><span><i style="background:var(--previsto)"></i>Previsto</span></div></div>
    ${r.itens.length ? `<div class="tabela-wrap"><table><thead><tr><th>Nome</th><th class="num">Valor</th><th>Vencimento</th><th>${rec ? 'Recebido em' : 'Pago em'}</th><th>${rec ? 'Cliente' : 'Fornecedor'}</th><th>Categoria</th><th>Projeto</th><th>Status</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
    : vazio('Nenhum lançamento encontrado neste período e filtro.')}
    ${paginas > 1 ? `<div class="paginacao">${Array.from({ length: paginas }, (_, i) => `<button class="btn mini${i + 1 === r.page ? ' ativa' : ''}" data-pagina="${i + 1}">${i + 1}</button>`).join('')}</div>` : ''}`;
  const recarregar = () => lista(el, tipo);
  ligarPeriodo(el, () => { e.page = 1; recarregar(); });
  let t;
  $('[name=busca]', el).oninput = (ev) => { clearTimeout(t); t = setTimeout(() => { e.busca = ev.target.value; e.page = 1; recarregar().then(() => { const b = $('[name=busca]', el); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }); }, 350); };
  el.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.status !== undefined) { e.status = e.status === b.dataset.status ? '' : b.dataset.status; e.page = 1; return recarregar(); }
    if (b.dataset.pagina) { e.page = Number(b.dataset.pagina); return recarregar(); }
    const item = r.itens.find((i) => String(i.id) === b.dataset.id);
    try {
      if (b.dataset.acao === 'novo') formLancamento(tipo, recarregar);
      else if (b.dataset.acao === 'baixar') formBaixa(item, recarregar);
      else if (b.dataset.acao === 'editar') formEditarParcela(item, recarregar);
      else if (b.dataset.acao === 'estornar') { await api(`parcelas/${item.id}/estorno`, { method: 'POST' }); toast('Pagamento estornado.'); recarregar(); }
      else if (b.dataset.acao === 'excluir' && await confirmar(`Excluir "${item.lancamento_nome}" e todas as suas parcelas?`)) { await api(`lancamentos/${b.dataset.lanc}`, { method: 'DELETE' }); toast('Lançamento excluído.'); recarregar(); }
    } catch (err) { toast(err.message, true); }
  };
}

// ---------- Pagamentos do cliente ----------
export async function pagamentos(el) {
  const p = getPeriodo();
  const filtro = pagamentos.filtro ||= { busca: '', status: '' };
  const r = await api(`pagamentos-cliente?${qs({ ...p, ...filtro })}`);
  const linhas = r.map((x) => `<tr data-lanc="${x.id}"><td><button class="toggle" data-exp="${x.id}" aria-label="Mostrar parcelas">▸</button>${esc(x.nome)}</td><td>${esc(x.cliente || '-')}</td>
    <td>${esc(x.contrato_codigo)}</td><td>${dataBR(x.competencia)}</td><td class="num">${brl(x.total_cents)}</td><td class="num verde">${brl(x.pago_cents)}</td><td class="num laranja">${brl(x.aberto_cents)}</td>
    <td class="status s-${x.status}">${x.status === 'em_aberto' ? 'Em aberto' : STATUS[x.status]}</td></tr>
    <tr hidden data-det="${x.id}"><td colspan="8" style="background:var(--bg)"><table>${x.parcelas.map((q) => `<tr><td>${esc(q.nome)}</td><td>${dataBR(q.vencimento)}</td><td class="num">${brl(q.valor_cents)}</td><td>${q.data_pagamento ? 'pago em ' + dataBR(q.data_pagamento) : ''}</td><td class="status s-${q.status}">${STATUS[q.status]}</td></tr>`).join('')}</table></td></tr>`).join('');
  const tot = r.reduce((s, x) => ({ t: s.t + x.total_cents, p: s.p + x.pago_cents, a: s.a + x.aberto_cents }), { t: 0, p: 0, a: 0 });
  el.innerHTML = `<div class="barra">${controlePeriodo(p)}<span class="suave">por data de competência</span><span class="espaco"></span>
    <select class="campo" name="status"><option value="">Todos os status</option><option value="em_aberto">Em aberto</option><option value="vencido">Com parcela vencida</option><option value="pago">Pagos</option></select>
    <input class="campo" type="search" name="busca" placeholder="Pesquisar" value="${esc(filtro.busca)}"><button class="btn primary" data-novo>Nova receita de contrato</button></div>
    <div class="grid g3" style="margin-bottom:16px"><div class="card"><h3>Total contratado</h3><strong>${brl(tot.t)}</strong></div><div class="card"><h3>Recebido</h3><strong class="verde">${brl(tot.p)}</strong></div><div class="card"><h3>Em aberto</h3><strong class="laranja">${brl(tot.a)}</strong></div></div>
    ${r.length ? `<div class="tabela-wrap"><table><thead><tr><th>Pagamento</th><th>Cliente</th><th>Projeto</th><th>Competência</th><th class="num">Valor total</th><th class="num">Valor pago</th><th class="num">Em aberto</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table></div>` : vazio('Nenhum pagamento de contrato neste período. Crie uma receita ligada a um projeto.')}`;
  $('[name=status]', el).value = filtro.status;
  ligarPeriodo(el, () => pagamentos(el));
  $('[name=status]', el).onchange = (e) => { filtro.status = e.target.value; pagamentos(el); };
  let t; $('[name=busca]', el).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { filtro.busca = e.target.value; pagamentos(el); }, 350); };
  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.novo !== undefined) return formLancamento('receita', () => pagamentos(el));
    const det = $(`[data-det="${b.dataset.exp}"]`, el);
    if (det) { det.hidden = !det.hidden; b.textContent = det.hidden ? '▸' : '▾'; }
  };
}

// ---------- Transferências ----------
export async function transferencias(el) {
  const p = getPeriodo();
  const r = await api(`transferencias?${qs(p)}`);
  el.innerHTML = `<div class="barra">${controlePeriodo(p)}<span class="espaco"></span><button class="btn primary" data-novo>Nova transferência</button></div>
    ${r.length ? `<div class="tabela-wrap"><table><thead><tr><th>Descrição</th><th class="num">Valor</th><th>De</th><th>Para</th><th>Data</th><th></th></tr></thead><tbody>${r.map((t) => `<tr><td>${esc(t.descricao)}</td><td class="num">${brl(t.valor_cents)}</td><td>${esc(t.origem_nome)}</td><td>${esc(t.destino_nome)}</td><td>${dataBR(t.data)}</td><td class="acoes"><button class="btn mini perigo" data-del="${t.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>`
    : vazio('Cadastre aqui movimentações internas entre suas contas. Nenhuma transferência no período.')}`;
  ligarPeriodo(el, () => transferencias(el));
  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.novo !== undefined) return formTransferencia(() => transferencias(el));
    if (b.dataset.del && await confirmar('Excluir esta transferência?')) { await api(`transferencias/${b.dataset.del}`, { method: 'DELETE' }); transferencias(el); }
  };
}

// ---------- Contas e extratos ----------
export async function contas(el, query = {}) {
  const lista = await api('contas-saldos');
  const sel = query.conta || lista[0]?.id;
  const ex = sel ? await api(`contas/${sel}/extrato`) : null;
  el.innerHTML = `<div class="grid g3" style="margin-bottom:16px">${lista.map((c) => `<button class="kpi" data-conta="${c.id}" style="${String(c.id) === String(sel) ? 'border-color:var(--azul);background:var(--azul-claro)' : ''}"><span class="rot">${esc(c.nome)}<span class="suave">${esc(c.banco || '')}</span></span><div class="val ${c.saldo_cents < 0 ? 'vermelho' : ''}">${brl(c.saldo_cents)}</div></button>`).join('') || vazio('Nenhuma conta. Cadastre em Cadastros → Contas bancárias.')}</div>
    ${ex ? `<h2 style="font-size:16px;margin-bottom:10px">Extrato · ${esc(ex.conta.nome)}</h2><div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th class="num">Valor</th><th class="num">Saldo</th></tr></thead><tbody>
      <tr><td></td><td class="suave">Saldo inicial</td><td></td><td></td><td class="num">${brl(ex.saldo_inicial_cents)}</td></tr>
      ${[...ex.movimentos].reverse().map((m) => `<tr><td>${dataBR(m.data)}</td><td>${esc(m.descricao)}${m.origem === 'transferencia' ? ' <span class="chip cinza">transferência</span>' : ''}</td><td>${esc(m.pessoa || '')}</td><td class="num">${sv(m.valor_cents)}</td><td class="num">${brl(m.saldo_cents)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  el.onclick = (e) => { const b = e.target.closest('[data-conta]'); if (b) location.hash = `#/contas?conta=${b.dataset.conta}`; };
}

// ---------- Fluxo de caixa ----------
const abertos = new Set(['receitas', 'despesas']);
export async function fluxo(el) {
  const ano = fluxo.ano ||= anoAtual;
  const r = await api(`relatorios/fluxo-caixa?ano=${ano}`);
  const cel = (v, cor) => `<td class="num ${v < 0 ? 'vermelho' : cor || ''}">${brl(v)}</td>`;
  const dupla = (d, sinal = 1, cor = '') => d.previsto.map((_, m) => cel(sinal * d.previsto[m], cor) + cel(sinal * d.realizado[m], cor)).join('');
  const linha = (rot, d, { cls = '', sinal = 1, cor = '', toggle, nivel } = {}) =>
    `<tr class="${cls}"><td class="fixa">${toggle ? `<button class="toggle" data-t="${toggle}">${abertos.has(toggle) ? '▾' : '▸'}</button>` : ''}${esc(rot)}</td>${dupla(d, sinal, cor)}</tr>`;
  const resultado = { previsto: r.receitas.total.previsto.map((v, i) => v - r.despesas.total.previsto[i]), realizado: r.receitas.total.realizado.map((v, i) => v - r.despesas.total.realizado[i]) };
  el.innerHTML = `<div class="barra">${seletorAno(ano)}<span class="suave">Previsto = por vencimento · Realizado = por data de pagamento. O saldo final de cada mês é o saldo inicial do seguinte.</span></div>
    <div class="tabela-wrap"><table class="hier"><thead><tr><th class="fixa" rowspan="2">Descrição</th>${MESES.map((m) => `<th colspan="2" class="num" style="text-align:center">${m}</th>`).join('')}</tr>
    <tr>${MESES.map(() => '<th class="num">Previsto</th><th class="num">Realizado</th>').join('')}</tr></thead><tbody>
    ${linha('Saldo inicial', r.saldo_inicial, { cls: 'sub' })}
    ${linha('Total de receitas', r.receitas.total, { cls: 'sub', cor: 'verde', toggle: 'receitas' })}
    ${abertos.has('receitas') ? r.receitas.categorias.map((c) => linha(c.nome, c, { cls: 'cat' })).join('') : ''}
    ${linha('Total de despesas', r.despesas.total, { cls: 'sub', sinal: -1, toggle: 'despesas' })}
    ${abertos.has('despesas') ? r.despesas.categorias.map((c) => linha(c.nome, c, { cls: 'cat', sinal: -1 })).join('') : ''}
    ${linha('Resultado do mês', resultado, { cls: 'sub' })}${linha('Saldo final', r.saldo_final, { cls: 'sub' })}</tbody></table></div>`;
  $('[name=ano]', el).onchange = (e) => { fluxo.ano = Number(e.target.value); fluxo(el); };
  el.onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { abertos.has(b.dataset.t) ? abertos.delete(b.dataset.t) : abertos.add(b.dataset.t); fluxo(el); } };
}

// ---------- DRE gerencial ----------
const abertosDre = new Set();
export async function dre(el) {
  const ano = dre.ano ||= anoAtual;
  const regime = dre.regime ||= 'competencia';
  const r = await api(`relatorios/dre?${qs({ ano, regime })}`);
  const pct = (v) => (v === null ? '—' : `${v.toFixed(2).replace('.', ',')}%`);
  const celulas = (vals, margem) => vals.map((v) => (margem ? `<td class="num ${v !== null && v < 0 ? 'vermelho' : ''}">${pct(v)}</td>` : `<td class="num ${v < 0 ? 'vermelho' : v > 0 ? 'verde' : 'suave'}">${brl(v)}</td>`)).join('');
  const linhas = r.linhas.map((l) => {
    if (l.tipo === 'margem') return `<tr class="margem"><td class="fixa">${esc(l.nome)}</td>${celulas(l.valores, true)}<td class="num"></td></tr>`;
    const exp = l.tipo === 'grupo' && l.categorias.length;
    let h = `<tr class="${l.tipo === 'subtotal' ? 'sub' : ''}"><td class="fixa">${exp ? `<button class="toggle" data-g="${l.chave}">${abertosDre.has(l.chave) ? '▾' : '▸'}</button>` : ''}${esc(l.nome)}</td>${celulas(l.valores)}<td class="num ${l.total < 0 ? 'vermelho' : ''}"><strong>${brl(l.total)}</strong></td></tr>`;
    if (exp && abertosDre.has(l.chave)) h += l.categorias.map((c) => `<tr class="cat"><td class="fixa">${esc(c.nome)}</td>${celulas(c.valores)}<td class="num">${brl(c.total)}</td></tr>`).join('');
    return h;
  }).join('');
  el.innerHTML = `<div class="barra">${seletorAno(ano)}<select class="campo" name="regime"><option value="competencia"${regime === 'competencia' ? ' selected' : ''}>Regime de competência</option><option value="caixa"${regime === 'caixa' ? ' selected' : ''}>Regime de caixa</option></select>
    <span class="suave">Margens calculadas sobre a receita operacional bruta.</span></div>
    <div class="tabela-wrap"><table class="hier"><thead><tr><th class="fixa">Demonstração do resultado</th>${MESES.map((m) => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${linhas}</tbody></table></div>
    <p class="suave" style="margin-top:10px">Cada categoria pertence a um grupo da DRE (${Object.values(GRUPOS).join('; ')}). Ajuste em Cadastros → Categorias.</p>`;
  $('[name=ano]', el).onchange = (e) => { dre.ano = Number(e.target.value); dre(el); };
  $('[name=regime]', el).onchange = (e) => { dre.regime = e.target.value; dre(el); };
  el.onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { abertosDre.has(b.dataset.g) ? abertosDre.delete(b.dataset.g) : abertosDre.add(b.dataset.g); dre(el); } };
}

// ---------- Resultados ----------
export async function resultados(el, query = {}) {
  const aba = resultados.aba = query.aba || resultados.aba || 'gerais';
  const p = getPeriodo();
  const campo = resultados.campo ||= 'vencimento';
  const seletor = `<div class="barra">${controlePeriodo(p)}${aba === 'gerais' ? `<select class="campo" name="campo"><option value="vencimento">Vencimento das parcelas</option><option value="pagamento">Pagamento das parcelas</option><option value="competencia">Competência</option></select>` : ''}</div>`;
  const abas = tabs([['gerais', 'Resultados gerais'], ['consolidado', 'Consolidado por projeto'], ['previsto', 'Previsto por projeto']], aba);
  let corpo;
  if (aba === 'gerais') {
    const r = await api(`relatorios/resultados?${qs({ ...p, campo })}`);
    corpo = `<div class="faixas" style="grid-template-columns:repeat(3,1fr)"><div class="faixa"><span class="rot verde">Receitas<span class="qtd">${r.receitas.qtd}</span></span><div class="val">${brl(r.receitas.valor)}</div></div>
      <div class="faixa"><span class="rot vermelho">Despesas<span class="qtd">${r.despesas.qtd}</span></span><div class="val">${brl(r.despesas.valor)}</div></div>
      <div class="faixa ativa"><span class="rot azul">Resultado do período<span class="qtd">${r.resultado.qtd}</span></span><div class="val">${brl(r.resultado.valor)}</div></div></div>
      <div class="card"><h3>Resultado por mês (recebido − pago)</h3>${grafico(r.grafico.map((m) => ({ rotulo: rotuloMes(m.mes), partes: [{ valor: m.valor, cor: m.valor < 0 ? CORES.vermelho : CORES.azul }] })))}</div>`;
  } else {
    const r = await api(`relatorios/resultados-projeto?${qs({ ...p, previsto: aba === 'previsto' })}`);
    const pre = aba === 'previsto';
    corpo = `<div class="faixas" style="grid-template-columns:repeat(3,1fr)"><div class="faixa"><span class="rot verde">${pre ? 'Previsão de receitas' : 'Receitas'}</span><div class="val">${brl(r.receitas_cents)}</div></div>
      <div class="faixa"><span class="rot vermelho">${pre ? 'Previsão de despesas' : 'Despesas'}</span><div class="val">${brl(r.despesas_cents)}</div></div>
      <div class="faixa ativa"><span class="rot azul">${pre ? 'Resultado previsto' : 'Resultado do período'}<span class="qtd">${r.itens.length}</span></span><div class="val">${brl(r.resultado_cents)}</div></div></div>
      ${r.itens.length ? `<div class="tabela-wrap"><table><thead><tr><th>Projeto</th><th>Cliente</th><th class="num">${pre ? 'Previsão de receitas' : 'Receitas'}</th><th class="num">${pre ? 'Previsão de despesas' : 'Despesas'}</th><th class="num">${pre ? 'Resultado previsto' : 'Resultado'}</th><th class="num">Margem</th></tr></thead><tbody>
      ${r.itens.map((i) => `<tr><td>${esc(i.projeto)}</td><td>${esc(i.cliente || '-')}</td><td class="num verde">${brl(i.receitas_cents)}</td><td class="num vermelho">${brl(i.despesas_cents)}</td><td class="num">${sv(i.resultado_cents)}</td><td class="num">${i.receitas_cents ? ((i.resultado_cents / i.receitas_cents) * 100).toFixed(1).replace('.', ',') + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhum projeto com movimento neste período.')}`;
  }
  el.innerHTML = abas + seletor + corpo;
  const c = $('[name=campo]', el); if (c) { c.value = campo; c.onchange = (e) => { resultados.campo = e.target.value; resultados(el); }; }
  ligarPeriodo(el, () => resultados(el));
  el.onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { resultados.aba = b.dataset.tab; resultados(el); } };
}

// ---------- Outros relatórios ----------
export async function outros(el) {
  const f = outros.f ||= { agrupar: 'cliente', tipo: 'receita', campo: 'competencia', status: '' };
  const p = getPeriodo();
  const r = await api(`relatorios/outros?${qs({ ...f, ...p })}`);
  const abas = [['cliente', 'Clientes'], ['fornecedor', 'Fornecedores'], ['categoria', 'Categorias'], ['centro_custo', 'Centros de custo'], ['projeto', 'Projetos']];
  const sel = (nome, ops) => `<select class="campo" name="${nome}">${Object.entries(ops).map(([v, t]) => `<option value="${v}"${f[nome] === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  el.innerHTML = `${tabs(abas, f.agrupar)}<div class="barra">${controlePeriodo(p)}${sel('campo', { competencia: 'Competência', vencimento: 'Vencimento', pagamento: 'Pagamento' })}
    ${sel('tipo', { receita: 'Receitas', despesa: 'Despesas' })}${sel('status', { '': 'Todos os status', em_aberto: 'Em aberto', vencido: 'Vencidas', pago: 'Pagas' })}<span class="espaco"></span>
    <a class="btn" href="${urlApi(`relatorios/outros.csv?${qs({ ...f, ...p })}`)}">Exportar planilha</a></div>
    ${r.itens.length ? `<div class="tabela-wrap"><table><thead><tr><th>Nome</th><th class="num">Lançamentos</th><th class="num">Valor</th><th class="num">Pago</th><th class="num">Em aberto</th></tr></thead><tbody>
    ${r.itens.map((i) => `<tr><td>${esc(i.nome)}</td><td class="num">${i.qtd}</td><td class="num">${brl(i.valor_cents)}</td><td class="num verde">${brl(i.pago_cents)}</td><td class="num laranja">${brl(i.aberto_cents)}</td></tr>`).join('')}
    <tr class="sub"><td><strong>Total</strong></td><td class="num">${r.total.qtd}</td><td class="num"><strong>${brl(r.total.valor_cents)}</strong></td><td class="num">${brl(r.total.pago_cents)}</td><td class="num">${brl(r.total.aberto_cents)}</td></tr></tbody></table></div>` : vazio('Nada encontrado com estes filtros.')}`;
  for (const n of ['campo', 'tipo', 'status']) $(`[name=${n}]`, el).onchange = (e) => { f[n] = e.target.value; outros(el); };
  ligarPeriodo(el, () => outros(el));
  el.onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    f.agrupar = b.dataset.tab;
    if (b.dataset.tab === 'fornecedor') f.tipo = 'despesa'; else if (b.dataset.tab === 'cliente') f.tipo = 'receita';
    outros(el);
  };
}

// ---------- Cadastros ----------
export async function cadastrosView(el, query = {}) {
  const aba = cadastrosView.aba = query.aba || cadastrosView.aba || 'contas';
  const cfg = CADASTROS[aba];
  const dados = await api(`cadastros/${aba}`);
  const fmt = (r, [k, , t]) => {
    const v = r[k];
    if (t === 'money') return `<td class="num">${brl(v || 0)}</td>`;
    if (t === 'grupo') return `<td>${esc(GRUPOS[v] || v)}</td>`;
    if (k === 'tipo') return `<td><span class="chip${v === 'despesa' ? ' cinza' : ''}">${esc(v)}</span></td>`;
    return `<td>${esc(v ?? '')}</td>`;
  };
  el.innerHTML = `${tabs(Object.entries(CADASTROS).map(([k, c]) => [k, c.titulo]), aba)}<div class="barra"><span class="espaco"></span><button class="btn primary" data-novo>Novo(a) ${cfg.singular}</button></div>
    ${dados.length ? `<div class="tabela-wrap"><table><thead><tr>${cfg.colunas.map((c) => `<th${c[2] === 'money' ? ' class="num"' : ''}>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
    ${dados.map((r) => `<tr>${cfg.colunas.map((c) => fmt(r, c)).join('')}<td class="acoes"><button class="btn mini" data-edit="${r.id}">Editar</button> <button class="btn mini perigo" data-del="${r.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : vazio('Nada cadastrado ainda.')}`;
  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const recarregar = () => cadastrosView(el);
    try {
      if (b.dataset.tab) { cadastrosView.aba = b.dataset.tab; return recarregar(); }
      if (b.dataset.novo !== undefined) return formCadastro(aba, null, recarregar);
      if (b.dataset.edit) return formCadastro(aba, dados.find((x) => String(x.id) === b.dataset.edit), recarregar);
      if (b.dataset.del && await confirmar('Excluir este cadastro?')) { await api(`cadastros/${aba}/${b.dataset.del}`, { method: 'DELETE' }); limparCache(); toast('Excluído.'); recarregar(); }
    } catch (err) { toast(err.message, true); }
  };
}

export { cadastros, opcoes, MES_CURTO };
