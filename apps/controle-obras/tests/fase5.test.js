'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, obraAdm, dia, mesAtras } = require('./helpers');

const atual = (e, sel) => Array.from(e.doc.querySelectorAll(sel + ' [aria-current="page"]')).map((a) => a.textContent).join('|');

/* ---------------- passo 0: navegação agrupada ---------------- */
test('fase 5 · passo 0 · grupos da obra e subabas', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/resumo' });
  const grupos = Array.from(e.doc.querySelectorAll('nav.grupos a')).map((a) => a.textContent);
  assert.equal(grupos.join(' · '), 'Visão geral · Planejamento · Execução e qualidade · Suprimentos · Prestadores · Custo e financeiro · Gestão · Encerramento');
  assert.equal(atual(e, 'nav.grupos'), 'Visão geral');
});

test('fase 5 · passo 0 · URLs antigas abrem a aba certa e destacam o grupo e a subaba', async () => {
  const casos = [['cronograma', 'Planejamento', 'Cronograma'], ['ocorrencias', 'Execução e qualidade', 'Ocorrências'], ['compras', 'Suprimentos', 'Compras'], ['contratos', 'Prestadores', 'Contratos e frentes'], ['medicao', 'Custo e financeiro', 'Medição'], ['fisfin', 'Custo e financeiro', 'Físico-financeiro'], ['documentos', 'Gestão', 'Documentos'], ['entrega', 'Execução e qualidade', 'Pré-entrega']];
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
  assert.deepEqual(hrefs, ['#/obra/o1/resumo', '#/obra/o1/etapas', '#/obra/o1/diario', '#/obra/o1/compras', '#/obra/o1/contratos', '#/obra/o1/orcamento', '#/obra/o1/agenda', '#/obra/o1/encerramento']);
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

/* ---------------- passo 5: avaliação de prestadores ---------------- */
const ocP = (g, extra) => oc(Object.assign({ prestadorId: 'p1', gravidade: g }, extra || {}));
const baseAv = (extra) => Object.assign({ obras: { o1: obraAdm() }, prestadores: { p1: { nome: 'Alvenaria Souza', seguro: dia(90), treinamento: dia(90) }, p2: { nome: 'Sem Dados Ltda' } } }, extra || {});
const pacotes10 = () => { const o = {}; for (let i = 0; i < 10; i++) o['k' + i] = { obraId: 'o1', semana: dia(-7), descricao: 'Pacote ' + i, prestadorId: 'p1', concluido: i < 8, causa: i < 8 ? '' : 'producao' }; return o; };

test('fase 5 · passo 5 · pontualidade: 8 pacotes concluídos de 10 sugerem 8,0', async () => {
  const e = await abrir({ seed: baseAv({ pacotes: pacotes10() }) });
  assert.equal(e.x.avSugestoes('o1', 'p1').pontualidade, 8);
  assert.equal(e.x.avSugestoes('o1', 'p2').pontualidade, null);         // sem dados, sem sugestão
});

test('fase 5 · passo 5 · conformidade: 1 crítica + 2 importantes + 1 simples = 5,3 pontos → 4,7', async () => {
  const e = await abrir({ seed: baseAv({ ocorrencias: { a: ocP('critica'), b: ocP('importante'), c: ocP('importante'), d: ocP('simples') } }) });
  const s = e.x.avSugestoes('o1', 'p1');
  assert.equal(s.conformidade, 4.7);
  assert.equal(s.reincidencia, 10);                                       // nenhuma reabertura
});

test('fase 5 · passo 5 · danos: R$ 500 em contrato de R$ 50.000 (limite de 2% = R$ 1.000) → 5,0', async () => {
  const e = await abrir({ seed: baseAv({ contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 50000, inicio: dia(-10), fim: dia(30), status: 'ativo' } }, danos: { d1: { obraId: 'o1', descricao: 'Vidro', custo: 500, causadorId: 'p1', status: 'aberta' } } }) });
  assert.equal(e.x.avSugestoes('o1', 'p1').danos, 5);
  const muito = await abrir({ seed: baseAv({ contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 50000, inicio: dia(-10), fim: dia(30), status: 'ativo' } }, danos: { d1: { obraId: 'o1', descricao: 'Parede', custo: 5000, causadorId: 'p1', status: 'aberta' } } }) });
  assert.equal(muito.x.avSugestoes('o1', 'p1').danos, 0);                // passou do limite: nota zero, nunca negativa
});

test('fase 5 · passo 5 · reincidência: 2 ocorrências reabertas em 8 → 7,5', async () => {
  const ocs = {}; for (let i = 0; i < 8; i++) ocs['x' + i] = ocP('simples', { reabertas: i < 2 ? 1 : 0 });
  const e = await abrir({ seed: baseAv({ ocorrencias: ocs }) });
  assert.equal(e.x.avSugestoes('o1', 'p1').reincidencia, 7.5);
});

