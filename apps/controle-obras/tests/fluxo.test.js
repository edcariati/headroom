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
