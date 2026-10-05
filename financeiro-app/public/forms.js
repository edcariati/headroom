import { $, api, dataBR, dinheiroInput, esc, hojeISO, modal, opcoes, parseDinheiro, toast } from './util.js';

export const GRUPOS = {
  receita_bruta: 'Receita operacional bruta', deducoes: 'Deduções da receita bruta', custos_operacionais: 'Custos operacionais',
  despesas_operacionais: 'Despesas operacionais', financeiras: 'Receitas e despesas financeiras', nao_operacionais: 'Outras receitas e despesas não operacionais',
};

let cache = null;
export async function cadastros(forcar = false) {
  if (!cache || forcar) {
    const [contas, categorias, centros, pessoas, contratos] = await Promise.all(
      ['contas', 'categorias', 'centros', 'pessoas', 'contratos'].map((c) => api(`cadastros/${c}`)));
    cache = { contas: contas.filter((c) => c.ativa), todasContas: contas, categorias, centros, pessoas, contratos };
  }
  return cache;
}
export const limparCache = () => { cache = null; };

export async function formLancamento(tipo, aoSalvar) {
  const c = await cadastros();
  const ehReceita = tipo === 'receita';
  const pessoas = c.pessoas.filter((p) => p.tipo === 'ambos' || p.tipo === (ehReceita ? 'cliente' : 'fornecedor'));
  const cats = c.categorias.filter((x) => x.tipo === tipo);
  const hoje = hojeISO();
  const corpo = `
    <label class="f">Nome *<input class="campo" name="nome" required placeholder="${ehReceita ? 'Ex.: Projeto arquitetônico Fulano' : 'Ex.: Pagamento engenheiro'}"></label>
    <div class="linha2">
      <label class="f">Valor *<input class="campo" name="valor" inputmode="decimal" required placeholder="0,00"></label>
      <label class="f">Primeiro vencimento *<input class="campo" type="date" name="primeiro_vencimento" value="${hoje}" required></label>
    </div>
    <div class="linha2 parc-campos"><label class="f">Parcelas<input class="campo" type="number" name="parcelas" min="1" max="360" value="1"></label>
      <label class="f">Data de competência<input class="campo" type="date" name="competencia" value="${hoje}"></label></div>
    <label class="check"><input type="checkbox" name="recorrente"> Repete todo mês (aluguel, salário…): o valor se repete a cada mês</label>
    <label class="f rec-campos" hidden>Quantos meses<input class="campo" type="number" name="repeticoes" min="1" max="360" value="12"></label>
    <div class="linha2">
      <label class="f">${ehReceita ? 'Cliente' : 'Fornecedor'}<select class="campo" name="pessoa_id">${opcoes(pessoas, '', '—')}</select></label>
      <label class="f">Categoria *<select class="campo" name="categoria_id" required>${opcoes(cats, '', 'Escolha…')}</select></label>
    </div>
    <div class="linha2">
      <label class="f">Centro de custo<select class="campo" name="centro_custo_id">${opcoes(c.centros, '', '—')}</select></label>
      <label class="f">Projeto / contrato<select class="campo" name="contrato_id">${opcoes(c.contratos, '', 'Nenhum (é do escritório)', (x) => `${x.codigo} - ${x.nome}`)}</select></label>
    </div>
    <div class="linha2">
      <label class="f">Conta bancária<select class="campo" name="conta_id">${opcoes(c.contas, c.contas[0]?.id, '—')}</select></label>
      <label class="f">Nota fiscal<input class="campo" name="nota_fiscal"></label>
    </div>
    <label class="f">Etiquetas<input class="campo" name="etiquetas" placeholder="separe por vírgula"></label>
    <label class="check"><input type="checkbox" name="primeira_paga"> ${ehReceita ? 'Primeira parcela já foi recebida' : 'Primeira parcela já foi paga'}</label>
    <label class="f pg-campos" hidden>Data do ${ehReceita ? 'recebimento' : 'pagamento'}<input class="campo" type="date" name="data_pagamento" value="${hoje}"></label>
    ${pessoas.length === 0 ? `<p class="suave">Nenhum ${ehReceita ? 'cliente' : 'fornecedor'} cadastrado. Cadastre em Cadastros → Pessoas.</p>` : ''}`;
  const m = modal(ehReceita ? 'Nova receita' : 'Nova despesa', corpo, {
    rotulo: 'Criar lançamento',
    onSubmit: async (d) => {
      const valor = parseDinheiro(d.valor);
      if (!valor || valor <= 0) throw new Error('Informe um valor válido, como 1.250,00.');
      const n = (v) => v || null;
      await api('lancamentos', { method: 'POST', body: {
        tipo, nome: d.nome, valor_total_cents: valor, primeiro_vencimento: d.primeiro_vencimento,
        competencia: d.competencia || d.primeiro_vencimento, parcelas: Number(d.parcelas || 1), recorrente: d.recorrente,
        repeticoes: Number(d.repeticoes || 12), pessoa_id: n(d.pessoa_id), categoria_id: n(d.categoria_id), centro_custo_id: n(d.centro_custo_id),
        contrato_id: n(d.contrato_id), conta_id: n(d.conta_id), nota_fiscal: d.nota_fiscal || null, etiquetas: d.etiquetas || null,
        primeira_paga: d.primeira_paga, data_pagamento: d.data_pagamento,
      } });
      toast('Lançamento criado.');
      aoSalvar?.();
    },
  });
  const f = $('form', m.dlg);
  f.recorrente.onchange = () => {
    $('.rec-campos', f).hidden = !f.recorrente.checked;
    $('.parc-campos label:first-child', f).hidden = f.recorrente.checked;
  };
  f.primeira_paga.onchange = () => { $('.pg-campos', f).hidden = !f.primeira_paga.checked; };
  f.primeiro_vencimento.onchange = () => { f.competencia.value = f.primeiro_vencimento.value; };
}