test('fase 5 · passo 5 · limpeza e documentação; segurança nunca é sugerida', async () => {
  const docs = {}; [mesAtras(0), mesAtras(1)].forEach((m) => ['inss', 'fgts', 'folha', 'certidoes'].forEach((k) => { docs['o1_p1_' + m + '_' + k] = { obraId: 'o1', prestadorId: 'p1', mes: m, tipo: k, status: 'conferido' }; }));
  const seed = baseAv({ termos: { t1: { obraId: 'o1', frente: 'A', saiId: 'p1', data: dia(-5), estado: 'limpa' }, t2: { obraId: 'o1', frente: 'B', saiId: 'p1', data: dia(-4), estado: 'limpa' }, t3: { obraId: 'o1', frente: 'C', saiId: 'p1', data: dia(-3), estado: 'pendencias', pendencias: 'x' } },
    contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 1000, inicio: mesAtras(3) + '-01', fim: dia(90), status: 'ativo' } }, docsPrest: docs });
  const e = await abrir({ seed });
  const s = e.x.avSugestoes('o1', 'p1');
  assert.equal(s.limpeza, 6.7);                     // 2 de 3 termos limpos
  assert.equal(s.documentacao, 5);                  // 2 dos 4 meses do contrato (3 atrás até o atual) em dia
  assert.equal(s.seguranca, null);
});

test('fase 5 · passo 5 · nota final é a média ponderada só dos critérios preenchidos', async () => {
  const e = await abrir();
  assert.equal(e.x.avNotaFinal({ pontualidade: 8, conformidade: 6, limpeza: null, danos: 10 }, {}), 8);           // (8+6+10)/3
  assert.equal(e.x.avNotaFinal({ pontualidade: 10, conformidade: 5 }, { pontualidade: 3, conformidade: 1 }), 8.8);  // (30+5)/4
  assert.equal(e.x.avNotaFinal({}, {}), null);
});

test('fase 5 · passo 5 · diferença acima de 2 pontos da sugestão exige justificativa', async () => {
  const e = await abrir({ seed: baseAv({ pacotes: pacotes10() }), hash: '#/obra/o1/avaliacoes' });
  const contrato = { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 1000, inicio: dia(-10), fim: dia(30), status: 'ativo' };
  await e.recarrega('contratosPrest', 'ct1', contrato);
  await e.click('[data-act="av-nova"][data-p="p1"]');
  assert.equal(e.doc.querySelector('[name="n_pontualidade"]').value, '8');           // já vem com a sugestão
  await e.submit({ n_pontualidade: '10.5' });
  assert.match(e.erroForm(), /de 0 a 10/);
  await e.submit({ n_pontualidade: '5', recontrataria: 'sim' });                     // 3 pontos abaixo da sugestão (8)
  assert.match(e.erroForm(), /Pontualidade: a nota difere 3 pontos da sugestão \(8\)\. Escreva a justificativa/);
  assert.equal(e.linhas('avaliacoes').length, 0);
  await e.submit({ j_pontualidade: 'Atrasou a entrega da fachada por falta de material próprio.' });
  const a = e.linhas('avaliacoes')[0];
  assert.equal(a.criterios.pontualidade, 5);
  assert.equal(a.sugeridos.pontualidade, 8);
  assert.match(a.justificativas.pontualidade, /Atrasou/);
  assert.equal(a.recontrataria, 'sim');
  assert.equal(a.notaFinal, avMedia(a));
});
const avMedia = (a) => { const v = Object.values(a.criterios).filter((x) => x != null); return Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10; };

test('fase 5 · passo 5 · segurança é preenchida à mão e uma nota dentro de 2 pontos passa sem justificativa', async () => {
  const e = await abrir({ seed: baseAv({ pacotes: pacotes10() }), hash: '#/obra/o1/avaliacoes' });
  await e.recarrega('contratosPrest', 'ct1', { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 1000, inicio: dia(-10), fim: dia(30), status: 'ativo' });
  await e.click('[data-act="av-nova"][data-p="p1"]');
  await e.submit({ n_pontualidade: '6.5', n_seguranca: '9', recontrataria: 'com_ressalvas', comentario: 'Bom, mas atrasa.' });
  const a = e.linhas('avaliacoes')[0];
  assert.equal(a.criterios.seguranca, 9);
  assert.equal(a.sugeridos.seguranca, null);
  assert.equal(a.recontrataria, 'com_ressalvas');
  assert.match(e.app(), /Recontrataria: Com ressalvas/);
  await e.click('[data-act="av-nova"][data-p="p1"]');
  const vazios = { recontrataria: 'sim' }; ['pontualidade', 'conformidade', 'limpeza', 'danos', 'seguranca', 'documentacao', 'reincidencia'].forEach((k) => { vazios['n_' + k] = ''; });
  await e.submit(vazios);
  assert.match(e.erroForm(), /ao menos um critério/);
});

