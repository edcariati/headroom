'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, obraAdm, dia, mesAtras } = require('./helpers');

const atual = (e, sel) => Array.from(e.doc.querySelectorAll(sel + ' [aria-current="page"]')).map((a) => a.textContent).join('|');

/* ---------------- passo 0: navegação agrupada ---------------- */
test('fase 5 · passo 0 · grupos da obra e subabas', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/resumo' });
  const grupos = Array.from(e.doc.querySelectorAll('nav.grupos a')).map((a) => a.textContent);
  assert.equal(grupos.join(' · '), 'Visão geral · Planejamento · Execução e qualidade · Suprimentos · Prestadores · Custo e financeiro · Gestão');
  assert.equal(atual(e, 'nav.grupos'), 'Visão geral');
});

test('fase 5 · passo 0 · URLs antigas abrem a aba certa e destacam o grupo e a subaba', async () => {
  const casos = [['cronograma', 'Planejamento', 'Cronograma'], ['ocorrencias', 'Execução e qualidade', 'Ocorrências'], ['compras', 'Suprimentos', 'Compras'], ['contratos', 'Prestadores', ''], ['medicao', 'Custo e financeiro', 'Medição'], ['fisfin', 'Custo e financeiro', 'Físico-financeiro'], ['documentos', 'Gestão', 'Documentos'], ['entrega', 'Execução e qualidade', 'Pré-entrega']];
  const e = await abrir({ seed: { obras: { o1: obraAdm() } }, hash: '#/obra/o1/resumo' });
  for (const [aba, grupo, sub] of casos) {
    await e.go('#/obra/o1/' + aba);
    assert.equal(atual(e, 'nav.grupos'), grupo, aba);
    assert.equal(atual(e, 'nav.sub'), sub, aba);
  }
});

test('fase 5 · passo 0 · aba desconhecida cai no resumo e o grupo sem subabas não mostra segunda barra', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/nao-existe' });
  assert.equal(atual(e, 'nav.grupos'), 'Visão geral');
  assert.equal(e.doc.querySelector('nav.sub'), null);
  assert.match(e.app(), /Indicadores/);
});

test('fase 5 · passo 0 · cada grupo leva à primeira subaba', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/resumo' });
  const hrefs = Array.from(e.doc.querySelectorAll('nav.grupos a')).map((a) => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['#/obra/o1/resumo', '#/obra/o1/etapas', '#/obra/o1/diario', '#/obra/o1/compras', '#/obra/o1/contratos', '#/obra/o1/orcamento', '#/obra/o1/agenda']);
});

/* ---------------- passo 1: empresas, empresa na obra e contrato do cliente ---------------- */
test('fase 5 · passo 1 · a página DRE cria as duas empresas do grupo, editáveis', async () => {
  const e = await abrir({ hash: '#/dre' });
  const es = e.linhas('empresas');
  assert.equal(es.length, 2);
  assert.deepEqual(es.map((x) => x.nome).sort(), ['Cariati Arquitetura Ltda', 'Cariati Construtora Ltda']);
  assert.match(e.app(), /Sem alíquota/);
  await e.click('[data-act="emp-editar"][data-id="emp_cons"]');
  await e.submit({ nome: 'Cariati Construtora Ltda', cnpj: '12.345.678/0001-90', aliquotaImpostos: '6', criterioRateio: 'igual', rateioManual: '', ativa: 'sim' });
  const c = e.linhas('empresas').find((x) => x.id === 'emp_cons');
  assert.equal(c.aliquotaImpostos, 6);
  assert.equal(c.criterioRateio, 'igual');
  await e.click('[data-act="emp-nova"]');
  await e.submit({ nome: 'Cariati Projetos Ltda', aliquotaImpostos: '', criterioRateio: 'receita', rateioManual: '', ativa: 'sim' });
  assert.equal(e.linhas('empresas').length, 3);
  await e.click('[data-act="emp-ativar"][data-id="emp_arq"]');
  assert.equal(e.linhas('empresas').find((x) => x.id === 'emp_arq').ativa, false);
  assert.match(e.app(), /Inativa/);
});

test('fase 5 · passo 1 · rateio manual exige percentuais que somem 100', async () => {
  const seed = { obras: { o1: obra({ nome: 'Casa A', empresaId: 'emp_cons' }), o2: obra({ nome: 'Casa B', empresaId: 'emp_cons' }) }, empresas: { emp_cons: { nome: 'Construtora', ativa: true, criterioRateio: 'receita', rateioManual: {} } } };
  const e = await abrir({ seed, hash: '#/dre' });
  await e.click('[data-act="emp-editar"][data-id="emp_cons"]');
  await e.submit({ nome: 'Construtora', criterioRateio: 'manual', rateioManual: 'Casa A; 60\nCasa B; 30', ativa: 'sim' });
  assert.match(e.erroForm(), /somam 90%/);
  await e.submit({ rateioManual: 'Casa A; 60\nCasa B; 40' });
  const c = e.linhas('empresas')[0];
  assert.equal(c.rateioManual.o1, 60);
  assert.equal(c.rateioManual.o2, 40);
});

