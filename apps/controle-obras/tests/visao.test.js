'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obraAdm, dia } = require('./helpers');

const seed = (extra) => Object.assign({
  obras: { o1: obraAdm({ nome: 'Casa Alfa', inicio: dia(-60) }) },
  orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-5), motivo: 'Base', total: 1000, nItens: 2, lotes: 1, porEtapa: { 5: 600, 7: 400 }, porTipo: { material: 700, mao_de_obra: 300 } } },
  orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [
    { codigo: '5.01', etapa: 5, descricao: 'Concreto', unidade: 'm³', quantidade: 2, precoUnitario: 300, tipo: 'material', prestador: '', prestadorId: '', total: 600 },
    { codigo: '7.01', etapa: 7, descricao: 'Bloco cerâmico', unidade: 'un', quantidade: 100, precoUnitario: 3, tipo: 'material', prestador: '', prestadorId: '', total: 300 },
    { codigo: '7.02', etapa: 7, descricao: 'Pedreiro', unidade: 'm²', quantidade: 10, precoUnitario: 10, tipo: 'mao_de_obra', prestador: '', prestadorId: '', total: 100 }] } },
  atividades: {
    a1: { obraId: 'o1', nome: 'Fundação', etapa: 5, prestadorId: 'p1', inicio: dia(-30), fim: dia(-3), avanco: 40 },
    a2: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, prestadorId: 'p1', inicio: dia(3), fim: dia(30), avanco: 0 } },
  prestadores: { p1: { nome: 'Fulano' } },
  fornecedores: { f1: { nome: 'Forn Um' } },
  compras: {
    c1: { obraId: 'o1', item: 'Concreto', etapa: 5, status: 'pedido', dataUso: dia(2), pedido: { total: 300, fornecedorId: 'f1', data: dia(-10), entregaPrevista: dia(-2) } },
    c2: { obraId: 'o1', item: 'Aço', etapa: 5, status: 'necessidade', dataUso: dia(10), prazoEntrega: 15 },
    c3: { obraId: 'o1', item: 'Areia', etapa: 5, status: 'pedido', dataUso: dia(20), pedido: { total: 80, fornecedorId: 'f1', data: dia(-1), entregaPrevista: dia(5) } } },
  contasPagar: {
    cp1: { obraId: 'o1', origem: 'outro', origemId: 'x', descricao: 'Vencida', valor: 100, status: 'aberta', vencimento: dia(-3) },
    cp2: { obraId: 'o1', origem: 'outro', origemId: 'y', descricao: 'Em 10 dias', valor: 200, status: 'aberta', vencimento: dia(10) } },
  aportes: { ap1: { obraId: 'o1', descricao: 'Parcela 2', valorPrevisto: 5000, dataPrevista: dia(12) } }
}, extra || {});

test('visão geral · leitura rápida, matriz de prazos, visão por obra e indicadores', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao' });
  const t = e.app();
  ['Leitura rápida', 'O que vence nos próximos dias', 'Visão por obra', 'Itens em execução', 'Etapas em atraso', 'Evolução', 'Indicadores'].forEach((s) => assert.match(t, new RegExp(s)));
  ['7 dias', '15 dias', '30 dias', '90 dias', '120 dias'].forEach((s) => assert.match(t, new RegExp(s)));
  assert.match(t, /Casa Alfa/);
  assert.ok(e.doc.querySelector('#app a[href="#/visao"]'), 'link no menu');
  assert.equal(e.erros.length, 0, e.erros.join('|'));
});

test('visão geral · linha do tempo conta entregas, pedir até, pagamentos e aportes por horizonte', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao' });
  const T = e.x.vgTimeline([e.x.G('obras', 'o1')]);
  const n = (cat, h) => T.filter((x) => x.cat === cat && x.data <= dia(h)).length;
  assert.equal(n('entrega', 7), 1);           // Areia em 5 dias
  assert.equal(n('pag', 7), 0); assert.equal(n('pag', 15), 1);
  assert.equal(n('aporte', 7), 0); assert.equal(n('aporte', 15), 1);
  assert.ok(n('etapa-ini', 7) >= 1);          // alvenaria começa em 3 dias
});