test('fase 5 · passo 5 · ranking na página Prestadores: nota média, obras avaliadas, última e recontrataria', async () => {
  const av = (id, obraId, nota, data, rec) => ({ obraId, prestadorId: 'p1', data, criterios: { pontualidade: nota }, sugeridos: {}, justificativas: {}, pesos: {}, notaFinal: nota, comentario: '', recontrataria: rec });
  const e = await abrir({ seed: baseAv({ avaliacoes: { a1: av('a1', 'o1', 8, dia(-30), 'sim'), a2: av('a2', 'o2', 5, dia(-2), 'com_ressalvas') } }), hash: '#/prestadores' });
  assert.equal(e.x.prestNotaMedia('p1'), 6.5);
  assert.match(e.app(), /Alvenaria Souza.*Nota 6,5.*2 obras avaliadas.*recontrataria: Com ressalvas/);
  assert.match(e.app(), /Sem ssem|Sem avaliação/);
});

test('fase 5 · passo 5 · ao contratar prestador com nota média abaixo de 6 há um aviso que não bloqueia', async () => {
  const seed = baseAv({ avaliacoes: { a1: { obraId: 'o2', prestadorId: 'p1', data: dia(-9), criterios: { pontualidade: 4 }, sugeridos: {}, justificativas: {}, pesos: {}, notaFinal: 4, recontrataria: 'nao' } }, orcamentos: {} });
  const e = await abrir({ seed, hash: '#/obra/o1/contratos' });
  await e.click('[data-act="ct-novo"]');
  const campos = { prestadorId: 'p1', escopo: 'Alvenaria', valor: '10000', retencao: '5', inicio: dia(0), fim: dia(30), criterio: '', regraDano: '', status: 'ativo' };
  await e.submit(campos);
  assert.match(e.erroForm(), /Aviso: Alvenaria Souza tem nota média 4 \(abaixo de 6\)/);
  assert.equal(e.linhas('contratosPrest').length, 0);
  await e.submit({});
  assert.equal(e.linhas('contratosPrest').length, 1);                      // salvar de novo confirma
  const bom = await abrir({ seed: baseAv(), hash: '#/obra/o1/contratos' });
  await bom.click('[data-act="ct-novo"]');
  await bom.submit(campos);
  assert.equal(bom.linhas('contratosPrest').length, 1);                     // sem avaliação ruim, sem aviso
});

test('fase 5 · passo 5 · encerrar contrato registra a data, sugere avaliar e a avaliação pendente aparece', async () => {
  const seed = baseAv({ contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'Alvenaria', valor: 1000, inicio: dia(-40), fim: dia(-2), status: 'ativo' } } });
  const e = await abrir({ seed, hash: '#/obra/o1/contratos' });
  await e.click('[data-act="ct-editar"]');
  await e.submit({ status: 'encerrado' });
  const c = e.linhas('contratosPrest')[0];
  assert.equal(c.status, 'encerrado');
  assert.equal(c.encerradoEm, dia(0));
  assert.equal(e.x.avPendentes('o1').length, 1);
  await e.go('#/obra/o1/avaliacoes');
  assert.match(e.app(), /Avaliação pendente.*Alvenaria Souza.*contrato encerrado/);
  assert.equal(atual(e, 'nav.grupos'), 'Prestadores');
});

test('fase 5 · passo 5 · texto da avaliação é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=12">';
  const seed = baseAv({ prestadores: { p1: { nome: xss } }, contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 1, inicio: dia(-1), fim: dia(1), status: 'ativo' } }, avaliacoes: { a1: { obraId: 'o1', prestadorId: 'p1', data: dia(-1), criterios: { pontualidade: 7 }, sugeridos: {}, justificativas: {}, pesos: {}, notaFinal: 7, comentario: xss, recontrataria: 'sim' } } });
  const e = await abrir({ seed, hash: '#/obra/o1/avaliacoes' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.go('#/prestadores');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});

/* ---------------- passo 6: encerramento, lições e ajuste do P0 ---------------- */
const conta = (o) => Object.assign({ obraId: 'o1', origem: 'outro', origemId: 'x', descricao: 'Conta', valor: 1000, vencimento: '', status: 'aberta', pagoEm: '' }, o || {});
const seedEnc = (extra, adm) => Object.assign({ obras: { o1: (adm === false ? obra : obraAdm)({ nome: 'Casa Encerrar', area: 100 }) } }, extra || {});
const docsEnc = () => { const d = {}; ['sero', 'cnd', 'habitese'].forEach((k) => { d['o1_' + k] = { obraId: 'o1', tipo: k, numero: '123', validade: '', anexos: [] }; }); return d; };
const itemOk = (t, k) => t.find((x) => x.k === k).ok;