export async function formBaixa(p, aoSalvar) {
  const c = await cadastros();
  const rec = p.tipo === 'receita';
  modal(rec ? 'Registrar recebimento' : 'Registrar pagamento', `
    <p><strong>${esc(p.nome)}</strong><br><span class="suave">Vencimento ${dataBR(p.vencimento)} · falta ${(p.aberto_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
    <div class="linha2"><label class="f">Data<input class="campo" type="date" name="data" value="${hojeISO()}" required></label>
    <label class="f">Valor<input class="campo" name="valor" value="${dinheiroInput(p.aberto_cents)}" inputmode="decimal" required></label></div>
    <label class="f">Conta bancária<select class="campo" name="conta_id" required>${opcoes(c.contas, p.conta_id || c.contas[0]?.id, 'Escolha…')}</select></label>`, {
    rotulo: 'Confirmar',
    onSubmit: async (d) => {
      const valor = parseDinheiro(d.valor);
      if (!valor) throw new Error('Valor inválido.');
      await api(`parcelas/${p.id}/baixa`, { method: 'POST', body: { data: d.data, valor_cents: valor, conta_id: d.conta_id } });
      toast('Baixa registrada.');
      aoSalvar?.();
    },
  });
}

export function formEditarParcela(p, aoSalvar) {
  modal('Editar parcela', `<p><strong>${esc(p.nome)}</strong></p>
    <div class="linha2"><label class="f">Vencimento<input class="campo" type="date" name="vencimento" value="${p.vencimento}" required></label>
    <label class="f">Valor<input class="campo" name="valor" value="${dinheiroInput(p.valor_cents)}" inputmode="decimal" required></label></div>`, {
    onSubmit: async (d) => {
      const valor = parseDinheiro(d.valor);
      if (!valor) throw new Error('Valor inválido.');
      await api(`parcelas/${p.id}`, { method: 'PUT', body: { vencimento: d.vencimento, valor_cents: valor } });
      toast('Parcela atualizada.');
      aoSalvar?.();
    },
  });
}

export async function formTransferencia(aoSalvar) {
  const c = await cadastros();
  modal('Nova transferência', `
    <label class="f">Descrição *<input class="campo" name="descricao" required placeholder="Ex.: Reserva de caixa"></label>
    <div class="linha2"><label class="f">Valor *<input class="campo" name="valor" inputmode="decimal" required placeholder="0,00"></label>
    <label class="f">Data *<input class="campo" type="date" name="data" value="${hojeISO()}" required></label></div>
    <div class="linha2"><label class="f">De *<select class="campo" name="origem" required>${opcoes(c.contas, '', 'Escolha…')}</select></label>
    <label class="f">Para *<select class="campo" name="destino" required>${opcoes(c.contas, '', 'Escolha…')}</select></label></div>`, {
    onSubmit: async (d) => {
      const valor = parseDinheiro(d.valor);
      if (!valor) throw new Error('Valor inválido.');
      await api('transferencias', { method: 'POST', body: { descricao: d.descricao, valor_cents: valor, data: d.data,
        conta_origem_id: d.origem, conta_destino_id: d.destino } });
      toast('Transferência registrada.');
      aoSalvar?.();
    },
  });
}