test('fase 5 · passo 1 · a obra guarda a empresa escolhida', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/resumo' });
  await e.click('[data-act="obra-editar"]');
  const ops = Array.from(e.doc.querySelectorAll('[name="empresaId"] option')).map((o) => o.textContent);
  assert.deepEqual(ops, ['Sem empresa', 'Cariati Arquitetura Ltda', 'Cariati Construtora Ltda']);
  await e.submit({ nome: 'Casa Teste', empresaId: 'emp_cons' });
  assert.equal(e.linhas('obras')[0].empresaId, 'emp_cons');
});

test('fase 5 · passo 1 · contrato do cliente de valor fixo mensal: receita prevista entre início e fim', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm({ empresaId: 'emp_cons' }) } }, hash: '#/obra/o1/dre' });
  assert.match(e.app(), /Sem contrato do cliente/);
  await e.click('[data-act="cc-editar"]');
  await e.submit({ tipoRemuneracao: 'fixo_mensal', valorMensal: '5000', percentual: '', parcelas: '', inicio: '2026-08-10', fim: '2026-10-20', obs: '' });
  const c = e.linhas('contratosCliente')[0];
  assert.equal(c.tipoRemuneracao, 'fixo_mensal');
  assert.equal(c.valorMensal, 5000);
  const o = e.x.G('obras', 'o1');
  assert.equal(e.x.receitaPrevista(o, '2026-07'), 0);
  assert.equal(e.x.receitaPrevista(o, '2026-08'), 5000);
  assert.equal(e.x.receitaPrevista(o, '2026-10'), 5000);
  assert.equal(e.x.receitaPrevista(o, '2026-11'), 0);
  assert.match(e.app(), /agosto de 2026.*R\$\s*5\.000,00/);
});

test('fase 5 · passo 1 · contrato por parcelas: receita só nas competências informadas', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm() } }, hash: '#/obra/o1/dre' });
  await e.click('[data-act="cc-editar"]');
  await e.submit({ tipoRemuneracao: 'parcelas', parcelas: '2026-09; 4.500,00\n2026-12; 2500' });
  const o = e.x.G('obras', 'o1');
  assert.equal(e.x.receitaPrevista(o, '2026-09'), 4500);
  assert.equal(e.x.receitaPrevista(o, '2026-10'), 0);
  assert.equal(e.x.receitaPrevista(o, '2026-12'), 2500);
  await e.click('[data-act="cc-editar"]');
  await e.submit({ tipoRemuneracao: 'parcelas', parcelas: '09/2026; 100' });
  assert.match(e.erroForm(), /deve ser AAAA-MM/);
});

test('fase 5 · passo 1 · percentual do custo usa o apropriado do mês e só vale na Administração', async () => {
  const compra = { obraId: 'o1', item: 'Concreto', un: 'm³', qtd: 1, etapa: 5, status: 'conferido', pedido: { data: dia(0), fornecedorId: 'f1', total: 3000, entregaPrevista: dia(0) }, conf: { data: dia(0), resultado: 'conferido' }, cotacoes: [], criadoEm: new Date().toISOString() };
  const e = await abrir({ seed: { obras: { o1: obraAdm() }, compras: { c1: compra } }, hash: '#/obra/o1/dre' });
  await e.click('[data-act="cc-editar"]');
  await e.submit({ tipoRemuneracao: 'percentual_custo', percentual: '10' });
  const o = e.x.G('obras', 'o1');
  assert.equal(e.x.receitaPrevista(o, dia(0).slice(0, 7)), 300);
  assert.equal(e.x.receitaPrevista(o, mesAtras(3)), 0);
  const g = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/dre' });
  await g.click('[data-act="cc-editar"]');
  await g.submit({ tipoRemuneracao: 'percentual_custo', percentual: '10' });
  assert.match(g.erroForm(), /só existe na Administração/);
  assert.equal(g.linhas('contratosCliente').length, 0);
});

test('fase 5 · passo 1 · validações do contrato do cliente e escape de texto', async () => {
  const xss = '<img src=x onerror="window.__xss=8">';
  const e = await abrir({ seed: { obras: { o1: obraAdm() }, empresas: { emp1: { nome: xss, cnpj: xss, ativa: true, criterioRateio: 'receita' } } }, hash: '#/obra/o1/dre' });
  await e.click('[data-act="cc-editar"]');
  await e.submit({ tipoRemuneracao: 'fixo_mensal', valorMensal: '', inicio: '', fim: '' });
  assert.match(e.erroForm(), /valor mensal/);
  await e.submit({ valorMensal: '1000', inicio: '2026-10-01', fim: '2026-09-01' });
  assert.match(e.erroForm(), /fim não pode ser antes do início/);
  await e.submit({ inicio: '2026-09-01', fim: '2026-12-01', obs: xss });
  assert.equal(e.linhas('contratosCliente').length, 1);
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.go('#/dre');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});
