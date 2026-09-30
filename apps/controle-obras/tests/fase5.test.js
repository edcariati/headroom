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

/* ---------------- passo 2: lançamentos, sugestões, rateio e DRE por obra ---------------- */
const M = dia(0).slice(0, 7);
const mesAdd = (m, n) => { const p = m.split('-').map(Number), d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const mesAdd1 = mesAdd;
const lanc = (o) => Object.assign({ empresaId: 'emp1', obraId: 'oA', competencia: M, categoria: 'receita', subcategoria: '', valor: 0, descricao: '', origem: 'manual', anexos: [] }, o || {});
function seedDRE(over) {
  const s = {
    empresas: { emp1: { nome: 'Cariati Construtora Ltda', ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita', rateioManual: {} } },
    obras: { oA: obraAdm({ nome: 'Obra A', empresaId: 'emp1' }), oB: obraAdm({ nome: 'Obra B', empresaId: 'emp1' }) },
    lancamentos: {
      a1: lanc({ obraId: 'oA', categoria: 'receita', valor: 10000 }), a2: lanc({ obraId: 'oA', categoria: 'imposto', valor: 600 }), a3: lanc({ obraId: 'oA', categoria: 'custo_direto', valor: 3000 }),
      b1: lanc({ obraId: 'oB', categoria: 'receita', valor: 5000 }), b2: lanc({ obraId: 'oB', categoria: 'imposto', valor: 300 }), b3: lanc({ obraId: 'oB', categoria: 'custo_direto', valor: 1000 }),
      g1: lanc({ obraId: '', categoria: 'despesa_geral', valor: 1500, subcategoria: 'Aluguel do escritório' })
    }
  };
  return Object.assign(s, over || {});
}
const arred = (x) => Math.round(x * 1000) / 10;

test('fase 5 · passo 2 · caso do DRE fecha centavo a centavo (rateio por receita)', async () => {
  const e = await abrir({ seed: seedDRE() });
  const A = e.x.dreObra('oA', M, M), B = e.x.dreObra('oB', M, M);
  assert.equal(A.receita, 10000); assert.equal(A.impostos, 600); assert.equal(A.receitaLiquida, 9400);
  assert.equal(A.custos, 3000);   assert.equal(A.resultadoBruto, 6400);
  assert.equal(A.despesas, 1000); assert.equal(A.resultado, 5400);
  assert.equal(arred(A.margem), 57.4);
  assert.equal(B.receitaLiquida, 4700); assert.equal(B.resultadoBruto, 3700);
  assert.equal(B.despesas, 500);  assert.equal(B.resultado, 3200);
  assert.equal(arred(B.margem), 68.1);
  assert.equal(A.despesas + B.despesas, 1500);       // o rateio distribui tudo, sem sobra nem falta
});

test('fase 5 · passo 2 · a tela da obra mostra as linhas do DRE', async () => {
  const e = await abrir({ seed: seedDRE(), hash: '#/obra/oA/dre' });
  const t = e.app();
  assert.match(t, /Receita bruta.*R\$\s*10\.000,00/);
  assert.match(t, /Receita líquida.*R\$\s*9\.400,00/);
  assert.match(t, /Resultado do período.*R\$\s*5\.400,00/);
  assert.match(t, /Margem líquida.*57,4%/);
  assert.match(t, /Informação restrita à diretoria/);
  assert.match(t, /confirmado com o contador/);
});

test('fase 5 · passo 2 · critérios de rateio: igual, manual e receita sem base', async () => {
  const emp = (extra) => ({ emp1: Object.assign({ nome: 'Construtora', ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita', rateioManual: {} }, extra) });
  const igual = await abrir({ seed: seedDRE({ empresas: emp({ criterioRateio: 'igual' }) }) });
  assert.equal(igual.x.dreObra('oA', M, M).despesas, 750);
  assert.equal(igual.x.dreObra('oB', M, M).despesas, 750);
  const man = await abrir({ seed: seedDRE({ empresas: emp({ criterioRateio: 'manual', rateioManual: { oA: 70, oB: 30 } }) }) });
  assert.equal(man.x.dreObra('oA', M, M).despesas, 1050);
  assert.equal(man.x.dreObra('oB', M, M).despesas, 450);
  const semReceita = seedDRE(); delete semReceita.lancamentos.a1; delete semReceita.lancamentos.b1;
  const sr = await abrir({ seed: semReceita });
  assert.equal(sr.x.dreObra('oA', M, M).despesas, 750);        // sem receita no mês: partes iguais
  const impar = await abrir({ seed: seedDRE({ empresas: emp({ criterioRateio: 'igual' }), lancamentos: Object.assign({}, seedDRE().lancamentos, { g1: lanc({ obraId: '', categoria: 'despesa_geral', valor: 100 })}), obras: { oA: obraAdm({ empresaId: 'emp1' }), oB: obraAdm({ empresaId: 'emp1' }), oC: obraAdm({ empresaId: 'emp1' }) } }) });
  const tot = ['oA', 'oB', 'oC'].reduce((s, k) => s + impar.x.dreObra(k, M, M).despesas, 0);
  assert.equal(Math.round(tot * 100) / 100, 100);              // 33,34 + 33,33 + 33,33: os centavos não se perdem
});

test('fase 5 · passo 2 · despesa geral só é rateada entre as obras da própria empresa', async () => {
  const seed = seedDRE({ obras: { oA: obraAdm({ nome: 'Obra A', empresaId: 'emp1' }), oB: obraAdm({ nome: 'Obra B', empresaId: 'emp1' }), oX: obraAdm({ nome: 'Outra empresa', empresaId: 'emp2' }) }, empresas: { emp1: { nome: 'C1', ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita' }, emp2: { nome: 'C2', ativa: true, criterioRateio: 'igual' } } });
  const e = await abrir({ seed });
  assert.equal(e.x.dreObra('oX', M, M).despesas, 0);
  assert.equal(e.x.dreObra('oA', M, M).despesas, 1000);
});

test('fase 5 · passo 2 · período: mês, anterior e acumulado', async () => {
  const ant = mesAtras(1);
  const seed = seedDRE({ lancamentos: Object.assign({}, seedDRE().lancamentos, { p1: lanc({ obraId: 'oA', competencia: ant, categoria: 'receita', valor: 2000 }), p2: lanc({ obraId: 'oA', competencia: ant, categoria: 'custo_direto', valor: 500 }) }) });
  const e = await abrir({ seed });
  const mes = e.x.dreObra('oA', M, M), anterior = e.x.dreObra('oA', ant, ant), acum = e.x.dreObra('oA', '0000-01', M);
  assert.equal(anterior.receita, 2000);
  assert.equal(anterior.resultado, 1500);
  assert.equal(acum.receita, 12000);
  assert.equal(acum.resultado, mes.resultado + anterior.resultado);
  const tri = e.x.dreObra('oA', mesAtras(2), M);
  assert.equal(tri.receita, 12000);
});

test('fase 5 · passo 2 · sugestão de receita e imposto; confirmar não duplica', async () => {
  const seed = { empresas: { emp1: { nome: 'C', ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita' } }, obras: { oA: obraAdm({ nome: 'Obra A', empresaId: 'emp1' }) }, contratosCliente: { cc_oA: { obraId: 'oA', tipoRemuneracao: 'fixo_mensal', valorMensal: 5000, inicio: M + '-01', fim: mesAdd1(M, 3) + '-01', parcelas: [] } } };
  const e = await abrir({ seed, hash: '#/obra/oA/dre' });
  let s = e.x.sugestoesMes(e.x.G('obras', 'oA'), M);
  assert.equal(s.sugestoes.length, 2);
  assert.equal(s.sugestoes[0].valor, 5000);
  assert.equal(s.sugestoes[1].valor, 300);                        // 6% de 5.000
  assert.match(e.app(), /Fechamento do mês/);
  await e.click('[data-act="sug-todas"]');
  const ls = e.linhas('lancamentos');
  assert.equal(ls.length, 2);
  assert.deepEqual(ls.map((l) => l.origem).sort(), ['contrato', 'imposto_auto']);
  s = e.x.sugestoesMes(e.x.G('obras', 'oA'), M);
  assert.equal(s.sugestoes.length, 0);                            // já lançado: mostra o existente
  assert.equal(s.jaFeitas.length, 2);
  assert.match(e.app(), /Já lançado/);
  await e.click('[data-act="lanc-editar"]');                       // e o DRE já reflete
  assert.match(e.dlg(), /Editar lançamento/);
});

test('fase 5 · passo 2 · descartar some da lista; editar ajusta o valor; sem alíquota não sugere imposto', async () => {
  const seed = { empresas: { emp1: { nome: 'C', ativa: true, aliquotaImpostos: null, criterioRateio: 'receita' } }, obras: { oA: obraAdm({ nome: 'Obra A', empresaId: 'emp1' }) }, contratosCliente: { cc_oA: { obraId: 'oA', tipoRemuneracao: 'parcelas', parcelas: [{ competencia: M, valor: 4000 }] } } };
  const e = await abrir({ seed, hash: '#/obra/oA/dre' });
  assert.equal(e.x.sugestoesMes(e.x.G('obras', 'oA'), M).sugestoes.length, 1);       // só receita
  await e.click('[data-act="sug-editar"]');
  await e.submit({ valor: '4200' });
  assert.equal(e.linhas('lancamentos')[0].valor, 4200);
  const d = await abrir({ seed, hash: '#/obra/oA/dre' });
  await d.click('[data-act="sug-descartar"]');
  assert.equal(d.linhas('lancamentos').length, 0);
  assert.doesNotMatch(d.app(), /Confirmar todas/);
});

test('fase 5 · passo 2 · obra sem empresa não gera sugestão nem lançamento', async () => {
  const e = await abrir({ seed: { obras: { oA: obraAdm({ nome: 'Obra A' }) } }, hash: '#/obra/oA/dre' });
  assert.match(e.app(), /Defina a empresa da obra/);
  await e.click('[data-act="lanc-novo"]');
  assert.match(e.dlg(), /Obra sem empresa/);
  assert.equal(e.linhas('lancamentos').length, 0);
});

test('fase 5 · passo 2 · repasse da Administração fica fora do resultado', async () => {
  const seed = seedDRE({
    compras: { c1: { obraId: 'oA', item: 'Concreto', un: 'm³', qtd: 1, etapa: 5, status: 'pago', pedido: { data: dia(-3), fornecedorId: 'f1', total: 8000, entregaPrevista: dia(-1) }, pagoEm: dia(0), cotacoes: [] } },
    medicoes: { m1: { obraId: 'oA', contratoId: 'ct1', prestadorId: 'p1', numero: 1, periodoIni: dia(-30), periodoFim: dia(-1), status: 'paga', valorLiquido: 6000, pagaEm: dia(0), itens: [], descontos: [], justificativas: [] } },
    contasPagar: { cp_locacao_l1: { obraId: 'oA', origem: 'locacao', origemId: 'l1', descricao: 'Betoneira', valor: 400, status: 'paga', pagoEm: dia(0), vencimento: '' } }
  });
  const e = await abrir({ seed, hash: '#/obra/oA/dre' });
  const r = e.x.repasseObra('oA', M, M);
  assert.equal(r.compras, 8000); assert.equal(r.medicoes, 6000); assert.equal(r.locacoes, 400); assert.equal(r.total, 14400);
  assert.equal(e.x.dreObra('oA', M, M).resultado, 5400);         // o resultado não muda com o repasse
  assert.match(e.app(), /Recursos de terceiros movimentados \(repasse\)/);
  assert.match(e.app(), /Não é receita nem custo da Cariati/);
  const g = await abrir({ seed: seedDRE({ obras: { oA: obra({ nome: 'Obra A', empresaId: 'emp1' }), oB: obra({ nome: 'Obra B', empresaId: 'emp1' }) } }), hash: '#/obra/oA/dre' });
  assert.equal(g.x.repasseObra('oA', M, M).total, 0);
  assert.doesNotMatch(g.app(), /Recursos de terceiros/);
});

test('fase 5 · passo 2 · lançamento manual: validações e escape', async () => {
  const xss = '<img src=x onerror="window.__xss=9">';
  const e = await abrir({ seed: seedDRE({ lancamentos: { z1: lanc({ obraId: 'oA', categoria: 'custo_direto', valor: 10, descricao: xss, subcategoria: xss }) } }), hash: '#/obra/oA/dre' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.click('[data-act="lanc-novo"]');
  await e.submit({ categoria: 'custo_direto', competencia: M, valor: '', subcategoria: 'Deslocamento' });
  assert.match(e.erroForm(), /sempre positivo/);
  await e.submit({ valor: '250', descricao: 'Combustível' });
  const ls = e.linhas('lancamentos').filter((l) => l.descricao === 'Combustível');
  assert.equal(ls.length, 1);
  assert.equal(ls[0].empresaId, 'emp1');
  assert.equal(ls[0].obraId, 'oA');
  assert.equal(ls[0].origem, 'manual');
  assert.equal(e.win.__xss, undefined);
});

/* ---------------- passo 3: DRE por empresa e consolidado ---------------- */
test('fase 5 · passo 3 · DRE da empresa: mesmo caso, com as despesas gerais por inteiro', async () => {
  const e = await abrir({ seed: seedDRE() });
  const E = e.x.dreEmpresa('emp1', M, M);
  assert.equal(E.receita, 15000); assert.equal(E.impostos, 900); assert.equal(E.receitaLiquida, 14100);
  assert.equal(E.custos, 4000);   assert.equal(E.resultadoBruto, 10100);
  assert.equal(E.despesas, 1500); assert.equal(E.resultado, 8600);
  assert.equal(arred(E.margem), 61);
});

test('fase 5 · passo 3 · a soma das obras fecha exatamente com o DRE da empresa', async () => {
  const e = await abrir({ seed: seedDRE() });
  const linhas = e.x.dreLinhasPorObra('emp1', M, M);
  assert.equal(linhas.length, 2);
  const soma = linhas.reduce((s, l) => s + l.d.resultado, 0);
  assert.equal(Math.round(soma * 100) / 100, e.x.dreEmpresa('emp1', M, M).resultado);
  ['receita', 'impostos', 'custos', 'despesas', 'resultado'].forEach((k) => {
    assert.equal(Math.round(linhas.reduce((s, l) => s + l.d[k], 0) * 100) / 100, e.x.dreEmpresa('emp1', M, M)[k], k);
  });
});

test('fase 5 · passo 3 · despesa geral de empresa sem obras aparece como "sem obra para ratear" e o total continua fechando', async () => {
  const seed = { empresas: { emp1: { nome: 'Sem obras', ativa: true, criterioRateio: 'receita' } }, lancamentos: { g1: lanc({ obraId: '', categoria: 'despesa_geral', valor: 800 }) } };
  const e = await abrir({ seed });
  const linhas = e.x.dreLinhasPorObra('emp1', M, M);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].nome, 'Despesas gerais sem obra para ratear');
  assert.equal(linhas[0].d.resultado, -800);
  assert.equal(e.x.dreEmpresa('emp1', M, M).resultado, -800);
});

test('fase 5 · passo 3 · consolidado = soma das empresas (inclusive obras sem empresa)', async () => {
  const seed = seedDRE({
    empresas: { emp1: { nome: 'Construtora', ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita' }, emp2: { nome: 'Arquitetura', ativa: true, criterioRateio: 'igual' } },
    obras: { oA: obraAdm({ nome: 'Obra A', empresaId: 'emp1' }), oB: obraAdm({ nome: 'Obra B', empresaId: 'emp1' }), oC: obraAdm({ nome: 'Projeto C', empresaId: 'emp2' }), oD: obra({ nome: 'Órfã' }) },
    lancamentos: Object.assign({}, seedDRE().lancamentos, {
      c1: lanc({ empresaId: 'emp2', obraId: 'oC', categoria: 'receita', valor: 3000 }), c2: lanc({ empresaId: 'emp2', obraId: 'oC', categoria: 'custo_direto', valor: 700 }), c3: lanc({ empresaId: 'emp2', obraId: '', categoria: 'despesa_geral', valor: 400 }),
      d1: lanc({ empresaId: '', obraId: 'oD', categoria: 'receita', valor: 1000 })
    })
  });
  const e = await abrir({ seed });
  const cons = e.x.dreConsolidado(M, M);
  const partes = ['emp1', 'emp2', ''].map((id) => e.x.dreEmpresa(id, M, M));
  assert.equal(cons.receita, 15000 + 3000 + 1000);
  assert.equal(cons.resultado, Math.round(partes.reduce((s, d) => s + d.resultado, 0) * 100) / 100);
  assert.equal(cons.resultado, 8600 + (3000 - 700 - 400) + 1000);
});

test('fase 5 · passo 3 · a página DRE mostra o consolidado, o quadro por obra com total e os gráficos', async () => {
  const e = await abrir({ seed: seedDRE(), hash: '#/dre' });
  const t = e.app();
  assert.match(t, /DRE consolidado/);
  assert.match(t, /Obra A.*R\$\s*10\.000,00.*R\$\s*5\.400,00.*57,4%/);
  assert.match(t, /Obra B.*R\$\s*3\.200,00.*68,1%/);
  assert.match(t, /Total.*R\$\s*15\.000,00.*R\$\s*8\.600,00.*61%/);
  assert.equal(e.doc.querySelectorAll('svg.lob').length, 1);
  assert.match(t, /Ranking de margem por obra/);
  assert.match(t, /Informação restrita à diretoria/);
  const ranking = Array.from(e.doc.querySelectorAll('.hbar span:first-child')).map((s) => s.textContent);
  assert.deepEqual(ranking, ['Obra B', 'Obra A']);      // maior margem primeiro
});

test('fase 5 · passo 3 · filtro por empresa e período', async () => {
  const seed = seedDRE({ empresas: { emp1: { nome: 'Construtora', ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita' }, emp2: { nome: 'Arquitetura', ativa: true, criterioRateio: 'igual' } }, lancamentos: Object.assign({}, seedDRE().lancamentos, { c1: lanc({ empresaId: 'emp2', obraId: '', categoria: 'despesa_geral', valor: 999 }) }) });
  const e = await abrir({ seed, hash: '#/dre' });
  const sel = e.doc.querySelector('[data-chg="dre-emp"]');
  sel.value = 'emp1'; sel.dispatchEvent(new e.win.Event('change', { bubbles: true })); await e.tick();
  assert.match(e.app(), /Construtora/);
  assert.match(e.app(), /Neste quadro as despesas gerais da empresa entram por inteiro/);
  assert.doesNotMatch(e.app(), /Projeto C/);
  await e.click('[data-act="dreg-preset"][data-p="ano"]');
  assert.match(e.doc.querySelector('[data-chg="dreg-per"][data-k="ini"]').value, /^\d{4}-01$/);
});

test('fase 5 · passo 3 · exportação CSV detalhada, uma linha por lançamento', async () => {
  const seed = seedDRE({ lancamentos: Object.assign({}, seedDRE().lancamentos, { x1: lanc({ obraId: 'oA', categoria: 'custo_direto', valor: 1234.5, subcategoria: 'Deslocamento', descricao: 'Combustível; posto "Shell"' }), velho: lanc({ obraId: 'oA', competencia: mesAtras(8), categoria: 'receita', valor: 1 }) }) });
  const e = await abrir({ seed });
  const csv = e.x.csvLancamentos('__todas', M, M);
  const linhas = csv.trim().split('\r\n');
  assert.equal(linhas[0], 'empresa;obra;competencia;categoria;subcategoria;descricao;valor;origem');
  assert.equal(linhas.length, 1 + 8);                                    // 7 do caso + o novo; o antigo fica fora do período
  assert.ok(linhas.some((l) => l === 'Cariati Construtora Ltda;Obra A;' + M + ';Custo direto;Deslocamento;"Combustível; posto ""Shell""";1234,5;Manual'));
  assert.ok(csv.indexOf(';1;') < 0);
  const soEmp = e.x.csvLancamentos('emp_inexistente', M, M).trim().split('\r\n');
  assert.equal(soEmp.length, 1);
});

test('fase 5 · passo 3 · despesa geral lançada pela página DRE', async () => {
  const e = await abrir({ seed: seedDRE(), hash: '#/dre' });
  await e.click('[data-act="despesa-nova"]');
  await e.submit({ categoria: 'despesa_geral', competencia: M, empresaId: 'emp1', subcategoria: 'Contabilidade', valor: '600', descricao: 'Honorários do contador' });
  const l = e.linhas('lancamentos').find((x) => x.descricao === 'Honorários do contador');
  assert.equal(l.obraId, '');
  assert.equal(l.empresaId, 'emp1');
  assert.equal(e.x.dreEmpresa('emp1', M, M).despesas, 2100);
  assert.equal(e.x.dreObra('oA', M, M).despesas, 1400);                   // 2.100 rateados por receita: 2/3 para a Obra A
});

test('fase 5 · passo 3 · texto do DRE é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=10">';
  const e = await abrir({ seed: seedDRE({ obras: { oA: obraAdm({ nome: xss, empresaId: 'emp1' }), oB: obraAdm({ nome: 'Obra B', empresaId: 'emp1' }) }, empresas: { emp1: { nome: xss, ativa: true, aliquotaImpostos: 6, criterioRateio: 'receita' } } }), hash: '#/dre' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});

/* ---------------- passo 4: fechamento mensal e relatório ao cliente ---------------- */
const oc = (o) => Object.assign({ obraId: 'o1', etapa: 5, tipo: 'apontamento', gravidade: 'simples', descricao: 'Ocorrência', status: 'aberta', prazo: dia(5), interacoes: [], criadoEm: new Date().toISOString(), reabertas: 0 }, o || {});
const seedRel = (extra, adm) => Object.assign({ obras: { o1: (adm === false ? obra : obraAdm)({ nome: 'Residência Jardim Europa', empresaId: 'emp_cons' }) }, empresas: { emp_cons: { nome: 'Cariati Construtora Ltda', ativa: true, criterioRateio: 'receita' } }, ocorrencias: { c1: oc(), c2: oc({ gravidade: 'critica' }) } }, extra || {});

test('fase 5 · passo 4 · o rascunho junta as seções do relatório (Administração)', async () => {
  const e = await abrir({ seed: seedRel(), hash: '#/obra/o1/relatorio' });
  assert.match(e.app(), /Nenhum relatório de/);
  await e.click('[data-act="rel-criar"]');
  assert.equal(e.linhas('relatorios').length, 1);
  assert.equal(e.linhas('relatorios')[0].status, 'rascunho');
  const t = e.app();
  ['Resumo da engenharia', 'Avanço físico', 'Qualidade', 'Planejamento', 'Suprimentos e financeiro', 'Aditivos', 'Pendências de decisão do cliente', 'Documentos e conformidade', 'Próximos 30 dias', 'Fotos do mês'].forEach((s) => assert.match(t, new RegExp(s)));
  assert.match(t, /Residência Jardim Europa/);
  assert.match(t, /Cariati Construtora Ltda/);
  assert.match(t, /ocorrências abertas: 2 \(1 crítica/);
  assert.match(t, /Rascunho\. Os números mudam/);
});

test('fase 5 · passo 4 · Gestão mostra medições e desembolso, sem suprimentos', async () => {
  const e = await abrir({ seed: seedRel({}, false), hash: '#/obra/o1/relatorio' });
  await e.click('[data-act="rel-criar"]');
  assert.match(e.app(), /Medições e desembolso previsto/);
  assert.doesNotMatch(e.app(), /Suprimentos e financeiro/);
  assert.doesNotMatch(e.app(), /Contas a pagar em aberto/);
  assert.match(e.app(), /Desembolso previsto do cliente/);
});

test('fase 5 · passo 4 · relatório emitido não muda quando os dados mudam; a retificação usa os dados novos', async () => {
  const e = await abrir({ seed: seedRel(), hash: '#/obra/o1/relatorio' });
  await e.click('[data-act="rel-criar"]');
  await e.click('[data-act="rel-texto"]');
  await e.submit({ texto: 'Mês de fundação concluída, sem imprevistos.' });
  await e.click('[data-act="rel-emitir"]');
  await e.click('[data-x="1"]');
  let r = e.linhas('relatorios')[0];
  assert.equal(r.status, 'emitido');
  assert.equal(r.snapshot.qualidade.abertasAgora, 2);
  assert.ok(r.emitidoEm);
  // os dados mudam depois da emissão
  await e.recarrega('ocorrencias', 'c3', oc({ descricao: 'Nova' }));
  await e.recarrega('obras', 'o1', Object.assign({}, e.x.G('obras', 'o1'), { nome: 'Nome mudou depois' }));
  await e.go('#/obra/o1/relatorio');
  assert.match(e.app(), /ocorrências abertas: 2 \(1 crítica/);          // continua a foto da emissão
  assert.match(e.app(), /Residência Jardim Europa/);
  assert.doesNotMatch(e.app(), /Nome mudou depois<\/h1>/);
  assert.match(e.app(), /Mês de fundação concluída/);
  assert.equal(e.doc.querySelector('[data-act="rel-texto"]'), null);      // emitido não se edita
  assert.equal(e.doc.querySelector('[data-act="rel-emitir"]'), null);
  assert.equal(e.doc.querySelector('[data-act="rel-excluir"]'), null);
  // retificação: novo rascunho ligado ao anterior, com os números novos
  await e.click('[data-act="rel-retificar"]');
  const todos = e.linhas('relatorios');
  assert.equal(todos.length, 2);
  const nova = todos.find((x) => x.id !== r.id);
  assert.equal(nova.retificacaoDe, r.id);
  assert.equal(nova.status, 'rascunho');
  assert.equal(nova.textoEngenharia, 'Mês de fundação concluída, sem imprevistos.');
  assert.match(e.app(), /ocorrências abertas: 3/);
  assert.match(e.app(), /retificação/);
  assert.equal(e.linhas('relatorios').find((x) => x.id === r.id).snapshot.qualidade.abertasAgora, 2);   // o original segue intacto
  await e.click('[data-act="rel-emitir"]');
  await e.click('[data-x="1"]');
  assert.equal(e.x.relVigente('o1', dia(0).slice(0, 7)).id, nova.id);
  assert.match(e.app(), /Relatório 1 · Emitido \(substituído\)/);
});

test('fase 5 · passo 4 · envio ao cliente, prazo de objeção e validação ou objeção', async () => {
  const e = await abrir({ seed: seedRel(), hash: '#/obra/o1/relatorio' });
  await e.click('[data-act="rel-criar"]');
  await e.click('[data-act="rel-emitir"]');
  await e.click('[data-x="1"]');
  assert.match(e.app(), /Ainda não registrado como enviado/);
  await e.click('[data-act="rel-enviar"]');
  await e.submit({ data: dia(0), prazo: dia(-1) });
  assert.match(e.erroForm(), /prazo para objeção não pode ser antes do envio/);
  await e.submit({ data: dia(0), prazo: dia(5) });
  let r = e.linhas('relatorios')[0];
  assert.equal(r.enviadoEm, dia(0));
  assert.equal(r.prazoObjecao, dia(5));
  assert.match(e.app(), /prazo para objeção/);
  await e.click('[data-act="rel-valid"]');
  await e.submit({ status: 'objecao', data: dia(1), ref: 'e-mail', texto: '' });
  assert.match(e.erroForm(), /Descreva a objeção/);
  await e.submit({ status: 'objecao', texto: 'Discordo do valor do aditivo 2.' });
  r = e.linhas('relatorios')[0];
  assert.equal(r.validacaoCliente.status, 'objecao');
  assert.match(e.app(), /Objeção do cliente/);
  await e.click('[data-act="rel-valid"]');
  await e.submit({ status: 'validado', data: dia(2), ref: 'WhatsApp', texto: '' });
  assert.equal(e.linhas('relatorios')[0].validacaoCliente.status, 'validado');
  assert.match(e.app(), /Validado pelo cliente/);
});

test('fase 5 · passo 4 · escolha de fotos do diário, no máximo 12', async () => {
  const fotos = Array.from({ length: 14 }, (_, i) => 'foto' + i);
  const seed = seedRel({ diarios: { d1: { obraId: 'o1', data: dia(0), atividades: 'x', fotos, efetivo: [] } } });
  const e = await abrir({ seed, hash: '#/obra/o1/relatorio' });
  await e.click('[data-act="rel-criar"]');
  await e.click('[data-act="rel-fotos"]');
  assert.equal(e.doc.querySelectorAll('[data-rf]').length, 14);
  for (let i = 0; i < 12; i++) await e.doc.querySelectorAll('[data-rf]')[i].click();
  await e.tick();
  assert.match(e.dlg(), /12 de 12 selecionadas/);
  await e.doc.querySelectorAll('[data-rf]')[12].click(); await e.tick();
  assert.match(e.dlg(), /O limite é de 12 fotos/);
  await e.click('#rf_ok');
  assert.equal(e.linhas('relatorios')[0].fotos.length, 12);
});

test('fase 5 · passo 4 · visão de impressão A4, botão de imprimir e HTML autônomo', async () => {
  const e = await abrir({ seed: seedRel(), hash: '#/obra/o1/relatorio' });
  assert.match(e.doc.querySelector('style').textContent, /@media print/);
  assert.match(e.doc.querySelector('style').textContent, /size:A4/);
  assert.ok(e.doc.querySelector('.no-print'));                             // a barra de etapas some ao imprimir
  await e.click('[data-act="rel-criar"]');
  let impresso = 0; e.win.print = () => { impresso++; };
  await e.click('[data-act="rel-imprimir"]');
  assert.equal(impresso, 1);
  const r = e.linhas('relatorios')[0], o = e.x.G('obras', 'o1');
  const html = e.x.relHtmlDocumento(o, Object.assign({}, r, { dados: e.x.relDados(o, r.mes) }));
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Relatório mensal — Residência Jardim Europa/);
  assert.match(html, /@media print/);
  assert.match(html, /Pendências de decisão do cliente/);
  await e.click('[data-act="rel-html"]');
  assert.deepEqual(e.erros, []);
});

test('fase 5 · passo 4 · pendências do cliente com data-limite e aditivos no relatório', async () => {
  const seed = seedRel({ materiais: { m1: { obraId: 'o1', item: 'Porcelanato da sala', aprovador: 'Cliente', prazo: dia(6), resultado: 'pendente', nivel3: true } }, aditivos: { a1: { obraId: 'o1', numero: 1, descricao: 'Contenção extra', tipo: 'acrescimo', status: 'aguardando_cliente', enviadoEm: new Date().toISOString(), itens: [{ descricao: 'x', unidade: 'un', quantidade: 1, precoUnitario: 900, total: 900, etapa: 5, tipoItem: 'empreitada' }] } } });
  const e = await abrir({ seed, hash: '#/obra/o1/relatorio' });
  await e.click('[data-act="rel-criar"]');
  const d = e.x.relDados(e.x.G('obras', 'o1'), dia(0).slice(0, 7));
  assert.equal(d.pendencias.length, 2);
  assert.match(e.app(), /Escolha de material.*Porcelanato da sala.*decidir até/);
  assert.match(e.app(), /Aditivo nº 1.*Contenção extra/);
  assert.match(e.app(), /Nº 1 — Contenção extra: R\$\s*900,00/);
});

test('fase 5 · passo 4 · texto do relatório é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=11">';
  const seed = seedRel({ relatorios: { r1: { obraId: 'o1', mes: dia(0).slice(0, 7), status: 'rascunho', textoEngenharia: xss, fotos: [], validacaoCliente: { status: 'pendente' }, criadoEm: new Date().toISOString(), hist: [] } }, materiais: { m1: { obraId: 'o1', item: xss, aprovador: 'C', prazo: dia(6), resultado: 'pendente', nivel3: true } } });
  const e = await abrir({ seed, hash: '#/obra/o1/relatorio' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
  assert.match(e.app(), /<img src=x/);
});