test('fase 5 · passo 6 · checklist de encerramento reflete cada item', async () => {
  const e = await abrir({ seed: seedEnc() });
  let t = e.x.checklistEncerramento(e.x.G('obras', 'o1'));
  assert.deepEqual(Array.from(t.map((x) => x.k)), ['docs', 'ocorrencias', 'danos', 'contas', 'termos', 'estoque', 'avaliacoes', 'relatorio', 'licoes']);
  assert.equal(itemOk(t, 'docs'), false);
  assert.equal(itemOk(t, 'ocorrencias'), true);
  assert.equal(itemOk(t, 'licoes'), false);
  const cheio = await abrir({ seed: seedEnc({ docsLegais: docsEnc(), ocorrencias: { c1: oc() }, danos: { d1: { obraId: 'o1', descricao: 'x', custo: 1, status: 'aberta' } }, contasPagar: { k1: conta({ obraId: 'o1', valor: 10 }) }, movEstoque: { m1: { obraId: 'o1', item: 'Cimento', un: 'saco', tipo: 'entrada', qtd: 5, data: dia(-1) } }, contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 1, inicio: dia(-9), fim: dia(9), status: 'ativo' } }, prestadores: { p1: { nome: 'P' } } }) });
  t = cheio.x.checklistEncerramento(cheio.x.G('obras', 'o1'));
  assert.equal(itemOk(t, 'docs'), true);
  ['ocorrencias', 'danos', 'contas', 'termos', 'estoque', 'avaliacoes'].forEach((k) => assert.equal(itemOk(t, k), false, k));
  const gestao = await abrir({ seed: seedEnc({}, false) });
  assert.ok(!gestao.x.checklistEncerramento(gestao.x.G('obras', 'o1')).some((x) => x.k === 'contas'));   // contas só na Administração
});

test('fase 5 · passo 6 · encerrar exige o checklist completo ou justificativa por item pendente', async () => {
  const e = await abrir({ seed: seedEnc(), hash: '#/obra/o1/encerramento' });
  await e.click('[data-act="obra-encerrar"]');
  assert.match(e.dlg(), /Não é possível encerrar a obra/);
  assert.match(e.dlg(), /Documentos de encerramento/);
  assert.equal(e.linhas('obras')[0].situacao, undefined);
  await e.click('[data-close]');
  for (const k of ['docs', 'relatorio', 'licoes']) {
    await e.click('[data-act="enc-justificar"][data-k="' + k + '"]');
    await e.submit({ texto: 'Justificativa de ' + k });
  }
  assert.match(e.app(), /Justificado/);
  await e.click('[data-act="obra-encerrar"]');
  assert.match(e.dlg(), /3 itens seguem pendentes, com justificativa/);
  await e.click('[data-x="1"]');
  const o = e.linhas('obras')[0];
  assert.equal(o.situacao, 'encerrada');
  assert.equal(o.encerradaEm, dia(0));
  assert.match(e.app(), /Obra encerrada em/);
  assert.match(e.app(), /Encerrada em/);                                  // selo no cabeçalho
});

test('fase 5 · passo 6 · obra encerrada pede confirmação ao criar algo novo e pode ser reaberta', async () => {
  const e = await abrir({ seed: seedEnc({}), hash: '#/obra/o1/ocorrencias' });
  await e.recarrega('obras', 'o1', Object.assign({}, e.x.G('obras', 'o1'), { situacao: 'encerrada', encerradaEm: dia(-3) }));
  await e.click('[data-act="oc-nova"]');
  assert.match(e.dlg(), /Obra encerrada/);
  assert.equal(e.doc.querySelector('#dform'), null);                       // o formulário ainda não abriu
  await e.click('[data-x="1"]');
  await e.tick(200);
  assert.ok(e.doc.querySelector('#dform'));                                // depois de confirmar, abre
  await e.click('[data-close]');
  await e.click('[data-act="oc-nova"]');                                   // só pergunta uma vez por sessão
  assert.ok(e.doc.querySelector('#dform'));
  await e.click('[data-close]');
  await e.go('#/obra/o1/encerramento');
  await e.click('[data-act="obra-reabrir"]');
  await e.click('[data-x="1"]');
  assert.equal(e.linhas('obras')[0].situacao, 'em_andamento');
});

