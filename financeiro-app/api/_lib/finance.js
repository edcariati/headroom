// Regras do financeiro. Funções puras sobre os dados em memória (sem banco), para rodarem igual
// no servidor local, nos testes e na Vercel. Valores sempre em centavos (inteiros).
import crypto from 'node:crypto';
import { addMeses, ehISO, hojeISO, mesDe, mesesEntre } from './dates.js';

export class ErroValidacao extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}
export const novoId = () => crypto.randomBytes(6).toString('hex');

export const GRUPOS = ['receita_bruta', 'deducoes', 'custos_operacionais', 'despesas_operacionais', 'financeiras', 'nao_operacionais'];
const GRUPOS_SO_RECEITA = ['receita_bruta'];
const GRUPOS_SO_DESPESA = ['deducoes', 'custos_operacionais', 'despesas_operacionais'];

const exigir = (cond, msg, status) => { if (!cond) throw new ErroValidacao(msg, status); };
const inteiroPos = (v) => Number.isInteger(v) && v > 0;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const soma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);

export function dividirCentavos(total, n) {
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}
export const abertoDe = (p) => Math.max(0, p.valor_cents - p.valor_pago_cents);

// pago | vencido | vence_hoje | a_vencer
export function statusParcela(p, hoje) {
  if (p.valor_pago_cents >= p.valor_cents) return 'pago';
  if (p.vencimento < hoje) return 'vencido';
  if (p.vencimento === hoje) return 'vence_hoje';
  return 'a_vencer';
}

// ---------- dados em memória ----------

const COLECOES = ['contas', 'categorias', 'centros', 'pessoas', 'servicos', 'contratos', 'lancamentos', 'transferencias', 'contatos', 'conferencias', 'entregas', 'anexos', 'recibos', 'notas'];
export function criarDados(colecoes = {}) {
  const d = Object.fromEntries(COLECOES.map((c) => [c, colecoes[c] ? [...colecoes[c]] : []]));
  d.mapa = Object.fromEntries(COLECOES.map((c) => [c, new Map(d[c].map((x) => [x.id, x]))]));
  return d;
}
// Nome completo da categoria: "Automóvel › Combustível" para subcategorias.
export const caminhoCategoria = (d, cat) => (!cat ? null : cat.pai_id && d.mapa.categorias.get(cat.pai_id) ? `${d.mapa.categorias.get(cat.pai_id).nome} › ${cat.nome}` : cat.nome);
const achar = (d, colecao, id, msg) => {
  const x = d.mapa[colecao].get(id);
  exigir(x, msg, 404);
  return x;
};

// Lista plana de parcelas, já com os nomes de pessoa, categoria etc. e o status calculado.
function expandir(d, hoje) {
  if (d._exp?.hoje === hoje) return d._exp.lista;
  const lista = [];
  for (const l of d.lancamentos) {
    const pe = d.mapa.pessoas.get(l.pessoa_id);
    const cat = d.mapa.categorias.get(l.categoria_id);
    const cc = d.mapa.centros.get(l.centro_custo_id);
    const ct = d.mapa.contratos.get(l.contrato_id);
    for (const p of l.parcelas) {
      const pagamentos = p.pagamentos || [];
      const ult = pagamentos[pagamentos.length - 1];
      const e = {
        id: `${l.id}:${p.numero}`, lancamento_id: l.id, numero: p.numero, total: p.total, valor_cents: p.valor_cents,
        vencimento: p.vencimento, competencia: p.competencia, pagamentos,
        valor_pago_cents: soma(pagamentos, (x) => x.valor_cents), data_pagamento: ult?.data ?? null,
        conta_id: ult?.conta_id ?? l.conta_id ?? null, tipo: l.tipo, lancamento_nome: l.nome, nota_fiscal: l.nota_fiscal,
        etiquetas: l.etiquetas, recorrente: !!l.recorrente, criado_em: l.criado_em || '',
        pessoa_id: l.pessoa_id, categoria_id: l.categoria_id, centro_custo_id: l.centro_custo_id, contrato_id: l.contrato_id,
        pessoa_nome: pe?.nome ?? null, categoria_nome: caminhoCategoria(d, cat), grupo_dre: cat?.grupo_dre ?? null,
        centro_custo_nome: cc?.nome ?? null, contrato_codigo: ct?.codigo ?? null, contrato_nome: ct?.nome ?? null,
        conta_nome: d.mapa.contas.get(ult?.conta_id ?? l.conta_id)?.nome ?? null,
      };
      e.status = statusParcela(e, hoje);
      e.aberto_cents = abertoDe(e);
      e.nome = l.recorrente || p.total <= 1 ? l.nome : `${l.nome} ${p.numero}/${p.total}`;
      lista.push(e);
    }
  }
  lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.criado_em.localeCompare(b.criado_em)
    || a.lancamento_id.localeCompare(b.lancamento_id) || a.numero - b.numero);
  d._exp = { hoje, lista };
  return lista;
}

// Cada pagamento (inclusive parcial) como um movimento: usado por saldos, extrato, fluxo realizado e caixa.
function movimentos(d, hoje) {
  const out = [];
  for (const p of expandir(d, hoje)) for (const pg of p.pagamentos) out.push({ parcela: p, valor_cents: pg.valor_cents, data: pg.data, conta_id: pg.conta_id });
  return out;
}

// ---------- lançamentos ----------

export function criarLancamento(d, i, agora = new Date().toISOString()) {
  exigir(['receita', 'despesa'].includes(i.tipo), 'Tipo deve ser receita ou despesa.');
  exigir(texto(i.nome), 'Informe o nome do lançamento.');
  exigir(inteiroPos(i.valor_total_cents), 'Informe um valor maior que zero.');
  exigir(ehISO(i.primeiro_vencimento), 'Informe a data do primeiro vencimento.');
  const competencia = i.competencia || i.primeiro_vencimento;
  exigir(ehISO(competencia), 'Data de competência inválida.');
  const recorrente = !!i.recorrente;
  const n = recorrente ? Number(i.repeticoes ?? 12) : Number(i.parcelas ?? 1);
  exigir(Number.isInteger(n) && n >= 1 && n <= 360, 'Número de parcelas deve ficar entre 1 e 360.');
  if (i.categoria_id) {
    const cat = achar(d, 'categorias', i.categoria_id, 'Categoria não encontrada.');
    exigir(cat.tipo === i.tipo, `Esta categoria é de ${cat.tipo}, não de ${i.tipo}.`);
  }
  if (i.pessoa_id) achar(d, 'pessoas', i.pessoa_id, 'Cliente/fornecedor não encontrado.');
  if (i.centro_custo_id) achar(d, 'centros', i.centro_custo_id, 'Centro de custo não encontrado.');
  if (i.contrato_id) achar(d, 'contratos', i.contrato_id, 'Projeto não encontrado.');
  if (i.conta_id) achar(d, 'contas', i.conta_id, 'Conta não encontrada.');
  // Recorrente: o valor informado é o de cada ocorrência. Parcelado: é o total, dividido em centavos.
  const valores = recorrente ? Array(n).fill(i.valor_total_cents) : dividirCentavos(i.valor_total_cents, n);
  exigir(valores.every((v) => v > 0), 'Valor muito pequeno para esse número de parcelas.');
  const l = {
    id: novoId(), tipo: i.tipo, nome: texto(i.nome), pessoa_id: i.pessoa_id || null, categoria_id: i.categoria_id || null,
    centro_custo_id: i.centro_custo_id || null, contrato_id: i.contrato_id || null, conta_id: i.conta_id || null,
    competencia, nota_fiscal: texto(i.nota_fiscal) || null, etiquetas: texto(i.etiquetas) || null, observacao: texto(i.observacao) || null,
    recorrente, nf_solicitada: !!i.nf_solicitada, criado_em: agora,
    parcelas: valores.map((v, k) => {
      const venc = addMeses(i.primeiro_vencimento, k);
      // Recorrente: a competência acompanha cada mês. Parcelado: toda a venda fica na competência informada.
      return { numero: k + 1, total: n, valor_cents: v, vencimento: venc, competencia: recorrente ? venc : competencia, pagamentos: [] };
    }),
  };
  if (i.primeira_paga) registrarPagamento(d, l, 1, { data: i.data_pagamento || i.primeiro_vencimento, conta_id: i.conta_id });
  return l;
}

function registrarPagamento(d, l, numero, { data, valor_cents, conta_id, comprovante } = {}) {
  const p = l.parcelas.find((x) => x.numero === numero);
  exigir(p, 'Parcela não encontrada.', 404);
  const dataPg = data || hojeISO();
  exigir(ehISO(dataPg), 'Data de pagamento inválida.');
  const pago = soma(p.pagamentos, (x) => x.valor_cents);
  const falta = p.valor_cents - pago;
  exigir(falta > 0, 'Esta parcela já está paga.');
  const valor = valor_cents ?? falta;
  exigir(inteiroPos(valor) && valor <= falta, `O valor deve ficar entre R$ 0,01 e o que falta pagar (R$ ${(falta / 100).toFixed(2).replace('.', ',')}).`);
  const conta = conta_id || p.pagamentos.at(-1)?.conta_id || l.conta_id;
  exigir(conta, 'Informe a conta bancária da baixa.');
  achar(d, 'contas', conta, 'Conta não encontrada.');
  const pg = { data: dataPg, valor_cents: valor, conta_id: conta };
  if (texto(comprovante)) pg.comprovante = texto(comprovante).slice(0, 300);
  p.pagamentos.push(pg);
}

