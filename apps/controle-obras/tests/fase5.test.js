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