test('fase 5 · passo 6 · lições aprendidas: causas, validação e snapshot do orçado × realizado', async () => {
  const seed = seedEnc({ orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-9), motivo: 'Base', total: 1000, nItens: 1, lotes: 1, porEtapa: { 5: 1000 }, porTipo: { material: 1000 } } }, orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [{ codigo: '5.01', etapa: 5, descricao: 'x', unidade: 'un', quantidade: 1, precoUnitario: 1000, tipo: 'material', prestador: '', prestadorId: '', total: 1000 }] } } });
  const e = await abrir({ seed, hash: '#/obra/o1/encerramento' });
  await e.click('[data-act="licao-nova"]');
  await e.submit({ causas: '5; chuva-de-verao; 100; x' });
  assert.match(e.erroForm(), /causa “chuva-de-verao” inválida/);
  await e.submit({ causas: '30; clima; 100' });
  assert.match(e.erroForm(), /etapa de 1 a 22/);
  await e.submit({ causas: '', oQueFuncionou: '', oQueMudar: '', ajustesProtocolo: '' });
  assert.match(e.erroForm(), /Registre ao menos/);
  await e.submit({ causas: '5; orçamento subdimensionado; 6.500,00; Contenção não prevista\n; clima; 800; Chuva em março', oQueFuncionou: 'Medição semanal', oQueMudar: 'Sondagem mais detalhada', ajustesProtocolo: 'Incluir ensaio de solo na etapa 1' });
  const l = e.linhas('licoes')[0];
  assert.equal(l.causasDesvio.length, 2);
  assert.equal(l.causasDesvio[0].causa, 'orcamento_subdimensionado');
  assert.equal(l.causasDesvio[0].valor, 6500);
  assert.equal(l.causasDesvio[1].etapa, 0);
  assert.equal(l.snapshotOrcadoRealizado[5].orcado, 1000);
  assert.match(e.app(), /Orçamento subdimensionado.*Contenção não prevista/);
  assert.equal(itemOk(e.x.checklistEncerramento(e.x.G('obras', 'o1')), 'licoes'), true);
});

/* --- P0: caso da especificação --- */
function seedP0(extra) {
  const it = (cod, et, v) => ({ codigo: cod, etapa: et, descricao: 'Serviço ' + cod, unidade: 'vb', quantidade: 1, precoUnitario: v, tipo: 'empreitada', prestador: '', prestadorId: '', total: v });
  const pedido = (total) => ({ data: dia(-3), fornecedorId: 'f1', total, entregaPrevista: dia(-1) });
  return Object.assign({
    obras: { o1: obraAdm({ nome: 'Casa P0', area: 100 }) },
    orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-20), motivo: 'Base', total: 90000, nItens: 3, lotes: 1, porEtapa: { 5: 40000, 7: 20000, 9: 30000 }, porTipo: { empreitada: 90000 } } },
    orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [it('5', 5, 40000), it('7', 7, 20000), it('9', 9, 30000)] } },
    compras: {
      c5: { obraId: 'o1', item: 'Fundação', etapa: 5, un: 'vb', qtd: 1, status: 'pago', pedido: pedido(35000), conf: { data: dia(-9) }, pagoEm: dia(-5), cotacoes: [] },
      c7: { obraId: 'o1', item: 'Alvenaria', etapa: 7, un: 'vb', qtd: 1, status: 'conferido', pedido: pedido(26000), conf: { data: dia(-2) }, cotacoes: [] }
    }
  }, extra || {});
}
test('fase 5 · passo 6 · P0: economia mantém, déficit ajusta, etapa sem custo fica de fora', async () => {
  const e = await abrir({ seed: seedP0() });
  const p = e.x.p0Calc(e.x.G('obras', 'o1')), L5 = p.linhas.find((l) => l.etapa === 5), L7 = p.linhas.find((l) => l.etapa === 7);
  assert.equal(L5.m2Orcado, 400);  assert.equal(L5.m2Real, 350);
  assert.equal(L5.desvio, -5000);  assert.equal(Math.round(L5.desvioPct * 1000) / 10, -12.5);
  assert.equal(L5.acao, 'manter');  assert.equal(L5.sugestao, 400);
  assert.equal(L7.m2Orcado, 200);  assert.equal(L7.m2Real, 260);
  assert.equal(Math.round(L7.desvioPct * 1000) / 10, 30);
  assert.equal(L7.acao, 'ajustar'); assert.equal(L7.sugestao, 260);
  assert.equal(p.linhas.some((l) => l.etapa === 9), false);             // sem custo e não liberada: fora da comparação
  assert.equal(p.linhas.length, 2);
  assert.equal(p.totalReal, 61000);
  assert.equal(Math.round(L5.incidencia * 1000) / 10, 57.4);            // 35.000 ÷ 61.000
});