const dividirId = (id) => {
  const [lid, n] = String(id).split(':');
  return [lid, Number(n)];
};
// As três operações abaixo devolvem uma CÓPIA do lançamento alterado, pronta para gravar.
function alterar(d, parcelaId, fn) {
  const [lid, numero] = dividirId(parcelaId);
  const original = achar(d, 'lancamentos', lid, 'Parcela não encontrada.');
  const l = structuredClone(original);
  fn(l, numero);
  return l;
}
export const baixarParcela = (d, id, dados) => alterar(d, id, (l, n) => registrarPagamento(d, l, n, dados));
export const estornarParcela = (d, id) => alterar(d, id, (l, n) => {
  const p = l.parcelas.find((x) => x.numero === n);
  exigir(p, 'Parcela não encontrada.', 404);
  p.pagamentos = [];
});
export const editarParcela = (d, id, { vencimento, valor_cents }) => alterar(d, id, (l, n) => {
  const p = l.parcelas.find((x) => x.numero === n);
  exigir(p, 'Parcela não encontrada.', 404);
  exigir(p.pagamentos.length === 0, 'Estorne o pagamento antes de editar a parcela.');
  if (vencimento !== undefined) { exigir(ehISO(vencimento), 'Vencimento inválido.'); p.vencimento = vencimento; }
  if (valor_cents !== undefined) { exigir(inteiroPos(valor_cents), 'Valor inválido.'); p.valor_cents = valor_cents; }
});

// ---------- consulta de parcelas ----------

const CAMPO_DATA = { vencimento: (p) => p.vencimento, pagamento: (p) => p.data_pagamento, competencia: (p) => p.competencia };

