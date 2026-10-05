'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra } = require('./helpers');

test('fluxo · mostra 6 fases e 22 etapas sem obra', async () => {
  const e = await abrir({ hash: '#/fluxo' });
  assert.equal(e.doc.querySelectorAll('#app .flx-fase').length, 6);
  assert.equal(e.doc.querySelectorAll('#app .flx-no').length, 22);
  assert.ok(e.doc.querySelector('#app header a[href="#/fluxo"], #app a[href="#/fluxo"]'));
});

test('fluxo · detalhe da etapa mostra a condição de liberação', async () => {
  const e = await abrir({ hash: '#/fluxo/-/5' });
  assert.match(e.app(), /Só libera quando/);
});

test('fluxo · com obra mostra o status por etapa e escapa o nome', async () => {
  const seed = { obras: { o1: obra({ nome: '<img src=x onerror=alert(1)>' }) } };
  const e = await abrir({ seed, hash: '#/fluxo/o1/3' });
  assert.equal(e.doc.querySelectorAll('#app .flx-no').length, 22);
  assert.equal(e.doc.querySelector('#app img'), null);
  assert.match(e.app(), /Abrir na obra/);
});

test('fluxo · ritos de gestão e meta × evolução da etapa aparecem com a obra escolhida', async () => {
  const { obraAdm, dia } = require('./helpers');
  const seed = { obras: { o1: obraAdm({ inicio: dia(-60) }) },
    orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-5), motivo: 'Base', total: 600, nItens: 1, lotes: 1, porEtapa: { 5: 600 }, porTipo: { material: 600 } } },
    orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [{ codigo: '5.01', etapa: 5, descricao: 'Concreto', unidade: 'm³', quantidade: 2, precoUnitario: 300, tipo: 'material', prestador: '', prestadorId: '', total: 600 }] } },
    atividades: { a1: { obraId: 'o1', nome: 'Fundação', etapa: 5, inicio: dia(-20), fim: dia(20), avanco: 30 } },
    compras: { c1: { obraId: 'o1', item: 'Concreto', etapa: 5, status: 'pago', pedido: { total: 400, data: dia(-5) }, conf: { data: dia(-4) } } } };
  const e = await abrir({ seed, hash: '#/fluxo/o1/5' });
  const t = e.app();
  assert.match(t, /Ritos de gestão/);
  assert.match(t, /Relatório quinzenal ao cliente/);
  assert.match(t, /Meta × evolução × pagamentos/);
  assert.match(t, /Desalinhada/);
  assert.match(t, /Final de obra × compras/);
});