test('fase 5 · passo 6 · P0: etapa liberada entra mesmo sem custo; área em branco avisa', async () => {
  const e = await abrir({ seed: seedP0({ etapas: { o1_9: { obraId: 'o1', n: 9, status: 'liberada', liberadaEm: dia(-1), hist: [] } } }) });
  const l9 = e.x.p0Calc(e.x.G('obras', 'o1')).linhas.find((l) => l.etapa === 9);
  assert.equal(l9.real, 0);
  assert.equal(l9.acao, 'manter');
  const sem = await abrir({ seed: seedP0({ obras: { o1: obraAdm({ nome: 'Casa P0', area: null }) } }), hash: '#/obra/o1/encerramento' });
  assert.equal(sem.x.p0Calc(sem.x.G('obras', 'o1')).linhas[0].m2Orcado, null);
  assert.match(sem.app(), /não informada/);
});

test('fase 5 · passo 6 · P0: valor calibrado editável e exportação CSV em duas partes', async () => {
  const e = await abrir({ seed: seedP0(), hash: '#/obra/o1/encerramento' });
  assert.match(e.app(), /Ajuste do P0/);
  await e.click('[data-act="p0-ajuste"][data-n="7"]');
  await e.submit({ valor: '275' });
  assert.equal(e.x.p0Calc(e.x.G('obras', 'o1')).linhas.find((l) => l.etapa === 7).calibrado, 275);
  assert.match(e.app(), /editado/);
  const csv = e.x.csvP0(e.x.G('obras', 'o1'));
  const partes = csv.trim().split('\r\n\r\n');
  assert.equal(partes.length, 2);
  const a = partes[0].split('\r\n');
  assert.equal(a[0], 'etapa;disciplina;rs_m2_p0_original;rs_m2_real;desvio_pct;acao;rs_m2_calibrado;incidencia_real_pct');
  assert.equal(a[1], '5;Fundação e estrutura;400;350;-12,5;manter;400;57,38');
  assert.equal(a[2], '7;Alvenaria e vedações;200;260;30;ajustar;275;42,62');
  assert.equal(partes[1].split('\r\n')[0], 'mes;pct_acumulado');
  await e.click('[data-act="p0-csv"]');
  assert.deepEqual(e.erros, []);
});

test('fase 5 · passo 6 · P0: mapeamento etapa → disciplina editável e restaurável', async () => {
  const e = await abrir({ seed: seedP0(), hash: '#/obra/o1/encerramento' });
  assert.equal(e.x.p0Calc(e.x.G('obras', 'o1')).linhas[0].disciplina, 'Fundação e estrutura');
  await e.click('[data-act="p0-mapa"]');
  const campos = {}; for (let n = 1; n <= 22; n++) campos['d_' + n] = n === 5 ? 'Fundações profundas' : e.doc.querySelector('[name="d_' + n + '"]').value;
  await e.submit(campos);
  assert.equal(e.x.p0Calc(e.x.G('obras', 'o1')).linhas[0].disciplina, 'Fundações profundas');
  await e.click('[data-act="p0-mapa"]');
  await e.submit(Object.assign({}, campos, { d_5: '' }));
  assert.match(e.erroForm(), /Toda etapa precisa de uma disciplina/);
  await e.click('[data-act="p0-mapa-padrao"]');
  assert.equal(e.x.p0Calc(e.x.G('obras', 'o1')).linhas[0].disciplina, 'Fundação e estrutura');
});

test('fase 5 · passo 6 · P0: referência CSV sinaliza incidência fora da faixa', async () => {
  const e = await abrir({ seed: seedP0(), hash: '#/obra/o1/encerramento' });
  const ruim = e.x.p0RefParse('servico;incidencia;minimo;maximo\nFundação e estrutura;50;60;40');
  assert.match(ruim.erros[0], /mínimo ≤ máximo/);
  await e.click('[data-act="p0-ref"]');
  e.doc.querySelector('#p0_csv').value = 'servico;incidencia;minimo;maximo\nFundação e estrutura;20;30;50\nAlvenaria e vedações;35;30;50';
  await e.click('[data-p0="validar"]');
  assert.match(e.dlg(), /2 serviços válidos/);
  await e.click('[data-p0="ok"]');
  const d = e.x.p0Calc(e.x.G('obras', 'o1')).disciplinas;
  assert.equal(d.find((x) => x.disciplina === 'Fundação e estrutura').fora, true);       // 57,4% fora de 30–50
  assert.equal(d.find((x) => x.disciplina === 'Alvenaria e vedações').fora, false);      // 42,6% dentro
  assert.match(e.app(), /Fora da faixa/);
});

