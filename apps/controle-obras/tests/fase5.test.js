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