// Configuração dos cadastros: [campo, rótulo, tipo, opções]
export const CADASTROS = {
  contas: { titulo: 'Contas bancárias', singular: 'conta', campos: [['nome', 'Nome', 'text'], ['banco', 'Banco', 'text'], ['saldo_inicial_cents', 'Saldo inicial', 'money']],
    colunas: [['nome', 'Nome'], ['banco', 'Banco'], ['saldo_inicial_cents', 'Saldo inicial', 'money']] },
  categorias: { titulo: 'Categorias', singular: 'categoria', campos: [['nome', 'Nome', 'text'], ['tipo', 'Tipo', 'select', { receita: 'Receita', despesa: 'Despesa' }],
    ['grupo_dre', 'Grupo da DRE', 'select', GRUPOS]], colunas: [['nome', 'Nome'], ['tipo', 'Tipo'], ['grupo_dre', 'Grupo da DRE', 'grupo']] },
  centros: { titulo: 'Centros de custo', singular: 'centro de custo', campos: [['nome', 'Nome', 'text']], colunas: [['nome', 'Nome']] },
  pessoas: { titulo: 'Clientes e fornecedores', singular: 'pessoa', campos: [['nome', 'Nome', 'text'],
    ['tipo', 'Tipo', 'select', { cliente: 'Cliente', fornecedor: 'Fornecedor', ambos: 'Cliente e fornecedor' }], ['documento', 'CPF/CNPJ', 'text'], ['email', 'E-mail', 'text'], ['telefone', 'Telefone', 'text']],
    colunas: [['nome', 'Nome'], ['tipo', 'Tipo'], ['documento', 'CPF/CNPJ'], ['email', 'E-mail'], ['telefone', 'Telefone']] },
  contratos: { titulo: 'Projetos / contratos', singular: 'contrato', campos: [['codigo', 'Código', 'text'], ['nome', 'Nome', 'text'], ['pessoa_id', 'Cliente', 'pessoa'],
    ['valor_total_cents', 'Valor do contrato', 'money'], ['competencia', 'Data de competência', 'date'], ['status', 'Status', 'select', { ativo: 'Ativo', concluido: 'Concluído', cancelado: 'Cancelado' }]],
    colunas: [['codigo', 'Código'], ['nome', 'Nome'], ['pessoa_nome', 'Cliente'], ['valor_total_cents', 'Valor', 'money'], ['status', 'Status']] },
};

export async function formCadastro(tipo, reg, aoSalvar) {
  const cfg = CADASTROS[tipo];
  const c = await cadastros();
  const campo = ([k, rot, t, ops]) => {
    const v = reg?.[k] ?? '';
    let ctl;
    if (t === 'select') ctl = `<select class="campo" name="${k}">${Object.entries(ops).map(([val, r]) => `<option value="${val}"${v === val ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>`;
    else if (t === 'pessoa') ctl = `<select class="campo" name="${k}">${opcoes(c.pessoas.filter((p) => p.tipo !== 'fornecedor'), v, '—')}</select>`;
    else if (t === 'money') ctl = `<input class="campo" name="${k}" inputmode="decimal" value="${v === '' ? '' : dinheiroInput(v)}" placeholder="0,00">`;
    else ctl = `<input class="campo" type="${t === 'date' ? 'date' : 'text'}" name="${k}" value="${esc(v)}">`;
    return `<label class="f">${esc(rot)}${k === 'nome' || k === 'codigo' ? ' *' : ''}${ctl}</label>`;
  };
  modal(`${reg ? 'Editar' : 'Novo(a)'} ${cfg.singular}`, cfg.campos.map(campo).join(''), {
    onSubmit: async (d) => {
      const body = {};
      for (const [k, , t] of cfg.campos) {
        if (t === 'money') { const v = parseDinheiro(d[k]); body[k] = v ?? 0; } else if (t === 'pessoa') body[k] = d[k] || null;
        else body[k] = d[k];
      }
      await api(`cadastros/${tipo}${reg ? '/' + reg.id : ''}`, { method: reg ? 'PUT' : 'POST', body });
      limparCache();
      toast('Salvo.');
      aoSalvar?.();
    },
  });
}