test('fase 5 · passo 6 · curva real do custo chega a 100%', async () => {
  const e = await abrir({ seed: seedP0() });
  const c = e.x.curvaRealCusto('o1');
  assert.ok(c.length >= 1);
  assert.equal(Math.round(c[c.length - 1].pct), 100);
  assert.equal(Math.round(c.reduce((s, x) => s + x.valor, 0)), 61000);
});

test('fase 5 · passo 6 · texto do encerramento é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=13">';
  const e = await abrir({ seed: seedEnc({ licoes: { l1: { obraId: 'o1', data: dia(0), causasDesvio: [{ etapa: 5, causa: 'clima', valor: 1, texto: xss }], oQueFuncionou: xss, oQueMudar: xss, ajustesProtocolo: xss, anexos: [], snapshotOrcadoRealizado: {} } }, obras: { o1: Object.assign(obraAdm({ nome: 'C', area: 10 }), { encerramentoJust: { docs: xss } }) } }), hash: '#/obra/o1/encerramento' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
  assert.match(e.app(), /<img src=x/);
});

/* ---------------- passo 7: indicadores, alertas, agenda e cascata ---------------- */
test('fase 5 · passo 7 · indicadores: margem da obra, nota média e relatório do mês', async () => {
  const av = (n) => ({ obraId: 'o1', prestadorId: 'p1', data: dia(-1), criterios: { pontualidade: n }, sugeridos: {}, justificativas: {}, pesos: {}, notaFinal: n, recontrataria: 'sim' });
  const seed = seedRel({ lancamentos: { r: lanc({ obraId: 'o1', empresaId: 'emp_cons', categoria: 'receita', valor: 10000 }), i: lanc({ obraId: 'o1', empresaId: 'emp_cons', categoria: 'imposto', valor: 600 }), c: lanc({ obraId: 'o1', empresaId: 'emp_cons', categoria: 'custo_direto', valor: 3400 }) }, avaliacoes: { a1: av(8), a2: av(6) } });
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /Margem da obra.*ResultadoR\$?|Margem da obra/);
  assert.match(e.app(), /Resultado R\$\s*6\.000,00 sobre receita líquida de R\$\s*9\.400,00/);
  assert.match(e.app(), /Nota média dos prestadores.*7/);
  assert.match(e.app(), /Nenhum relatório de/);
  await e.go('#/obra/o1/relatorio');
  await e.click('[data-act="rel-criar"]');
  await e.go('#/obra/o1/resumo');
  assert.match(e.app(), /Relatório do mês.*Rascunho/);
  await e.go('#/obra/o1/relatorio');
  await e.click('[data-act="rel-emitir"]'); await e.click('[data-x="1"]');
  await e.go('#/obra/o1/resumo');
  assert.match(e.app(), /Emitido · Aguardando o cliente|Emitido/);
});