test('visão geral · atrasos: etapa atrasada, atividade, entrega, pedir até e pagamento vencido', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao' });
  const A = e.x.vgAtrasos([e.x.G('obras', 'o1')]);
  assert.equal(A.etapas.filter((x) => x.e.sit === 'atrasada').length, 1);
  assert.equal(A.ativ.length, 1); assert.equal(A.entregas.length, 1); assert.equal(A.pagos.length, 1);
  assert.ok(A.pedir.length >= 1);
  assert.match(e.app(), /Etapas em atraso ou atrás da meta \(1\)/);
});

test('visão geral · horizonte e filtro de obra mudam a tela', async () => {
  const e = await abrir({ seed: seed({ obras: { o1: obraAdm({ nome: 'Casa Alfa', inicio: dia(-60) }), o2: obraAdm({ nome: 'Casa Beta' }) } }), hash: '#/visao' });
  assert.match(e.app(), /Próximos 30 dias/);
  await e.click('[data-act="vg-h"][data-h="90"]');
  assert.match(e.app(), /Próximos 90 dias/);
  const sel = e.doc.querySelector('select[data-chg="vg-obra"]'); sel.value = 'o2'; sel.dispatchEvent(new e.win.Event('change', { bubbles: true })); await e.tick();
  const sec = Array.from(e.doc.querySelectorAll('#app section.card')).filter((s) => /Visão por obra/.test(s.textContent))[0];
  assert.match(sec.textContent, /Casa Beta/); assert.doesNotMatch(sec.textContent, /Casa Alfa/);
});

test('visão geral · etapas e avanço mostra meta, executado e situação por etapa', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao/etapas' });
  const t = e.app();
  assert.match(t, /Casa Alfa/); assert.match(t, /Atrasada/); assert.match(t, /Fundação, estrutura e fechamento|Fundação/);
  assert.match(t, /Meta do cronograma/);
  assert.match(t, /Pago adiante|Atenção|Meta hoje/);
});

test('visão geral · compras: funil, o que comprar no fluxo programado, entregas e fornecedores', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao/compras' });
  const ac = e.x.vgAComprar([e.x.G('obras', 'o1')], 30);
  assert.ok(ac.some((x) => x.n === 7 && x.falta > 0), 'etapa 7 tem material orçado sem compra');
  const t = e.app();
  ['Funil de compras', 'O que comprar no fluxo já programado', 'Bloco cerâmico', 'Entregas esperadas', 'Fornecedores', 'Forn Um'].forEach((s) => assert.match(t, new RegExp(s)));
  const f = e.x.vgFornecedores([e.x.G('obras', 'o1')]).filter((x) => x.id === 'f1')[0];
  assert.equal(f.n, 2); assert.equal(f.atras, 1);
});

test('visão geral · finanças: a pagar por faixa, aportes, por obra e gráficos', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao/financas' });
  const t = e.app();
  ['Financeiro por obra', 'Aportes a receber', 'Pagamentos nos próximos', 'etapas com desvio', 'Vencido'].forEach((s) => assert.match(t, new RegExp(s)));
});

test('visão geral · prazos agrupa por faixa de 7, 15, 30, 90 e 120 dias', async () => {
  const e = await abrir({ seed: seed(), hash: '#/visao/prazos' });
  const t = e.app();
  ['Até 7 dias', '8 a 15 dias', '16 a 30 dias', '31 a 90 dias', '91 a 120 dias'].forEach((s) => assert.match(t, new RegExp(s)));
});

test('visão geral · texto do usuário é escapado', async () => {
  const xss = '<img src=x onerror=alert(1)>';
  const e = await abrir({ seed: seed({ obras: { o1: obraAdm({ nome: xss, inicio: dia(-60) }) } }), hash: '#/visao' });
  assert.equal(e.doc.querySelector('#app img'), null);
  await e.go('#/visao/compras'); assert.equal(e.doc.querySelector('#app img'), null);
});