export function carregarParcelas(d, f = {}, hoje = hojeISO()) {
  const data = CAMPO_DATA[f.campo || 'vencimento'];
  exigir(data, 'Tipo de data inválido.');
  const q = f.busca ? String(f.busca).toLowerCase() : '';
  return expandir(d, hoje).filter((p) => {
    if (f.tipo && p.tipo !== f.tipo) return false;
    const dt = data(p);
    if (f.de && !(dt && dt >= f.de)) return false;
    if (f.ate && !(dt && dt <= f.ate)) return false;
    for (const k of ['categoria_id', 'pessoa_id', 'contrato_id', 'centro_custo_id', 'conta_id']) if (f[k] && p[k] !== f[k]) return false;
    if (q && !`${p.lancamento_nome} ${p.nota_fiscal || ''} ${p.pessoa_nome || ''} ${p.contrato_codigo || ''} ${p.etiquetas || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function limitesPeriodo(f) {
  const ano = new Date().getFullYear();
  return { de: f.de || `${ano}-01-01`, ate: f.ate || `${ano}-12-31` };
}

// Faixas do topo das listas. "pagos" soma tudo o que já foi pago (inclusive pagamentos parciais).
export function calcularFaixas(rows) {
  const z = () => ({ valor: 0, qtd: 0 });
  const f = { vencidos: z(), vence_hoje: z(), a_vencer: z(), pagos: z(), total: { valor: 0, qtd: rows.length } };
  for (const p of rows) {
    if (p.status === 'pago') f.pagos.qtd++;
    else if (p.status === 'vencido') { f.vencidos.valor += p.aberto_cents; f.vencidos.qtd++; }
    else if (p.status === 'vence_hoje') { f.vence_hoje.valor += p.aberto_cents; f.vence_hoje.qtd++; }
    else { f.a_vencer.valor += p.aberto_cents; f.a_vencer.qtd++; }
    f.pagos.valor += p.valor_pago_cents;
    f.total.valor += p.valor_cents;
  }
  return f;
}

// Gráfico mensal: pago, atrasado e previsto (a vencer + vence hoje).
function serieMensal(rows, de, ate) {
  const meses = new Map(mesesEntre(de, ate).map((m) => [m, { mes: m, pago: 0, atrasado: 0, previsto: 0 }]));
  for (const p of rows) {
    const m = meses.get(mesDe(p.vencimento));
    if (!m) continue;
    m.pago += p.valor_pago_cents;
    if (p.status === 'vencido') m.atrasado += p.aberto_cents;
    else if (p.status !== 'pago') m.previsto += p.aberto_cents;
  }
  return [...meses.values()];
}

export function listarParcelas(d, f = {}, hoje = hojeISO()) {
  const { de, ate } = limitesPeriodo(f);
  const todas = carregarParcelas(d, { ...f, de, ate }, hoje);
  let itens = todas;
  if (f.status) itens = itens.filter((p) => (f.status === 'em_aberto' ? p.status !== 'pago' : p.status === f.status));
  const pageSize = Math.min(Number(f.pageSize) || 25, 100000);
  const page = Math.max(Number(f.page) || 1, 1);
  const total_itens = itens.length;
  if (f.ordem === 'desc') itens = [...itens].reverse();
  return { faixas: calcularFaixas(todas), grafico: serieMensal(todas, de, ate), total_itens, page, pageSize,
    itens: f.todos ? itens : itens.slice((page - 1) * pageSize, page * pageSize) };
}

// ---------- contas, saldos e transferências ----------

export function saldoContas(d, ate = null, hoje = hojeISO()) {
  const movs = movimentos(d, hoje).filter((m) => !ate || m.data <= ate);
  const trs = d.transferencias.filter((t) => !ate || t.data <= ate);
  return d.contas.filter((c) => c.ativa !== 0 && c.ativa !== false).map((c) => {
    let s = c.saldo_inicial_cents || 0;
    for (const m of movs) if (m.conta_id === c.id) s += m.parcela.tipo === 'receita' ? m.valor_cents : -m.valor_cents;
    for (const t of trs) { if (t.conta_destino_id === c.id) s += t.valor_cents; if (t.conta_origem_id === c.id) s -= t.valor_cents; }
    return { ...c, saldo_cents: s };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function extratoConta(d, contaId, hoje = hojeISO()) {
  const conta = achar(d, 'contas', contaId, 'Conta não encontrada.');
  const mov = movimentos(d, hoje).filter((m) => m.conta_id === contaId).map((m) => ({
    data: m.data, descricao: m.parcela.nome, pessoa: m.parcela.pessoa_nome, origem: m.parcela.tipo,
    valor_cents: m.parcela.tipo === 'receita' ? m.valor_cents : -m.valor_cents }));
  for (const t of d.transferencias) {
    if (t.conta_origem_id === contaId || t.conta_destino_id === contaId) {
      mov.push({ data: t.data, descricao: t.descricao, pessoa: null, origem: 'transferencia', valor_cents: t.conta_destino_id === contaId ? t.valor_cents : -t.valor_cents });
    }
  }
  mov.sort((a, b) => a.data.localeCompare(b.data));
  let saldo = conta.saldo_inicial_cents || 0;
  for (const m of mov) { saldo += m.valor_cents; m.saldo_cents = saldo; }
  return { conta, saldo_inicial_cents: conta.saldo_inicial_cents || 0, movimentos: mov, saldo_cents: saldo };
}

export function criarTransferencia(d, i, agora = new Date().toISOString()) {
  exigir(texto(i.descricao), 'Informe a descrição.');
  exigir(inteiroPos(i.valor_cents), 'Informe um valor maior que zero.');
  exigir(i.conta_origem_id && i.conta_destino_id, 'Escolha as duas contas.');
  exigir(i.conta_origem_id !== i.conta_destino_id, 'As contas de origem e destino devem ser diferentes.');
  exigir(ehISO(i.data), 'Data inválida.');
  achar(d, 'contas', i.conta_origem_id, 'Conta de origem não encontrada.');
  achar(d, 'contas', i.conta_destino_id, 'Conta de destino não encontrada.');
  return { id: novoId(), descricao: texto(i.descricao), valor_cents: i.valor_cents, conta_origem_id: i.conta_origem_id,
    conta_destino_id: i.conta_destino_id, data: i.data, criado_em: agora };
}

export function listarTransferencias(d, f = {}) {
  const { de, ate } = limitesPeriodo(f);
  return d.transferencias.filter((t) => t.data >= de && t.data <= ate)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.criado_em || '').localeCompare(a.criado_em || ''))
    .map((t) => ({ ...t, origem_nome: d.mapa.contas.get(t.conta_origem_id)?.nome, destino_nome: d.mapa.contas.get(t.conta_destino_id)?.nome }));
}

// ---------- resumo (dashboard) ----------

export function resumo(d, f = {}, hoje = hojeISO()) {
  const { de, ate } = limitesPeriodo(f);
  const rows = carregarParcelas(d, { de, ate }, hoje);
  const lado = (tipo) => {
    const fx = calcularFaixas(rows.filter((p) => p.tipo === tipo));
    return { // "Em aberto" = a vencer + vence hoje (os vencidos aparecem à parte)
      em_aberto: { valor: fx.a_vencer.valor + fx.vence_hoje.valor, qtd: fx.a_vencer.qtd + fx.vence_hoje.qtd },
      vencido: fx.vencidos, realizado: fx.pagos };
  };
  const receitas = lado('receita');
  const despesas = lado('despesa');
  const contas = saldoContas(d, null, hoje);
  const abertas = (tipo) => rows.filter((p) => p.tipo === tipo && p.status !== 'pago').slice(0, 8)
    .map((p) => ({ id: p.id, nome: p.nome, pessoa: p.pessoa_nome, valor_cents: p.aberto_cents, vencimento: p.vencimento, status: p.status }));
  return { periodo: { de, ate }, contas, saldo_total_cents: soma(contas, (c) => c.saldo_cents), receitas, despesas,
    balanco_cents: receitas.realizado.valor - despesas.realizado.valor, // recebido − pago
    proximas_receitas: abertas('receita'), proximas_despesas: abertas('despesa') };
}

// ---------- pagamentos do cliente (contratos de receita) ----------

export function pagamentosCliente(d, f = {}, hoje = hojeISO()) {
  const { de, ate } = limitesPeriodo(f);
  const porLanc = Map.groupBy(expandir(d, hoje).filter((p) => p.tipo === 'receita'), (p) => p.lancamento_id);
  const busca = (f.busca || '').toLowerCase();
  return d.lancamentos.filter((l) => l.tipo === 'receita' && l.contrato_id && l.competencia >= de && l.competencia <= ate)
    .sort((a, b) => a.competencia.localeCompare(b.competencia) || (a.criado_em || '').localeCompare(b.criado_em || ''))
    .map((l) => {
      const ps = porLanc.get(l.id) || [];
      const total = soma(ps, (p) => p.valor_cents);
      const pago = soma(ps, (p) => p.valor_pago_cents);
      const ct = d.mapa.contratos.get(l.contrato_id);
      return { id: l.id, nome: l.nome, cliente: d.mapa.pessoas.get(l.pessoa_id)?.nome ?? null, contrato_codigo: ct?.codigo, contrato_nome: ct?.nome,
        competencia: l.competencia, total_cents: total, pago_cents: pago, aberto_cents: total - pago,
        status: total - pago <= 0 ? 'pago' : (ps.some((p) => p.status === 'vencido') ? 'vencido' : 'em_aberto'),
        parcelas: ps.map((p) => ({ id: p.id, nome: p.nome, vencimento: p.vencimento, valor_cents: p.valor_cents,
          valor_pago_cents: p.valor_pago_cents, data_pagamento: p.data_pagamento, status: p.status })) };
    })
    .filter((r) => (!busca || `${r.nome} ${r.cliente} ${r.contrato_codigo}`.toLowerCase().includes(busca)) && (!f.status || r.status === f.status));
}

// ---------- relatórios ----------

const zeros = () => Array(12).fill(0);
const idxMes = (iso) => Number(iso.slice(5, 7)) - 1;

export function fluxoCaixa(d, ano, hoje = hojeISO()) {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const parcelas = expandir(d, hoje);
  const movs = movimentos(d, hoje);
  // Saldo inicial do ano: saldo inicial das contas + tudo o que foi pago antes do ano.
  const abertura = soma(d.contas.filter((c) => c.ativa !== 0 && c.ativa !== false), (c) => c.saldo_inicial_cents || 0)
    + soma(movs.filter((m) => m.data < inicio), (m) => (m.parcela.tipo === 'receita' ? m.valor_cents : -m.valor_cents));
  const monta = (tipo) => {
    const cats = new Map();
    const total = { previsto: zeros(), realizado: zeros() };
    const cat = (p) => {
      const k = p.categoria_id || 0;
      if (!cats.has(k)) cats.set(k, { id: k, nome: p.categoria_nome || 'Sem categoria', previsto: zeros(), realizado: zeros() });
      return cats.get(k);
    };
    for (const p of parcelas.filter((x) => x.tipo === tipo && x.vencimento >= inicio && x.vencimento <= fim)) {
      cat(p).previsto[idxMes(p.vencimento)] += p.valor_cents;
      total.previsto[idxMes(p.vencimento)] += p.valor_cents;
    }
    for (const m of movs.filter((x) => x.parcela.tipo === tipo && x.data >= inicio && x.data <= fim)) {
      cat(m.parcela).realizado[idxMes(m.data)] += m.valor_cents;
      total.realizado[idxMes(m.data)] += m.valor_cents;
    }
    return { total, categorias: [...cats.values()].sort((a, b) => a.nome.localeCompare(b.nome)) };
  };
  const receitas = monta('receita');
  const despesas = monta('despesa');
  const saldo_inicial = { previsto: zeros(), realizado: zeros() };
  const saldo_final = { previsto: zeros(), realizado: zeros() };
  for (const k of ['previsto', 'realizado']) {
    let s = abertura;
    for (let m = 0; m < 12; m++) {
      saldo_inicial[k][m] = s;
      s += receitas.total[k][m] - despesas.total[k][m]; // o saldo final de um mês é o inicial do seguinte
      saldo_final[k][m] = s;
    }
  }
  return { ano, saldo_inicial, receitas, despesas, saldo_final };
}

export function dre(d, ano, { regime = 'competencia' } = {}, hoje = hojeISO()) {
  exigir(['competencia', 'caixa'].includes(regime), 'Regime inválido.');
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const grupos = Object.fromEntries(GRUPOS.map((k) => [k, { valores: zeros(), cats: new Map() }]));
  const lancar = (p, data, valor) => {
    if (!valor || data < inicio || data > fim) return;
    const g = grupos[p.grupo_dre || (p.tipo === 'receita' ? 'receita_bruta' : 'despesas_operacionais')];
    const v = valor * (p.tipo === 'receita' ? 1 : -1);
    g.valores[idxMes(data)] += v;
    const nome = p.categoria_nome || 'Sem categoria';
    if (!g.cats.has(nome)) g.cats.set(nome, zeros());
    g.cats.get(nome)[idxMes(data)] += v;
  };
  if (regime === 'caixa') for (const m of movimentos(d, hoje)) lancar(m.parcela, m.data, m.valor_cents);
  else for (const p of expandir(d, hoje)) lancar(p, p.competencia, p.valor_cents);

  const somar = (...arrs) => zeros().map((_, i) => arrs.reduce((s, a) => s + a[i], 0));
  const pct = (a, b) => a.map((v, i) => (b[i] ? (v / b[i]) * 100 : null)); // margens sobre a receita bruta
  const v = (k) => grupos[k].valores;
  const liquida = somar(v('receita_bruta'), v('deducoes'));
  const bruto = somar(liquida, v('custos_operacionais'));
  const operacional = somar(bruto, v('despesas_operacionais'));
  const liquido = somar(operacional, v('financeiras'), v('nao_operacionais'));
  const total = (vals) => vals.reduce((a, b) => a + (b || 0), 0);
  const linha = (chave, nome, valores) => ({ chave, nome, tipo: 'subtotal', valores, total: total(valores) });
  const grupo = (k, nome) => ({ chave: k, nome, tipo: 'grupo', valores: v(k), total: total(v(k)),
    categorias: [...grupos[k].cats].map(([n, vals]) => ({ nome: n, valores: vals, total: total(vals) })) });
  const margem = (chave, nome, vals) => ({ chave, nome, tipo: 'margem', valores: vals, total: null });
  const rec = v('receita_bruta');
  return { ano, regime, linhas: [
    grupo('receita_bruta', 'Receita operacional bruta'), grupo('deducoes', 'Deduções da receita bruta'),
    linha('receita_liquida', 'Receita líquida de vendas', liquida), grupo('custos_operacionais', 'Custos operacionais'),
    linha('resultado_bruto', 'Resultado bruto', bruto), margem('margem_bruta', 'Margem bruta', pct(bruto, rec)),
    grupo('despesas_operacionais', 'Despesas operacionais'),
    linha('resultado_operacional', 'Resultado operacional', operacional), margem('margem_operacional', 'Margem operacional', pct(operacional, rec)),
    grupo('financeiras', 'Receitas e despesas financeiras'), grupo('nao_operacionais', 'Outras receitas e despesas não operacionais'),
    linha('resultado_liquido', 'Resultado líquido', liquido), margem('margem_liquida', 'Margem líquida', pct(liquido, rec)),
  ] };
}

export function resultadosGerais(d, f = {}, hoje = hojeISO()) {
  const { de, ate } = limitesPeriodo(f);
  const meses = new Map(mesesEntre(de, ate).map((m) => [m, 0]));
  let rec = 0, desp = 0, qr = 0, qd = 0;
  const conta = (tipo, valor, data) => {
    const s = tipo === 'receita' ? 1 : -1;
    if (s > 0) rec += valor; else desp += valor;
    const m = mesDe(data);
    if (meses.has(m)) meses.set(m, meses.get(m) + s * valor);
  };
  if (f.campo === 'pagamento') {
    const vistos = new Set();
    for (const m of movimentos(d, hoje).filter((x) => x.data >= de && x.data <= ate)) {
      conta(m.parcela.tipo, m.valor_cents, m.data);
      if (!vistos.has(m.parcela.id)) { vistos.add(m.parcela.id); if (m.parcela.tipo === 'receita') qr++; else qd++; }
    }
  } else {
    for (const p of carregarParcelas(d, { de, ate, campo: f.campo }, hoje).filter((x) => x.valor_pago_cents)) {
      conta(p.tipo, p.valor_pago_cents, f.campo === 'competencia' ? p.competencia : p.vencimento);
      if (p.tipo === 'receita') qr++; else qd++;
    }
  }
  return { periodo: { de, ate }, receitas: { valor: rec, qtd: qr }, despesas: { valor: desp, qtd: qd },
    resultado: { valor: rec - desp, qtd: qr + qd }, grafico: [...meses].map(([mes, valor]) => ({ mes, valor })) };
}

// Resultado por projeto (contrato). previsto=true usa só o que ainda falta pagar.
export function resultadosPorProjeto(d, f = {}, hoje = hojeISO()) {
  const { de, ate } = limitesPeriodo(f);
  const previsto = f.previsto === true || f.previsto === 'true';
  const proj = new Map();
  const somarEm = (p, valor) => {
    if (!p.contrato_id || !valor) return;
    if (!proj.has(p.contrato_id)) {
      proj.set(p.contrato_id, { id: p.contrato_id, projeto: `${p.contrato_codigo} - ${p.contrato_nome}`,
        cliente: d.mapa.pessoas.get(d.mapa.contratos.get(p.contrato_id)?.pessoa_id)?.nome ?? null, receitas_cents: 0, despesas_cents: 0 });
    }
    proj.get(p.contrato_id)[p.tipo === 'receita' ? 'receitas_cents' : 'despesas_cents'] += valor;
  };
  if (previsto) for (const p of carregarParcelas(d, { de, ate }, hoje)) somarEm(p, p.aberto_cents);
  else for (const m of movimentos(d, hoje).filter((x) => x.data >= de && x.data <= ate)) somarEm(m.parcela, m.valor_cents);
  const itens = [...proj.values()].map((x) => ({ ...x, resultado_cents: x.receitas_cents - x.despesas_cents })).sort((a, b) => a.projeto.localeCompare(b.projeto));
  const receitas = soma(itens, (x) => x.receitas_cents);
  const despesas = soma(itens, (x) => x.despesas_cents);
  return { periodo: { de, ate }, previsto, receitas_cents: receitas, despesas_cents: despesas, resultado_cents: receitas - despesas, itens };
}

// "Outros relatórios": total por cliente, fornecedor, categoria, centro de custo ou projeto.
export function outrosRelatorios(d, f = {}, hoje = hojeISO()) {
  const agrupar = f.agrupar || 'cliente';
  exigir(['cliente', 'fornecedor', 'categoria', 'centro_custo', 'projeto'].includes(agrupar), 'Agrupamento inválido.');
  const { de, ate } = limitesPeriodo(f);
  let rows = carregarParcelas(d, { tipo: f.tipo || 'receita', campo: f.campo || 'competencia', de, ate }, hoje);
  if (f.status) rows = rows.filter((p) => (f.status === 'em_aberto' ? p.status !== 'pago' : p.status === f.status));
  const chave = {
    cliente: (p) => [p.pessoa_id, p.pessoa_nome], fornecedor: (p) => [p.pessoa_id, p.pessoa_nome],
    categoria: (p) => [p.categoria_id, p.categoria_nome], centro_custo: (p) => [p.centro_custo_id, p.centro_custo_nome],
    projeto: (p) => [p.contrato_id, p.contrato_codigo && `${p.contrato_codigo} - ${p.contrato_nome}`],
  }[agrupar];
  const grupos = new Map();
  for (const p of rows) {
    const [id, nome] = chave(p);
    const k = id || 0;
    if (!grupos.has(k)) grupos.set(k, { id: k, nome: nome || '(sem informação)', valor_cents: 0, pago_cents: 0, aberto_cents: 0, qtd: 0 });
    const g = grupos.get(k);
    g.valor_cents += p.valor_cents; g.pago_cents += p.valor_pago_cents; g.aberto_cents += p.aberto_cents; g.qtd++;
  }
  const itens = [...grupos.values()].sort((a, b) => b.valor_cents - a.valor_cents);
  const tot = (k) => soma(itens, (x) => x[k]);
  return { periodo: { de, ate }, agrupar, itens,
    total: { valor_cents: tot('valor_cents'), pago_cents: tot('pago_cents'), aberto_cents: tot('aberto_cents'), qtd: tot('qtd') } };
}

// ---------- cadastros ----------

const ENUMS = { tipo_pessoa: ['cliente', 'fornecedor', 'ambos'], status_contrato: ['ativo', 'concluido', 'cancelado'] };
const CAMPOS = {
  contas: ['nome', 'banco', 'saldo_inicial_cents', 'ativa'], categorias: ['nome', 'tipo', 'grupo_dre', 'pai_id'], centros: ['nome'],
  pessoas: ['codigo', 'nome', 'tipo', 'natureza', 'data_nascimento', 'documento', 'rg', 'email', 'telefone', 'consumidor_final_nfse',
    'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'observacoes'],
  servicos: ['nome', 'descricao', 'valor_padrao_cents', 'categoria_id', 'ativo'],
  contratos: ['codigo', 'nome', 'pessoa_id', 'valor_total_cents', 'competencia', 'status', 'area_m2', 'servicos', 'obra'],
};
const CAMPOS_ENDERECO = ['cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado'];
const mesmoCodigo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const TIPOS_CADASTRO = Object.keys(CAMPOS);

export function validarCadastro(d, tipo, b, existente = null) {
  exigir(CAMPOS[tipo], 'Cadastro desconhecido.', 404);
  const r = {};
  for (const c of CAMPOS[tipo]) r[c] = b[c] === '' || b[c] === undefined ? (existente?.[c] ?? null) : b[c];
  exigir(texto(r.nome), 'Informe o nome.');
  r.nome = texto(r.nome);
  if (tipo === 'categorias') {
    // Subcategoria: herda tipo e grupo da DRE da categoria principal (só há um nível).
    r.pai_id = r.pai_id || null;
    if (r.pai_id) {
      const pai = achar(d, 'categorias', r.pai_id, 'Categoria principal não encontrada.');
      exigir(!pai.pai_id, 'Só existe um nível de subcategoria.');
      exigir(pai.id !== existente?.id, 'Uma categoria não pode ser subcategoria de si mesma.');
      exigir(!existente || !d.categorias.some((c) => c.pai_id === existente.id), 'Esta categoria tem subcategorias e não pode virar subcategoria.');
      r.tipo = pai.tipo; r.grupo_dre = pai.grupo_dre;
    }
    exigir(!d.categorias.some((c) => c.id !== existente?.id && (c.pai_id || null) === r.pai_id && String(c.nome).toLowerCase() === r.nome.toLowerCase()), 'Já existe uma categoria com este nome aqui.', 409);
    exigir(['receita', 'despesa'].includes(r.tipo), 'Tipo deve ser receita ou despesa.');
    exigir(GRUPOS.includes(r.grupo_dre), 'Grupo da DRE inválido.');
    exigir(!(r.tipo === 'despesa' && GRUPOS_SO_RECEITA.includes(r.grupo_dre)), 'Despesa não pode ficar em receita bruta.');
    exigir(!(r.tipo === 'receita' && GRUPOS_SO_DESPESA.includes(r.grupo_dre)), 'Receita não pode ficar em custos, despesas ou deduções.');
  }
  if (tipo === 'contas') {
    r.saldo_inicial_cents = r.saldo_inicial_cents ?? 0;
    exigir(Number.isInteger(r.saldo_inicial_cents), 'Saldo inicial inválido.');
    r.ativa = r.ativa === false || r.ativa === 0 ? 0 : 1;
  }
  if (tipo === 'pessoas') {
    r.tipo = r.tipo || 'cliente';
    exigir(ENUMS.tipo_pessoa.includes(r.tipo), 'Tipo de pessoa inválido.');
    r.natureza = r.natureza || (String(r.documento || '').replace(/\D/g, '').length === 14 ? 'juridica' : 'fisica');
    exigir(['fisica', 'juridica'].includes(r.natureza), 'Tipo de pessoa (física ou jurídica) inválido.');
    if (r.documento) {
      const dig = String(r.documento).replace(/\D/g, '');
      exigir(dig.length === (r.natureza === 'fisica' ? 11 : 14), r.natureza === 'fisica' ? 'CPF deve ter 11 dígitos.' : 'CNPJ deve ter 14 dígitos.');
    }
    if (r.data_nascimento) exigir(ehISO(r.data_nascimento), 'Data de nascimento inválida.');
    if (r.consumidor_final_nfse !== null && r.consumidor_final_nfse !== undefined) r.consumidor_final_nfse = r.consumidor_final_nfse === true || r.consumidor_final_nfse === 'sim';
    if (r.estado) { r.estado = texto(r.estado).toUpperCase(); exigir(/^[A-Z]{2}$/.test(r.estado), 'Estado inválido (use a sigla, ex.: SP).'); }
    if (r.codigo) {
      r.codigo = texto(r.codigo).toUpperCase();
      exigir(!d.pessoas.some((x) => x.id !== existente?.id && x.codigo && mesmoCodigo(x.codigo, r.codigo)), 'Já existe um cliente com este código.', 409);
    }
  }
  if (tipo === 'servicos') {
    r.valor_padrao_cents = r.valor_padrao_cents ?? 0;
    exigir(Number.isInteger(r.valor_padrao_cents) && r.valor_padrao_cents >= 0, 'Valor padrão inválido.');
    if (r.categoria_id) achar(d, 'categorias', r.categoria_id, 'Categoria não encontrada.');
    r.ativo = r.ativo === false || r.ativo === 0 ? 0 : 1;
  }
  if (tipo === 'contratos') {
    exigir(texto(r.codigo), 'Informe o código do projeto.');
    r.codigo = texto(r.codigo);
    r.status = r.status || 'ativo';
    exigir(ENUMS.status_contrato.includes(r.status), 'Status inválido.');
    r.valor_total_cents = r.valor_total_cents ?? 0;
    exigir(Number.isInteger(r.valor_total_cents) && r.valor_total_cents >= 0, 'Valor do contrato inválido.');
    exigir(!d.contratos.some((x) => x.id !== existente?.id && mesmoCodigo(x.codigo, r.codigo)), 'Já existe um projeto com este código.', 409);
    if (r.pessoa_id) achar(d, 'pessoas', r.pessoa_id, 'Cliente não encontrado.');
    if (r.competencia) exigir(ehISO(r.competencia), 'Data de competência inválida.');
    const ob = r.obra && typeof r.obra === 'object' ? r.obra : {};
    const obra = Object.fromEntries(CAMPOS_ENDERECO.map((k) => [k, texto(ob[k]) || null]));
    if (obra.estado) obra.estado = obra.estado.toUpperCase();
    r.obra = Object.values(obra).some(Boolean) ? obra : null;
    if (r.area_m2 !== null && r.area_m2 !== undefined) {
      r.area_m2 = Number(r.area_m2);
      exigir(Number.isFinite(r.area_m2) && r.area_m2 >= 0, 'Área inválida.');
    }
    r.servicos = (Array.isArray(r.servicos) ? r.servicos : []).map((s) => {
      exigir(texto(s?.nome), 'Informe o nome do serviço.');
      exigir(Number.isInteger(s.valor_cents) && s.valor_cents >= 0, 'Valor do serviço inválido.');
      if (s.servico_id) achar(d, 'servicos', s.servico_id, 'Serviço não encontrado.');
      const item = { servico_id: s.servico_id || null, nome: texto(s.nome), valor_cents: s.valor_cents };
      // plano de recebimento do serviço: parcelas, primeiro vencimento e a receita gerada a partir dele
      if (s.parcelas !== undefined && s.parcelas !== null) { exigir(Number.isInteger(s.parcelas) && s.parcelas >= 1 && s.parcelas <= 360, 'Parcelas do serviço devem ficar entre 1 e 360.'); item.parcelas = s.parcelas; }
      if (s.primeiro_vencimento) { exigir(ehISO(s.primeiro_vencimento), 'Primeiro vencimento do serviço inválido.'); item.primeiro_vencimento = s.primeiro_vencimento; }
      if (s.lancamento_id) item.lancamento_id = String(s.lancamento_id);
      return item;
    });
    if (r.servicos.length) r.valor_total_cents = soma(r.servicos, (s) => s.valor_cents);
  }
  return r;
}

export function emUso(d, tipo, id) {
  const usa = (campo) => d.lancamentos.some((l) => l[campo] === id);
  if (tipo === 'categorias') return usa('categoria_id') || d.servicos.some((s) => s.categoria_id === id) || d.categorias.some((c) => c.pai_id === id);
  if (tipo === 'centros') return usa('centro_custo_id');
  if (tipo === 'pessoas') return usa('pessoa_id') || d.contratos.some((c) => c.pessoa_id === id);
  if (tipo === 'contratos') return usa('contrato_id');
  if (tipo === 'servicos') return d.contratos.some((c) => (c.servicos || []).some((s) => s.servico_id === id));
  if (tipo === 'contas') {
    return usa('conta_id') || d.transferencias.some((t) => t.conta_origem_id === id || t.conta_destino_id === id)
      || d.lancamentos.some((l) => l.parcelas.some((p) => (p.pagamentos || []).some((x) => x.conta_id === id)));
  }
  return false;
}

// ---------- clientes ----------

const ehCliente = (p) => p.tipo === 'cliente' || p.tipo === 'ambos';

// Um registro por cliente: contato, projetos com os serviços contratados e a situação financeira.
export function clientes(d, f = {}, hoje = hojeISO()) {
  const receitas = Map.groupBy(expandir(d, hoje).filter((p) => p.tipo === 'receita' && p.pessoa_id), (p) => p.pessoa_id);
  const busca = (f.busca || '').toLowerCase();
  const itens = d.pessoas.filter(ehCliente).map((pe) => {
    const projetos = d.contratos.filter((c) => c.pessoa_id === pe.id).sort((a, b) => b.codigo.localeCompare(a.codigo)).map((c) => ({
      id: c.id, codigo: c.codigo, nome: c.nome, status: c.status, competencia: c.competencia, area_m2: c.area_m2 ?? null,
      valor_total_cents: c.valor_total_cents, servicos: c.servicos || [], obra: c.obra ?? null,
    }));
    const ps = receitas.get(pe.id) || [];
    const ativos = projetos.filter((p) => p.status !== 'cancelado');
    return {
      id: pe.id, codigo: pe.codigo ?? null, nome: pe.nome, tipo: pe.tipo, documento: pe.documento, email: pe.email, telefone: pe.telefone,
      natureza: pe.natureza ?? 'fisica', data_nascimento: pe.data_nascimento, rg: pe.rg, consumidor_final_nfse: pe.consumidor_final_nfse ?? null,
      cep: pe.cep, endereco: pe.endereco, numero: pe.numero, complemento: pe.complemento, bairro: pe.bairro, cidade: pe.cidade, estado: pe.estado, observacoes: pe.observacoes, criado_em: pe.criado_em ?? null, projetos,
      servicos: [...new Set(ativos.flatMap((p) => p.servicos.map((s) => s.nome)))],
      contratado_cents: soma(ativos, (p) => p.valor_total_cents),
      lancado_cents: soma(ps, (p) => p.valor_cents), pago_cents: soma(ps, (p) => p.valor_pago_cents),
      aberto_cents: soma(ps.filter((p) => p.status !== 'vencido'), (p) => p.aberto_cents),
      vencido_cents: soma(ps.filter((p) => p.status === 'vencido'), (p) => p.aberto_cents),
    };
  }).filter((c) => !busca || `${c.codigo || ''} ${c.nome} ${c.documento || ''} ${c.email || ''} ${c.projetos.map((p) => `${p.codigo} ${p.nome}`).join(' ')} ${c.servicos.join(' ')}`.toLowerCase().includes(busca))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return { itens, total: { qtd: itens.length, contratado_cents: soma(itens, (c) => c.contratado_cents), pago_cents: soma(itens, (c) => c.pago_cents),
    aberto_cents: soma(itens, (c) => c.aberto_cents), vencido_cents: soma(itens, (c) => c.vencido_cents), lancado_cents: soma(itens, (c) => c.lancado_cents) } };
}

// Próximos códigos livres: cliente CLI-0001, projeto CA + AAMM + sequência (ex.: CA261001).
export function sugestoesCodigo(d, hoje = hojeISO()) {
  const maior = (lista, re) => lista.reduce((m, c) => { const x = re.exec(c || ''); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  const cliente = `CLI-${String(maior(d.pessoas.map((p) => p.codigo), /^CLI-(\d+)$/i) + 1).padStart(4, '0')}`;
  const pref = `CA${hoje.slice(2, 4)}${hoje.slice(5, 7)}`;
  const projeto = `${pref}${String(maior(d.contratos.map((c) => c.codigo), new RegExp(`^${pref}(\\d+)$`, 'i')) + 1).padStart(2, '0')}`;
  return { cliente, projeto };
}

// ---------- a receber: quem ainda deve, o que vence e o impacto no caixa ----------

const diasEntre = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / 864e5);
const somaDias = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

export function aReceber(d, f = {}, hoje = hojeISO()) {
  const abertas = (tipo) => expandir(d, hoje).filter((p) => p.tipo === tipo && p.aberto_cents > 0);
  const rec = abertas('receita').map((p) => ({ ...p, dias_atraso: p.vencimento < hoje ? diasEntre(p.vencimento, hoje) : 0 }));
  const faixa = (de, ate) => rec.filter((p) => p.dias_atraso >= de && p.dias_atraso <= ate);
  const tot = (l) => ({ qtd: l.length, valor_cents: soma(l, (p) => p.aberto_cents) });
  const em = (dias) => rec.filter((p) => p.vencimento >= hoje && p.vencimento <= somaDias(hoje, dias));
  const porPessoa = Map.groupBy(rec, (p) => p.pessoa_id || '');
  const busca = (f.busca || '').toLowerCase();
  const clientesLista = [...porPessoa].map(([pid, ps]) => {
    const pe = d.mapa.pessoas.get(pid);
    const venc = ps.filter((p) => p.status === 'vencido');
    const prox = ps.filter((p) => p.status !== 'vencido');
    return { pessoa_id: pid || null, nome: pe?.nome ?? 'Sem cliente informado', codigo: pe?.codigo ?? null, telefone: pe?.telefone ?? null, email: pe?.email ?? null,
      vencido_cents: soma(venc, (p) => p.aberto_cents), a_vencer_cents: soma(prox, (p) => p.aberto_cents), total_cents: soma(ps, (p) => p.aberto_cents),
      max_atraso_dias: Math.max(0, ...venc.map((p) => p.dias_atraso)), proximo_vencimento: prox[0]?.vencimento ?? null,
      ultimo_contato: d.contatos.filter((x) => x.pessoa_id === pid).reduce((m, x) => (!m || x.data > m.data || (x.data === m.data && x.criado_em > m.criado_em) ? x : m), null),
      parcelas: ps.map((p) => ({ id: p.id, nome: p.nome, vencimento: p.vencimento, aberto_cents: p.aberto_cents, valor_cents: p.valor_cents, status: p.status,
        dias_atraso: p.dias_atraso, contrato_codigo: p.contrato_codigo, conta_id: p.conta_id, tipo: 'receita' })) };
  }).filter((c) => !busca || `${c.nome} ${c.codigo || ''} ${c.parcelas.map((p) => `${p.nome} ${p.contrato_codigo || ''}`).join(' ')}`.toLowerCase().includes(busca))
    .sort((a, b) => b.max_atraso_dias - a.max_atraso_dias || (a.proximo_vencimento || '9').localeCompare(b.proximo_vencimento || '9') || a.nome.localeCompare(b.nome));
  // próximos vencimentos em ordem de data (a agenda de cobrança)
  const agenda = rec.filter((p) => p.status !== 'vencido').slice(0, 40).map((p) => ({ id: p.id, nome: p.nome, vencimento: p.vencimento, aberto_cents: p.aberto_cents,
    pessoa_nome: p.pessoa_nome, status: p.status }));
  // compensação: caixa hoje + o que deve entrar − o que deve sair, nos próximos 30 dias
  const desp = abertas('despesa');
  const pagar = (dias) => desp.filter((p) => p.vencimento <= somaDias(hoje, dias));
  const saldo = soma(saldoContas(d, null, hoje), (c) => c.saldo_cents);
  const projecao = [7, 15, 30].map((dias) => {
    const entra = soma(em(dias), (p) => p.aberto_cents), sai = soma(pagar(dias), (p) => p.aberto_cents);
    return { dias, entra_cents: entra, sai_cents: sai, saldo_projetado_cents: saldo + entra - sai };
  });
  return {
    hoje,
    totais: { vencido: tot(rec.filter((p) => p.status === 'vencido')), vence_hoje: tot(rec.filter((p) => p.status === 'vence_hoje')),
      proximos_7: tot(em(7)), proximos_30: tot(em(30)), em_aberto: tot(rec), clientes_em_atraso: clientesLista.filter((c) => c.vencido_cents > 0).length },
    aging: [['1 a 30 dias', 1, 30], ['31 a 60 dias', 31, 60], ['61 a 90 dias', 61, 90], ['Mais de 90 dias', 91, 99999]].map(([rotulo, a, b]) => ({ rotulo, ...tot(faixa(a, b)) })),
    clientes: clientesLista, agenda,
    caixa: { saldo_cents: saldo, vencido_pagar_cents: soma(desp.filter((p) => p.status === 'vencido'), (p) => p.aberto_cents), projecao },
  };
}

// ---------- fluxos: contatos de cobrança, conferência das contas e entrega do relatório ----------

export const CANAIS_CONTATO = ['whatsapp', 'telefone', 'email', 'presencial', 'outro'];
const dataOu = (v, hoje, msg) => { const x = v || hoje; exigir(ehISO(x), msg); return x; };

export function criarContato(d, i, agora = new Date().toISOString(), hoje = hojeISO()) {
  achar(d, 'pessoas', i.pessoa_id, 'Cliente não encontrado.');
  const canal = i.canal || 'whatsapp';
  exigir(CANAIS_CONTATO.includes(canal), 'Canal de contato inválido.');
  exigir(texto(i.resposta), 'Anote a resposta do cliente ou o combinado.');
  return { id: novoId(), pessoa_id: i.pessoa_id, data: dataOu(i.data, hoje, 'Data do contato inválida.'), canal, resposta: texto(i.resposta).slice(0, 500),
    parcela_id: i.parcela_id || null, criado_em: agora };
}
// Confere o saldo do aplicativo com o do extrato. Se há diferença, a explicação é obrigatória.
export function criarConferencia(d, i, agora = new Date().toISOString(), hoje = hojeISO()) {
  achar(d, 'contas', i.conta_id, 'Conta não encontrada.');
  exigir(Number.isInteger(i.saldo_banco_cents), 'Informe o saldo do extrato do banco.');
  const data = dataOu(i.data, hoje, 'Data da conferência inválida.');
  const app = saldoContas(d, data, hoje).find((c) => c.id === i.conta_id)?.saldo_cents ?? 0;
  const diferenca = i.saldo_banco_cents - app;
  exigir(diferenca === 0 || texto(i.observacao), 'Há diferença entre o aplicativo e o extrato. Explique o motivo.');
  return { id: novoId(), conta_id: i.conta_id, data, saldo_banco_cents: i.saldo_banco_cents, saldo_app_cents: app, diferenca_cents: diferenca,
    observacao: texto(i.observacao).slice(0, 500) || null, criado_em: agora };
}
export function criarEntrega(d, i, agora = new Date().toISOString(), hoje = hojeISO()) {
  return { id: novoId(), tipo: 'relatorio_quinzenal', data: dataOu(i.data, hoje, 'Data da entrega inválida.'), observacao: texto(i.observacao).slice(0, 500) || null, criado_em: agora };
}

const diasDesde = (iso, hoje) => Math.round((Date.parse(hoje) - Date.parse(iso)) / 864e5);
const ultimo = (lista) => lista.reduce((m, x) => (!m || x.data > m.data ? x : m), null);

// Os nove passos do fluxo do financeiro, cada um com o que fica pendente hoje.
export function fluxos(d, hoje = hojeISO()) {
  const parcelas = expandir(d, hoje);
  const rec = parcelas.filter((p) => p.tipo === 'receita');
  const clientesLista = d.pessoas.filter(ehCliente);
  const ativos = d.contratos.filter((c) => c.status === 'ativo');
  const nomeCli = (id) => d.mapa.pessoas.get(id)?.nome ?? 'Sem cliente';
  const em7 = new Date(Date.parse(hoje) + 7 * 864e5).toISOString().slice(0, 10);
  const comLanc = new Set(d.lancamentos.filter((l) => l.tipo === 'receita' && l.contrato_id).map((l) => l.contrato_id));
  const contatos = Map.groupBy(d.contatos, (c) => c.pessoa_id);
  const emAtraso = [...Map.groupBy(rec.filter((p) => p.status === 'vencido' && p.pessoa_id), (p) => p.pessoa_id)].map(([pid]) => pid);
  const semContato = emAtraso.filter((pid) => { const u = ultimo(contatos.get(pid) || []); return !u || diasDesde(u.data, hoje) > 7; });
  const recebSemComp = rec.flatMap((p) => p.pagamentos.filter((x) => !x.comprovante && diasDesde(x.data, hoje) <= 15).map(() => p));
  const despVenc = parcelas.filter((p) => p.tipo === 'despesa' && p.status === 'vencido');
  const confs = Map.groupBy(d.conferencias, (c) => c.conta_id);
  const contasAtivas = d.contas.filter((c) => c.ativa !== 0 && c.ativa !== false);
  const semConf = contasAtivas.filter((c) => { const u = ultimo(confs.get(c.id) || []); return !u || diasDesde(u.data, hoje) > 7; });
  const ultEntrega = ultimo(d.entregas);
  const entregaAtrasada = !ultEntrega || diasDesde(ultEntrega.data, hoje) > 15;

  const passo = (n, chave, nome, entrega, onde, quando, itens, extra = {}) =>
    ({ n, chave, nome, entrega, onde, quando, pendencias: itens.length, itens: itens.slice(0, 8), ...extra });
  const passos = [
    passo(1, 'cadastro', 'Cadastro do cliente', 'Cliente com código, CPF ou CNPJ, contato, endereço do cliente e da obra.', { rota: 'clientes', rotulo: 'Clientes' }, 'No dia do fechamento',
      clientesLista.filter((c) => !c.documento || !c.telefone || !(c.endereco && c.cidade)).map((c) => `${c.nome}: falta ${[!c.documento && 'CPF/CNPJ', !c.telefone && 'telefone', !(c.endereco && c.cidade) && 'endereço'].filter(Boolean).join(', ')}`)),
    passo(2, 'projeto', 'Projeto e serviços', 'Projeto com código CA, área em m², competência e serviços contratados com valor.', { rota: 'clientes', rotulo: 'Clientes' }, 'Antes da primeira cobrança',
      ativos.filter((c) => !(c.servicos || []).length || !c.area_m2).map((c) => `${c.codigo} ${c.nome}: falta ${[!(c.servicos || []).length && 'serviços', !c.area_m2 && 'área'].filter(Boolean).join(' e ')}`)),
    passo(3, 'receita', 'Receita e parcelas', 'Receita ligada ao cliente e ao projeto, com parcelas, categoria e conta de recebimento.', { rota: 'receitas', rotulo: 'Receitas' }, 'Junto com o contrato assinado',
      ativos.filter((c) => c.valor_total_cents > 0 && !comLanc.has(c.id)).map((c) => `${c.codigo} ${c.nome}: sem receita lançada`)),
    passo(4, 'cobranca', 'Cobrança', 'Boleto ou Pix emitido no banco e enviado ao cliente; nota fiscal anotada no lançamento.', { rota: 'receitas', rotulo: 'Receitas' }, 'Antes do vencimento',
      [...rec.filter((p) => p.aberto_cents > 0 && p.vencimento >= hoje && p.vencimento <= em7 && !p.nota_fiscal && !d.notas.some((n) => n.lancamento_id === p.lancamento_id)).map((p) => `${p.nome}: vence ${p.vencimento.split('-').reverse().join('/')} sem nota fiscal`),
        ...d.notas.filter((n) => n.status === 'a_emitir').map((n) => `${n.descricao_servico}: nota fiscal pedida pelo cliente e ainda não emitida`)]),
    passo(5, 'acompanhamento', 'Acompanhamento diário', 'Vencidos e vencimentos da semana conferidos; contato com cada cliente em atraso registrado.', { rota: 'areceber', rotulo: 'A receber' }, 'Todo dia útil',
      semContato.map((pid) => `${nomeCli(pid)}: em atraso sem contato registrado nos últimos 7 dias`),
      { ultimo: ultimo(d.contatos)?.data ?? null, ultimo_rotulo: 'Último contato registrado' }),
    passo(6, 'baixa', 'Baixa', 'Recebimento baixado com data, valor e conta; comprovante salvo na pasta do cliente.', { rota: 'areceber', rotulo: 'A receber' }, 'No dia em que o valor cai',
      recebSemComp.map((p) => `${p.nome}: recebimento sem comprovante`)),
    passo(7, 'despesas', 'Despesas e transferências', 'Despesas lançadas com categoria e fornecedor; transferências entre contas registradas.', { rota: 'despesas', rotulo: 'Despesas' }, 'No dia do pagamento',
      despVenc.map((p) => `${p.nome}: venceu ${p.vencimento.split('-').reverse().join('/')} e continua em aberto`)),
    passo(8, 'conciliacao', 'Conciliação', 'Saldo de cada conta conferido com o extrato do banco; diferenças explicadas.', { rota: 'contas', rotulo: 'Contas e extratos' }, 'Toda semana',
      semConf.map((c) => `${c.nome}: sem conferência com o extrato nos últimos 7 dias`),
      { ultimo: ultimo(d.conferencias)?.data ?? null, ultimo_rotulo: 'Última conferência' }),
    passo(9, 'relatorio', 'Relatório quinzenal', 'Fluxo de caixa, DRE e resultados conferidos; atrasos e compensação no caixa entregues ao diretor.', { rota: 'fluxo', rotulo: 'Fluxo de caixa' }, 'A cada 15 dias',
      entregaAtrasada ? [ultEntrega ? `Último relatório entregue há ${diasDesde(ultEntrega.data, hoje)} dias` : 'Nenhum relatório quinzenal registrado ainda'] : [],
      { ultimo: ultEntrega?.data ?? null, ultimo_rotulo: 'Última entrega' }),
  ];
  const emDia = passos.filter((p) => p.pendencias === 0).length;
  return { hoje, passos, em_dia: emDia, total: passos.length, pendencias: soma(passos, (p) => p.pendencias),
    contas: contasAtivas.map((c) => ({ id: c.id, nome: c.nome })) };
}

// ---------- painel do diretor: crescimento, caixa dos próximos 12 meses, contratos parcelados e atrasos ----------

const mesMais = (aaaamm, n) => { const [a, m] = aaaamm.split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const variacao = (atual, anterior) => (anterior > 0 ? ((atual - anterior) / anterior) * 100 : null);

export function painel(d, hoje = hojeISO()) {
  const ano = Number(hoje.slice(0, 4)), mesAtual = hoje.slice(0, 7), mm = Number(hoje.slice(5, 7)) - 1;
  const movs = movimentos(d, hoje), parcelas = expandir(d, hoje);
  const recMov = movs.filter((m) => m.parcela.tipo === 'receita'), despMov = movs.filter((m) => m.parcela.tipo === 'despesa');
  const noMes = (lista, mes) => soma(lista.filter((m) => m.data.slice(0, 7) === mes), (m) => m.valor_cents);

  // últimos 12 meses (realizado)
  const meses12 = Array.from({ length: 12 }, (_, i) => mesMais(mesAtual, i - 11));
  const evolucao = meses12.map((mes) => ({ mes, recebido_cents: noMes(recMov, mes), pago_cents: noMes(despMov, mes) }));

  // crescimento
  const recMes = noMes(recMov, mesAtual), recMesAnt = noMes(recMov, mesMais(mesAtual, -1));
  const ateDia = (lista, de, ate) => soma(lista.filter((m) => m.data >= de && m.data <= ate), (m) => m.valor_cents);
  const recYtd = ateDia(recMov, `${ano}-01-01`, hoje), recYtdAnt = ateDia(recMov, `${ano - 1}-01-01`, `${ano - 1}${hoje.slice(4)}`);
  const trimestre = (fim) => soma([0, 1, 2].map((i) => noMes(recMov, mesMais(fim, -i))), (x) => x);
  const rec3 = trimestre(mesAtual), rec3Ant = trimestre(mesMais(mesAtual, -3));

  // DRE: competência × caixa no ano
  const linhaDre = (r, chave) => r.linhas.find((l) => l.chave === chave);
  const dreC = dre(d, ano, { regime: 'competencia' }, hoje), dreX = dre(d, ano, { regime: 'caixa' }, hoje);
  const recBrutaC = linhaDre(dreC, 'receita_bruta').total, recBrutaX = linhaDre(dreX, 'receita_bruta').total;
  const opC = linhaDre(dreC, 'resultado_operacional').total, opX = linhaDre(dreX, 'resultado_operacional').total;
  const recBrutaAnt = soma(linhaDre(dre(d, ano - 1, { regime: 'competencia' }, hoje), 'receita_bruta').valores.slice(0, mm + 1), (v) => v);
  const recBrutaYtd = soma(linhaDre(dreC, 'receita_bruta').valores.slice(0, mm + 1), (v) => v);

  // entradas e saídas previstas nos próximos 12 meses (a partir do mês atual); o que já venceu fica à parte
  const proximos = Array.from({ length: 12 }, (_, i) => mesMais(mesAtual, i));
  const abertas = (tipo) => parcelas.filter((p) => p.tipo === tipo && p.aberto_cents > 0);
  const recAb = abertas('receita'), despAb = abertas('despesa');
  const atrasadoRec = soma(recAb.filter((p) => p.vencimento < hoje), (p) => p.aberto_cents);
  const atrasadoDesp = soma(despAb.filter((p) => p.vencimento < hoje), (p) => p.aberto_cents);
  const saldo = soma(saldoContas(d, null, hoje), (c) => c.saldo_cents);
  let acum = saldo, acumCom = saldo + atrasadoRec - atrasadoDesp;
  const previsao = proximos.map((mes) => {
    const entra = soma(recAb.filter((p) => p.vencimento >= hoje && p.vencimento.slice(0, 7) === mes), (p) => p.aberto_cents);
    const sai = soma(despAb.filter((p) => p.vencimento >= hoje && p.vencimento.slice(0, 7) === mes), (p) => p.aberto_cents);
    acum += entra - sai; acumCom += entra - sai;
    return { mes, entra_cents: entra, sai_cents: sai, saldo_cents: acum, saldo_com_atrasados_cents: acumCom };
  });

  // contratos parcelados em andamento: quantas parcelas faltam, quanto falta e quem está atrasado
  const parcelados = d.lancamentos.filter((l) => l.tipo === 'receita' && !l.recorrente && l.parcelas.length > 1).map((l) => {
    const ps = parcelas.filter((p) => p.lancamento_id === l.id);
    const pagas = ps.filter((p) => p.aberto_cents === 0).length;
    const abertasL = ps.filter((p) => p.aberto_cents > 0);
    const venc = abertasL.filter((p) => p.vencimento < hoje);
    const prox = abertasL.find((p) => p.vencimento >= hoje);
    const ct = d.mapa.contratos.get(l.contrato_id);
    return { lancamento_id: l.id, nome: l.nome, cliente: d.mapa.pessoas.get(l.pessoa_id)?.nome ?? null, cliente_id: l.pessoa_id || null,
      projeto: ct ? `${ct.codigo} ${ct.nome}` : null, total_parcelas: ps.length, pagas, faltam: abertasL.length,
      total_cents: soma(ps, (p) => p.valor_cents), recebido_cents: soma(ps, (p) => p.valor_pago_cents), falta_cents: soma(abertasL, (p) => p.aberto_cents),
      atrasadas: venc.length, atrasado_cents: soma(venc, (p) => p.aberto_cents), proxima: prox ? { vencimento: prox.vencimento, valor_cents: prox.aberto_cents } : null,
      ultima_vencimento: ps.at(-1)?.vencimento ?? null };
  }).filter((c) => c.faltam > 0).sort((a, b) => b.atrasado_cents - a.atrasado_cents || b.falta_cents - a.falta_cents);

  // quem cobrar e quem mais vai pagar
  const ar = aReceber(d, {}, hoje);
  const cobrar = ar.clientes.filter((c) => c.vencido_cents > 0).slice(0, 6).map((c) => ({ pessoa_id: c.pessoa_id, nome: c.nome, vencido_cents: c.vencido_cents, max_atraso_dias: c.max_atraso_dias, telefone: c.telefone }));
  const porCliente = new Map();
  for (const p of recAb.filter((x) => x.vencimento >= hoje && x.vencimento.slice(0, 7) <= proximos[11])) {
    const k = p.pessoa_nome || 'Sem cliente';
    porCliente.set(k, (porCliente.get(k) || 0) + p.aberto_cents);
  }
  const carteira = [...porCliente].map(([nome, valor_cents]) => ({ nome, valor_cents })).sort((a, b) => b.valor_cents - a.valor_cents);

  return {
    hoje, evolucao,
    crescimento: {
      mes: { atual_cents: recMes, anterior_cents: recMesAnt, variacao_pct: variacao(recMes, recMesAnt) },
      ano_recebido: { atual_cents: recYtd, anterior_cents: recYtdAnt, variacao_pct: variacao(recYtd, recYtdAnt) },
      ano_receita: { atual_cents: recBrutaYtd, anterior_cents: recBrutaAnt, variacao_pct: variacao(recBrutaYtd, recBrutaAnt) },
      trimestre: { atual_cents: rec3, anterior_cents: rec3Ant, variacao_pct: variacao(rec3, rec3Ant) },
    },
    dre: { ano, receita_competencia_cents: recBrutaC, receita_caixa_cents: recBrutaX, a_receber_cents: recBrutaC - recBrutaX,
      resultado_competencia_cents: opC, resultado_caixa_cents: opX,
      margem_competencia_pct: recBrutaC ? (opC / recBrutaC) * 100 : null, margem_caixa_pct: recBrutaX ? (opX / recBrutaX) * 100 : null },
    inadimplencia: { vencido_cents: ar.totais.vencido.valor_cents, em_aberto_cents: ar.totais.em_aberto.valor_cents, clientes: ar.totais.clientes_em_atraso,
      pct: ar.totais.em_aberto.valor_cents ? (ar.totais.vencido.valor_cents / ar.totais.em_aberto.valor_cents) * 100 : 0 },
    previsao: { saldo_atual_cents: saldo, atrasado_receber_cents: atrasadoRec, atrasado_pagar_cents: atrasadoDesp, meses: previsao,
      total_entradas_cents: soma(previsao, (m) => m.entra_cents) },
    parcelados: parcelados.slice(0, 12), parcelados_total: parcelados.length, cobrar, carteira,
  };
}

// ---------- anexos (comprovantes e notas fiscais), recibos, notas fiscais e busca ----------

export const TIPOS_ANEXO = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'text/xml': 'xml', 'application/xml': 'xml' };
export const LIMITE_ANEXO_BYTES = 3 * 1024 * 1024;
export const CATEGORIAS_ANEXO = ['comprovante', 'nota_fiscal', 'recibo', 'contrato', 'outro'];
const VINCULOS = { parcela: null, lancamento: 'lancamentos', pessoa: 'pessoas', contrato: 'contratos', nota: 'notas' };

// Lê número, valor, data e partes de uma NF-e ou NFS-e em XML. Devolve só o que encontrar.
export function extrairNotaXml(xml) {
  const texto1 = (...tags) => { for (const t of tags) { const m = new RegExp(`<(?:\\w+:)?${t}[^>]*>([^<]{1,200})</(?:\\w+:)?${t}>`, 'i').exec(xml); if (m) return m[1].trim(); } return null; };
  const dentro = (pai, ...tags) => { const m = new RegExp(`<(?:\\w+:)?${pai}[^>]*>([\\s\\S]{0,2000}?)</(?:\\w+:)?${pai}>`, 'i').exec(xml); if (!m) return null; const sub = m[1]; for (const t of tags) { const r = new RegExp(`<(?:\\w+:)?${t}[^>]*>([^<]{1,200})</(?:\\w+:)?${t}>`, 'i').exec(sub); if (r) return r[1].trim(); } return null; };
  const valor = texto1('vNF', 'ValorLiquidoNfse', 'ValorServicos', 'vServ', 'vLiq');
  const cents = valor && /^\d+(\.\d{1,2})?$/.test(valor) ? Math.round(Number(valor) * 100) : null;
  const dataBruta = texto1('dhEmi', 'DataEmissao', 'dEmi', 'dhProc');
  const chave = texto1('chNFe') || (/Id="NFe(\d{44})"/.exec(xml) || [])[1] || null;
  const out = {
    numero: texto1('nNF', 'NumeroNfse', 'Numero', 'nNFSe'), valor_cents: cents, data_emissao: dataBruta && /^\d{4}-\d{2}-\d{2}/.test(dataBruta) ? dataBruta.slice(0, 10) : null,
    emitente: dentro('emit', 'xNome') || dentro('PrestadorServico', 'RazaoSocial') || dentro('prest', 'xNome'),
    tomador: dentro('dest', 'xNome') || dentro('TomadorServico', 'RazaoSocial') || dentro('toma', 'xNome'), chave,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null && v !== ''));
}

// Valida o anexo e devolve { meta, bytes }. Os bytes ficam fora da lista de registros (arquivos/<id>).
export function prepararAnexo(d, i, agora = new Date().toISOString()) {
  const nome = texto(i.nome).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
  exigir(nome, 'Informe o nome do arquivo.');
  const mime = String(i.tipo || '').toLowerCase();
  exigir(TIPOS_ANEXO[mime], 'Tipo de arquivo não aceito. Use PDF, imagem (PNG, JPG, WEBP) ou XML.');
  exigir(typeof i.dados === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(i.dados), 'Arquivo inválido.');
  const bytes = Buffer.from(i.dados, 'base64');
  exigir(bytes.length > 0, 'O arquivo está vazio.');
  exigir(bytes.length <= LIMITE_ANEXO_BYTES, 'O arquivo passa de 3 MB. Reduza o tamanho e tente de novo.', 413);
  const categoria = i.categoria || 'outro';
  exigir(CATEGORIAS_ANEXO.includes(categoria), 'Categoria do anexo inválida.');
  const v = i.vinculo || {};
  exigir(Object.hasOwn(VINCULOS, v.tipo), 'Informe a que o anexo pertence.');
  let lancamento_id = null;
  if (v.tipo === 'parcela') { const [lid] = String(v.id).split(':'); achar(d, 'lancamentos', lid, 'Lançamento não encontrado.'); lancamento_id = lid; } else achar(d, VINCULOS[v.tipo], v.id, 'Registro do anexo não encontrado.');
  if (v.tipo === 'lancamento') lancamento_id = v.id;
  const meta = { id: novoId(), nome, mime, tamanho: bytes.length, categoria, descricao: texto(i.descricao).slice(0, 300) || null, vinculo: { tipo: v.tipo, id: String(v.id) }, lancamento_id, criado_em: agora };
  if (TIPOS_ANEXO[mime] === 'xml') { const x = extrairNotaXml(bytes.toString('utf8')); if (Object.keys(x).length) meta.extraido = x; }
  return { meta, bytes };
}

// ----- recibos -----
export function criarRecibo(d, i, agora = new Date().toISOString(), hoje = hojeISO()) {
  const p = expandir(d, hoje).find((x) => x.id === i.parcela_id);
  exigir(p, 'Parcela não encontrada.', 404);
  exigir(p.tipo === 'receita', 'Recibo só pode ser emitido para receitas.');
  exigir(p.pagamentos.length > 0, 'Registre o recebimento antes de emitir o recibo.');
  const idx = i.indice_pagamento === undefined || i.indice_pagamento === null ? p.pagamentos.length - 1 : Number(i.indice_pagamento);
  const pg = p.pagamentos[idx];
  exigir(pg, 'Recebimento não encontrado.', 404);
  const existente = d.recibos.find((r) => r.parcela_id === p.id && r.indice_pagamento === idx);
  if (existente) return { recibo: existente, novo: false };
  const pe = d.mapa.pessoas.get(p.pessoa_id);
  const n = d.recibos.reduce((m, r) => Math.max(m, Number(String(r.numero).replace(/\D/g, '')) || 0), 0) + 1;
  const recibo = { id: novoId(), numero: `REC-${String(n).padStart(4, '0')}`, parcela_id: p.id, indice_pagamento: idx, pessoa_id: p.pessoa_id || null,
    pessoa_nome: pe?.nome ?? null, pessoa_documento: pe?.documento ?? null, valor_cents: pg.valor_cents, data: pg.data, descricao: p.nome,
    conta_nome: d.mapa.contas.get(pg.conta_id)?.nome ?? null, forma: texto(i.forma).slice(0, 40) || null, observacao: texto(i.observacao).slice(0, 300) || null, criado_em: agora };
  return { recibo, novo: true };
}

// ----- notas fiscais (preparação da emissão e registro da nota emitida) -----
export function criarNota(d, i, agora = new Date().toISOString(), hoje = hojeISO()) {
  const l = achar(d, 'lancamentos', i.lancamento_id, 'Lançamento não encontrado.');
  exigir(l.tipo === 'receita', 'Nota fiscal de serviço só se aplica a receitas.');
  const valor = i.valor_cents ?? soma(l.parcelas, (p) => p.valor_cents);
  exigir(inteiroPos(valor), 'Informe o valor da nota.');
  const comp = i.competencia || l.competencia || hoje;
  exigir(ehISO(comp), 'Competência inválida.');
  return { id: novoId(), tipo: 'nfse', status: 'a_emitir', lancamento_id: l.id, parcela_id: i.parcela_id || null, pessoa_id: l.pessoa_id || null, valor_cents: valor,
    competencia: comp, descricao_servico: texto(i.descricao_servico) || l.nome, numero: null, data_emissao: null, anexo_id: null, observacao: texto(i.observacao).slice(0, 300) || null, criado_em: agora };
}
export function atualizarNota(d, existente, i) {
  const n = { ...existente };
  for (const k of ['descricao_servico', 'observacao']) if (i[k] !== undefined) n[k] = texto(i[k]) || (k === 'descricao_servico' ? n[k] : null);
  if (i.valor_cents !== undefined) { exigir(inteiroPos(i.valor_cents), 'Valor inválido.'); n.valor_cents = i.valor_cents; }
  if (i.status !== undefined) { exigir(['a_emitir', 'emitida'].includes(i.status), 'Situação inválida.'); n.status = i.status; }
  if (i.numero !== undefined) n.numero = texto(i.numero) || null;
  if (i.data_emissao !== undefined) { exigir(!i.data_emissao || ehISO(i.data_emissao), 'Data de emissão inválida.'); n.data_emissao = i.data_emissao || null; }
  if (i.anexo_id !== undefined) { if (i.anexo_id) achar(d, 'anexos', i.anexo_id, 'Anexo não encontrado.'); n.anexo_id = i.anexo_id || null; }
  if (n.status === 'emitida') { exigir(n.numero, 'Informe o número da nota emitida.'); n.data_emissao = n.data_emissao || hojeISO(); } else { n.numero = n.numero ?? null; }
  return n;
}

// ----- editar o lançamento inteiro -----
export function editarLancamento(d, id, i) {
  const original = achar(d, 'lancamentos', id, 'Lançamento não encontrado.');
  const l = structuredClone(original);
  if (i.nome !== undefined) { exigir(texto(i.nome), 'Informe o nome do lançamento.'); l.nome = texto(i.nome); }
  if (i.categoria_id !== undefined) {
    if (i.categoria_id) { const cat = achar(d, 'categorias', i.categoria_id, 'Categoria não encontrada.'); exigir(cat.tipo === l.tipo, `Esta categoria é de ${cat.tipo}, não de ${l.tipo}.`); }
    l.categoria_id = i.categoria_id || null;
  }
  for (const [campo, colecao, msg] of [['pessoa_id', 'pessoas', 'Cliente/fornecedor não encontrado.'], ['centro_custo_id', 'centros', 'Centro de custo não encontrado.'], ['contrato_id', 'contratos', 'Projeto não encontrado.'], ['conta_id', 'contas', 'Conta não encontrada.']]) {
    if (i[campo] !== undefined) { if (i[campo]) achar(d, colecao, i[campo], msg); l[campo] = i[campo] || null; }
  }
  for (const k of ['nota_fiscal', 'etiquetas', 'observacao']) if (i[k] !== undefined) l[k] = texto(i[k]) || null;
  if (i.nf_solicitada !== undefined) l.nf_solicitada = !!i.nf_solicitada;
  if (i.competencia) {
    exigir(ehISO(i.competencia), 'Competência inválida.');
    l.competencia = i.competencia;
    if (!l.recorrente) for (const p of l.parcelas) p.competencia = i.competencia;
  }
  return l;
}

// ----- busca em tudo -----
export function buscar(d, q, hoje = hojeISO()) {
  const termo = String(q || '').trim().toLowerCase();
  exigir(termo.length >= 2, 'Digite pelo menos 2 letras para buscar.');
  const tem = (...partes) => partes.filter(Boolean).join(' ').toLowerCase().includes(termo);
  const limite = (l) => l.slice(0, 8);
  const clientesAch = d.pessoas.filter((p) => tem(p.codigo, p.nome, p.documento, p.email, p.telefone, p.cidade, p.endereco, p.bairro, p.rg));
  const projetos = d.contratos.filter((c) => tem(c.codigo, c.nome, (c.servicos || []).map((s) => s.nome).join(' '), c.obra?.endereco, c.obra?.cidade));
  const lanc = d.lancamentos.filter((l) => tem(l.nome, l.nota_fiscal, l.etiquetas, l.observacao, d.mapa.pessoas.get(l.pessoa_id)?.nome, d.mapa.contratos.get(l.contrato_id)?.codigo, caminhoCategoria(d, d.mapa.categorias.get(l.categoria_id))));
  const anexos = d.anexos.filter((a) => tem(a.nome, a.descricao, a.categoria, a.extraido?.numero, a.extraido?.emitente, a.extraido?.tomador, a.extraido?.chave));
  const recibos = d.recibos.filter((r) => tem(r.numero, r.pessoa_nome, r.descricao, r.observacao));
  const notas = d.notas.filter((n) => tem(n.numero, n.descricao_servico, d.mapa.pessoas.get(n.pessoa_id)?.nome, n.observacao));
  const rotuloLanc = (l) => `${d.mapa.pessoas.get(l.pessoa_id)?.nome ?? 'Sem pessoa'} · ${l.tipo === 'receita' ? 'Receita' : 'Despesa'} · ${brlTxt(soma(l.parcelas, (p) => p.valor_cents))}`;
  return {
    termo,
    clientes: limite(clientesAch).map((p) => ({ id: p.id, titulo: p.nome, sub: [p.codigo, p.documento, p.telefone].filter(Boolean).join(' · '), rota: 'clientes', busca: p.nome })),
    projetos: limite(projetos).map((c) => ({ id: c.id, titulo: `${c.codigo} · ${c.nome}`, sub: d.mapa.pessoas.get(c.pessoa_id)?.nome ?? '', rota: 'clientes', busca: c.codigo })),
    lancamentos: limite(lanc).map((l) => ({ id: l.id, titulo: l.nome, sub: rotuloLanc(l), rota: l.tipo === 'receita' ? 'receitas' : 'despesas', busca: l.nome })),
    anexos: limite(anexos).map((a) => ({ id: a.id, titulo: a.nome, sub: [a.categoria.replace('_', ' '), a.extraido?.numero && `nota ${a.extraido.numero}`, a.descricao].filter(Boolean).join(' · '), rota: 'documentos', busca: a.nome, arquivo: true })),
    recibos: limite(recibos).map((r) => ({ id: r.id, titulo: `${r.numero} · ${r.pessoa_nome ?? 'Cliente'}`, sub: `${r.descricao} · ${brlTxt(r.valor_cents)}`, rota: 'documentos', busca: r.numero, recibo: true })),
    notas: limite(notas).map((n) => ({ id: n.id, titulo: n.numero ? `NFS-e ${n.numero}` : 'NFS-e a emitir', sub: `${n.descricao_servico} · ${brlTxt(n.valor_cents)}`, rota: 'notas', busca: n.numero || n.descricao_servico })),
  };
}
const brlTxt = (c) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
