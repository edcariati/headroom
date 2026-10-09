// Importação de lançamentos vindos de planilhas de outro sistema (Receitas, Despesas e Pagamentos).
// Cada linha da planilha é uma parcela. Regras:
//  - parcelas repetidas entre as planilhas (mesmo "ID Parcela") entram uma única vez;
//  - ids determinísticos: rodar de novo não duplica nada;
//  - "Pago" vira pagamento realizado na data informada; "Aguardando" fica em aberto (previsto);
//  - cadastros que faltam (conta, categoria, cliente, fornecedor, projeto) são criados; os que já existem são reaproveitados.
import crypto from 'node:crypto';
import { criarDados, criarLancamento, GRUPOS } from './finance.js';

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const limpar = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const norm = (s) => limpar(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cents = (v) => Math.round(Number(v) * 100);
const iso = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(limpar(s));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Categorias da planilha → plano de contas do app. [id existente] ou [nome, grupo] para criar. Sub: id do pai.
const R = { arq: 'cat01', int: 'cat02', obra: 'cat03', reg: 'cat04', cons: 'cat05', outras: 'cat06' };
const RECEITAS = {
  'projetos arquitetonico': R.arq, 'projeto arquitetonico': R.arq, 'venda de servicos': R.arq, 'projeto arquitetonico e regularizacao': R.arq,
  'arquitetonico interiores e regularizacao': R.arq, 'estudo de viabilidade': R.arq, 'croqui esboco e 3d': R.arq,
  'projeto complementares e evf': R.arq, 'projeto complementares': R.arq, 'projeto complementares , decoracao de interior e evf': R.arq,
  'projeto decoracao de interiores': R.int, 'gestao de obra': R.obra, 'mensalidade obra': R.obra,
  'regularizacao de imovel': R.reg, 'habite-se': R.reg, 'projeto aprovacao de bombeiro e licenciamento ambiental': R.reg,
  'vistoria e aprovacao de projetos condominio': R.reg, 'acompanhamento de processo': R.reg, 'assinatura de documentos': R.reg,
  'consultoria tecnica': R.cons, 'hora de trabalho': R.cons,
  'acordos': R.outras, 'pls': R.outras, 'unificacao': R.outras, 'plotagem': R.outras,
};
const A = 'cat25'; // Automóvel
const DESPESAS = {
  'terceirizacao de servicos': 'cat11', 'simples nacional - das': 'cat09', 'iss prefeitura tatui': 'cat09', 'iss sobre faturamento': 'cat09',
  'salarios': 'cat14', 'remuneracao de estagiarios': 'cat14', 'ferias': 'cat14',
  'fgts e multa de fgts': 'cat15', 'inss sobre pro-labore - gps': 'cat15', 'seguro de vida': 'cat15', 'uniformes': 'cat15',
  'aluguel': 'cat16', 'agua e saneamento': 'cat17', 'energia eletrica': 'cat17', 'telefonia e internet': 'cat17', 'celular': 'cat17',
  'software / licenca de uso': 'cat18', 'marketing e publicidade': 'cat19', 'brindes para clientes': 'cat19', 'honorarios contabeis': 'cat20',
  'materiais de escritorio': 'cat21', 'materiais de limpeza e de higiene': 'cat21', 'faxina': 'cat21',
  'almoco / jantar': 'cat22', 'lanches e refeicoes': 'cat22', 'copa e cozinha': 'cat22', 'mercado': 'cat22', 'confraternizacoes': 'cat22', 'viagens e representacoes': 'cat22',
  'combustiveis': 'cat26', 'estacionamento': 'cat27', 'pedagios': 'cat28', 'manutencao de veiculos': 'cat29', 'veiculo / lavagem': 'cat30',
  'ipva / dpvat / licenciamento': A, 'multas de transito': A,
  'negociacoes': 'cat24', 'reembolso': 'cat24',
  'emprestimos de outras instituicoes': ['Empréstimos e financiamentos', 'financeiras'], 'pronampe': ['Empréstimos e financiamentos', 'financeiras'],
  'financiamento automovel': ['Empréstimos e financiamentos', 'financeiras'],
  'comissoes': ['Comissões', 'custos_operacionais'], 'comissoes / projetos': ['Comissões', 'custos_operacionais'],
  'taxa prefeitura de tatui': ['Taxas e emolumentos', 'custos_operacionais'], 'taxa de cartorio': ['Taxas e emolumentos', 'custos_operacionais'],
  'manutencao predial': ['Manutenção e reformas do escritório', 'despesas_operacionais'], 'edificios e construcoes': ['Manutenção e reformas do escritório', 'despesas_operacionais'],
  'iptu': ['IPTU', 'despesas_operacionais'], 'honorarios advocaticios': ['Honorários advocatícios', 'despesas_operacionais'],
  'cursos e treinamentos': ['Cursos e treinamentos', 'despesas_operacionais'], 'anuidade cau/crea': ['Anuidades e taxas profissionais', 'despesas_operacionais'],
  'moveis, utensilios e instalacoes comerciais': ['Equipamentos e mobiliário', 'despesas_operacionais'],
  'maquinas, equipamentos e instalacoes industriais': ['Equipamentos e mobiliário', 'despesas_operacionais'],
  'equipamentos eletronicos': ['Equipamentos e mobiliário', 'despesas_operacionais'], 'manutencao de equipamentos': ['Equipamentos e mobiliário', 'despesas_operacionais'],
  'ferramentas': ['Equipamentos e mobiliário', 'despesas_operacionais'], 'chaveiro': ['Manutenção e reformas do escritório', 'despesas_operacionais'],
};
// Sem categoria na planilha: deduz pelo nome do lançamento.
function deduzir(tipo, nome) {
  const n = norm(nome);
  if (tipo === 'receita') {
    if (/decora|interior/.test(n)) return R.int;
    if (/gest|obra|mensalidade/.test(n)) return R.obra;
    if (/regulariz|habite|aprova|bombeiro|vistoria/.test(n)) return R.reg;
    if (/consultoria|visita/.test(n)) return R.cons;
    return R.arq;
  }
  if (/combust/.test(n)) return 'cat26';
  if (/almoco|cafe|lanche|padaria|restaurante/.test(n)) return 'cat22';
  return 'cat24';
}
export const CONTA_BASE = 'Banco base antigo';
const CENTROS = { 'projetos': 'cc3', 'gestao de obra': 'cc4' };

// Lê as linhas cruas (uma por parcela) e junta por lançamento.
function agrupar(linhas, avisos) {
  const porParcela = new Map();
  for (const r of linhas) {
    const id = limpar(r['ID Parcela']);
    if (!id) { avisos.push(`Linha sem "ID Parcela" ignorada (${limpar(r.Nome)}).`); continue; }
    const ant = porParcela.get(id);
    if (!ant || (limpar(ant['Status parcela']) !== 'Pago' && limpar(r['Status parcela']) === 'Pago')) porParcela.set(id, r);
  }
  const lancs = new Map();
  for (const r of porParcela.values()) {
    const k = limpar(r.ID);
    if (!lancs.has(k)) lancs.set(k, []);
    lancs.get(k).push(r);
  }
  return { porParcela, lancs };
}

export function montarImportacao(d, linhas, { agora = new Date().toISOString(), hoje = new Date().toISOString().slice(0, 10) } = {}) {
  const avisos = [];
  const { porParcela, lancs } = agrupar(linhas, avisos);
  const novos = { contas: [], categorias: [], centros: [], pessoas: [], contratos: [], lancamentos: [] };
  const dados = criarDados(Object.fromEntries(Object.keys(novos).map((c) => [c, d[c]]))); // cópia de trabalho
  const incluir = (col, obj) => { dados[col].push(obj); dados.mapa[col].set(obj.id, obj); novos[col].push(obj); return obj; };

  // Tudo o que foi pago entra numa conta única de base. O banco de origem fica anotado em cada pagamento,
  // para depois cadastrar as contas reais e redistribuir.
  const contaPor = () => {
    let c = dados.contas.find((x) => norm(x.nome) === norm(CONTA_BASE));
    if (!c) c = incluir('contas', { id: hash('conta:base-antiga'), nome: CONTA_BASE, banco: 'Importação das planilhas', saldo_inicial_cents: 0, ativa: 1 });
    return c;
  };
  const categoriaPor = (tipo, nomeCat, nomeLanc) => {
    const n = norm(nomeCat);
    const alvo = (tipo === 'receita' ? RECEITAS : DESPESAS)[n] ?? (n ? null : deduzir(tipo, nomeLanc));
    if (typeof alvo === 'string') return dados.mapa.categorias.get(alvo) || dados.categorias.find((c) => c.id === alvo);
    const [nome, grupo] = alvo || [limpar(nomeCat), tipo === 'receita' ? 'receita_bruta' : 'despesas_operacionais'];
    let c = dados.categorias.find((x) => !x.pai_id && x.tipo === tipo && norm(x.nome) === norm(nome));
    if (!c) {
      if (!GRUPOS.includes(grupo)) throw new Error(`Grupo inválido para ${nome}`);
      c = incluir('categorias', { id: hash(`categoria:${tipo}:${norm(nome)}`), nome, tipo, grupo_dre: grupo, pai_id: null });
    }
    return c;
  };
  const centroPor = (nome) => {
    const n = norm(nome);
    if (!n || n === '-') return null;
    const fixo = CENTROS[n] && dados.mapa.centros.get(CENTROS[n]);
    let c = fixo || dados.centros.find((x) => norm(x.nome) === n);
    if (!c) c = incluir('centros', { id: hash(`centro:${n}`), nome: limpar(nome) });
    return c;
  };
  const pessoaPor = (nome, tipo) => {
    const n = norm(nome);
    if (!n || n === '-') return null;
    let p = dados.pessoas.find((x) => norm(x.nome) === n);
    if (!p) {
      p = incluir('pessoas', { id: hash(`pessoa:${n}`), codigo: null, nome: limpar(nome), tipo, natureza: 'fisica', criado_em: agora });
    } else if (p.tipo !== tipo && p.tipo !== 'ambos') {
      p.tipo = 'ambos'; // já era do outro tipo: passa a ser os dois
      if (!novos.pessoas.includes(p)) novos.pessoas.push(p);
    }
    return p;
  };

  // Projetos: o código vem no começo do nome ("CA250102 Fulano"); sem código, usa o nome inteiro.
  const projetos = new Map();
  const projetoPor = (nome, pessoa) => {
    const bruto = limpar(nome);
    if (!bruto || bruto === '-' || /^teste/i.test(bruto)) return null;
    const m = /^([A-Z]{2}\d{6})\s*[-–]?\s*(.*)$/i.exec(bruto);
    const codigo = (m ? m[1] : bruto.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 40)).toUpperCase();
    let pr = projetos.get(codigo) || dados.contratos.find((x) => String(x.codigo).toLowerCase() === codigo.toLowerCase());
    if (!pr) {
      pr = incluir('contratos', { id: hash(`projeto:${codigo.toLowerCase()}`), codigo, nome: limpar(m ? m[2] : bruto) || codigo, pessoa_id: pessoa?.id ?? null,
        valor_total_cents: 0, competencia: null, status: 'ativo', area_m2: null, servicos: [], obra: null });
    }
    projetos.set(codigo, pr);
    if (!pr.pessoa_id && pessoa) pr.pessoa_id = pessoa.id;
    return pr;
  };

  const resumo = { parcelas_lidas: linhas.length, parcelas_unicas: porParcela.size, duplicadas_ignoradas: linhas.length - porParcela.size - 0,
    lancamentos_novos: 0, lancamentos_existentes: 0, parcelas_pagas: 0, parcelas_abertas: 0 };
  resumo.duplicadas_ignoradas = linhas.filter((r) => r['ID Parcela']).length - porParcela.size;
  const totais = { receita: { pago: 0, aberto: 0 }, despesa: { pago: 0, aberto: 0 } };

  for (const [idOrigem, itens] of lancs) {
    const id = hash(`lancamento:${idOrigem}`);
    if (d.mapa.lancamentos.has(id)) { resumo.lancamentos_existentes++; continue; }
    const r0 = itens[0];
    const tipo = limpar(r0.Tipo) === 'Despesa' ? 'despesa' : 'receita';
    const pessoa = pessoaPor(tipo === 'receita' ? r0.Cliente : r0.Fornecedor, tipo === 'receita' ? 'cliente' : 'fornecedor');
    const parcelas = itens.map((r, k) => {
      const m = /(\d+)\s*\/\s*(\d+)\s*$/.exec(limpar(r.Parcela));
      return { r, numero: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, venc: iso(r['Vencimento parcela']), valor: Math.abs(cents(r['Valor parcela'])), k };
    }).sort((a, b) => a.venc.localeCompare(b.venc));
    if (parcelas.some((p) => !p.venc || !(p.valor > 0))) { avisos.push(`Lançamento "${limpar(r0.Nome)}" ignorado: parcela com data ou valor inválido.`); continue; }
    const pagas = parcelas.filter((p) => limpar(p.r['Status parcela']) === 'Pago' && (iso(p.r['Data de pagamento parcela']) || p.venc) <= hoje);
    const contaDe = () => contaPor();
    const projeto = projetoPor(r0.Projeto, tipo === 'receita' ? pessoa : null);
    const cat = categoriaPor(tipo, r0['Categoria financeira'], r0.Nome);
    const centro = centroPor(r0['Centro de custo']);
    const total = parcelas.reduce((s, p) => s + p.valor, 0);
    const obs = [];
    const juros = parcelas.reduce((s, p) => s + (Number(p.r.Juros) || 0), 0);
    if (juros) obs.push(`Juros pagos: R$ ${juros.toFixed(2).replace('.', ',')}`);
    const comp = iso(r0['Data de competência']) || parcelas[0].venc;
    const l = criarLancamento(dados, {
      tipo, nome: limpar(r0.Nome), valor_total_cents: total, parcelas_detalhe: parcelas.map((p) => ({ vencimento: p.venc, valor_cents: p.valor })),
      competencia: comp, pessoa_id: pessoa?.id, categoria_id: cat?.id, centro_custo_id: centro?.id, contrato_id: projeto?.id,
      nota_fiscal: [...new Set(itens.map((r) => limpar(r['Notas fiscais'])).filter(Boolean))].join(', ').slice(0, 120) || null,
      observacao: ['Importado das planilhas', ...obs].join(' · '),
    }, agora);
    l.id = id;
    // Mantém o "3/10" original quando o número da parcela vem na planilha e não se repete.
    const nums = parcelas.map((p) => p.numero);
    const preservar = nums.every((n) => n) && new Set(nums).size === nums.length;
    parcelas.forEach((p, k) => {
      const pa = l.parcelas[k];
      if (preservar) { pa.numero = p.numero; pa.total = Math.max(p.total || 0, ...nums); }
      const dataPg = iso(p.r['Data de pagamento parcela']) || p.venc;
      if (limpar(p.r['Status parcela']) === 'Pago' && dataPg > hoje) {
        avisos.push(`"${limpar(r0.Nome)}" (${p.venc.split('-').reverse().join('/')}) consta como paga em ${dataPg.split('-').reverse().join('/')}, data no futuro: ficou em aberto para você conferir.`);
        totais[tipo].aberto += p.valor; resumo.parcelas_abertas++;
      } else if (limpar(p.r['Status parcela']) === 'Pago') {
        const data = dataPg;
        const pg = { data, valor_cents: p.valor, conta_id: contaDe().id };
        const origem = limpar(p.r['Conta bancária']), forma = limpar(p.r['Forma de pagamento parcela']);
        if (origem) pg.banco_origem = origem;
        if (forma) pg.forma = forma;
        pa.pagamentos.push(pg);
        totais[tipo].pago += p.valor; resumo.parcelas_pagas++;
      } else { totais[tipo].aberto += p.valor; resumo.parcelas_abertas++; }
    });
    if (pagas.length) l.conta_id = contaDe().id;
    if (projeto) {
      if (tipo === 'receita') projeto.valor_total_cents += total;
      projeto.competencia = !projeto.competencia || comp < projeto.competencia ? comp : projeto.competencia;
    }
    incluir('lancamentos', l);
    resumo.lancamentos_novos++;
  }
  return { novos, resumo: { ...resumo, totais, criados: Object.fromEntries(Object.entries(novos).map(([k, v]) => [k, v.length])) }, avisos };
}

// Grava tudo o que a importação criou (cadastros primeiro, lançamentos por último).
export async function gravarImportacao(store, novos) {
  const { gravar } = await import('./dados.js');
  for (const col of ['contas', 'categorias', 'centros', 'pessoas', 'contratos', 'lancamentos']) {
    for (let i = 0; i < novos[col].length; i += 24) await Promise.all(novos[col].slice(i, i + 24).map((x) => gravar(store, col, x)));
  }
}