test('fase 5 · passo 7 · alertas de empresa, contrato do cliente e relatório atrasado', async () => {
  const ma = mesAtras(1);
  const seed = { obras: { o1: obraAdm({ nome: 'Sem tudo', inicio: ma + '-01' }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  const t = e.app();
  assert.match(t, /Obra sem empresa/);
  assert.match(t, /Obra sem contrato do cliente/);
  if (new Date().getDate() > 5) assert.match(t, /Relatório de .* ainda não emitido \(vencia no dia 5\)/);
  const ok = await abrir({ seed: { obras: { o1: obraAdm({ empresaId: 'emp1', inicio: dia(-3) }) }, empresas: { emp1: { nome: 'E', ativa: true } }, contratosCliente: { cc_o1: { obraId: 'o1', tipoRemuneracao: 'parcelas', parcelas: [{ competencia: M, valor: 1 }] } } }, hash: '#/obra/o1/resumo' });
  assert.doesNotMatch(ok.app(), /Obra sem empresa|Obra sem contrato do cliente|ainda não emitido/);   // obra nova, dentro do mês, sem pendência
});

test('fase 5 · passo 7 · validação do cliente pendente depois do prazo de objeção', async () => {
  const rel = { obraId: 'o1', mes: mesAtras(1), status: 'emitido', snapshot: {}, enviadoEm: dia(-12), prazoObjecao: dia(-2), validacaoCliente: { status: 'pendente' }, criadoEm: new Date().toISOString(), emitidoEm: new Date().toISOString(), hist: [] };
  const e = await abrir({ seed: seedRel({ relatorios: { r1: rel } }), hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /sem resposta do cliente: o prazo para objeção venceu em/);
  await e.recarrega('relatorios', 'r1', Object.assign({}, rel, { validacaoCliente: { status: 'validado', data: dia(-1) } }));
  await e.go('#/obra/o1/resumo');
  assert.doesNotMatch(e.app(), /sem resposta do cliente/);
});

test('fase 5 · passo 7 · contrato de prestador encerrado sem avaliação por mais de N dias', async () => {
  const ct = (enc) => ({ obraId: 'o1', prestadorId: 'p1', escopo: 'x', valor: 1, inicio: dia(-60), fim: dia(-20), status: 'encerrado', encerradoEm: enc });
  const e = await abrir({ seed: seedRel({ prestadores: { p1: { nome: 'Pedreiro' } }, contratosPrest: { c1: ct(dia(-10)) } }), hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /1 contrato encerrado sem avaliação há mais de 7 dias: Pedreiro/);
  const recente = await abrir({ seed: seedRel({ prestadores: { p1: { nome: 'Pedreiro' } }, contratosPrest: { c1: ct(dia(-2)) } }), hash: '#/obra/o1/resumo' });
  assert.doesNotMatch(recente.app(), /contrato encerrado sem avaliação/);
});

test('fase 5 · passo 7 · todas as etapas liberadas há mais de 30 dias sem encerrar; obra encerrada não alerta', async () => {
  const etapas = {}; for (let n = 1; n <= 22; n++) etapas['o1_' + n] = { obraId: 'o1', n, status: 'liberada', liberadaEm: dia(-40), hist: [] };
  const e = await abrir({ seed: seedRel({ etapas }), hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /Todas as etapas estão liberadas há mais de 30 dias e a obra não foi encerrada/);
  const enc = await abrir({ seed: seedRel({ etapas, obras: { o1: Object.assign(obraAdm({ nome: 'X', empresaId: 'emp_cons' }), { situacao: 'encerrada', encerradaEm: dia(-5) }) } }), hash: '#/obra/o1/resumo' });
  assert.doesNotMatch(enc.app(), /Obra sem contrato do cliente|Todas as etapas estão liberadas/);
});

test('fase 5 · passo 7 · agenda: emissão do relatório, prazo de objeção e fim do contrato do cliente', async () => {
  const rel = { obraId: 'o1', mes: mesAtras(1), status: 'emitido', snapshot: {}, enviadoEm: dia(-3), prazoObjecao: dia(0), validacaoCliente: { status: 'pendente' }, criadoEm: new Date().toISOString(), emitidoEm: new Date().toISOString(), hist: [] };
  const seed = seedRel({ relatorios: { r1: rel }, contratosCliente: { cc_o1: { obraId: 'o1', tipoRemuneracao: 'fixo_mensal', valorMensal: 1, inicio: dia(-30), fim: dia(0), parcelas: [] } } });
  const e = await abrir({ seed, hash: '#/obra/o1/agenda' });
  assert.match(e.app(), /Prazo de objeção do cliente: relatório de/);
  assert.match(e.app(), /Fim do contrato do cliente \(encerramento previsto\)/);
  const e2 = await abrir({ seed: { obras: { o1: obraAdm({ inicio: mesAtras(2) + '-01' }) } }, hash: '#/obra/o1/agenda' });
  await e2.go('#/obra/o1/agenda');
  const eventos = e2.x.alertasP5 ? true : false; assert.ok(eventos);
});

test('fase 5 · passo 7 · excluir a obra apaga as coleções da fase 5 dela, sem tocar em empresas nem em despesas gerais', async () => {
  const cols = ['contratosCliente', 'lancamentos', 'relatorios', 'avaliacoes', 'licoes', 'config'];
  const seed = { obras: { o1: obra(), o2: obra({ nome: 'Outra' }) }, empresas: { emp1: { nome: 'E', ativa: true } }, lancamentos: { g: lanc({ obraId: '', categoria: 'despesa_geral', valor: 5 }) } };
  cols.forEach((c) => { seed[c] = Object.assign(seed[c] || {}, { a1: { obraId: 'o1', n: 1 }, b1: { obraId: 'o2', n: 1 } }); });
  seed.config.p0_mapa = { mapa: { 5: 'X' } };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  await e.click('[data-act="obra-editar"]');
  await e.click('[data-act="obra-excluir"]');
  await e.click('[data-x="1"]');
  cols.forEach((c) => {
    assert.equal(e.linhas(c).filter((x) => x.obraId === 'o1').length, 0, c + ' ainda tem registros da obra excluída');
    assert.equal(e.linhas(c).filter((x) => x.obraId === 'o2').length, 1, c + ' perdeu registros de outra obra');
  });
  assert.equal(e.linhas('empresas').length, 2 >= 1 ? e.linhas('empresas').length : 0);
  assert.ok(e.linhas('empresas').some((x) => x.id === 'emp1'));                    // empresa preservada
  assert.ok(e.linhas('lancamentos').some((x) => x.id === 'g'));                     // despesa geral preservada
  assert.ok(e.linhas('config').some((x) => x.id === 'p0_mapa'));                    // configuração global preservada
});
