'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, obraAdm, dia } = require('./helpers');

const orc = (oid, total) => ({ orcamentos: { b1: { obraId: oid, versao: 1, data: dia(-5), total, nItens: 1, lotes: 1, porEtapa: { 5: total }, porTipo: { empreitada: total } } }, orcItens: { b1_0: { obraId: oid, orcId: 'b1', lote: 0, itens: [{ codigo: 'I1', etapa: 5, descricao: 'x', unidade: 'vb', quantidade: 1, precoUnitario: total, tipo: 'empreitada', total }] } } });

test('dashboard · sem obras não mostra painel de indicadores', async () => {
  const e = await abrir({ hash: '#/painel' });
  assert.equal(e.doc.querySelector('.dash'), null);
  assert.match(e.app(), /Nenhuma obra cadastrada/);
});

test('dashboard · mostra as perspectivas e conta obras em andamento e encerradas', async () => {
  const seed = { obras: { o1: obra({ nome: 'A' }), o2: obraAdm({ nome: 'B' }), o3: obra({ nome: 'C', situacao: 'encerrada' }) } };
  const e = await abrir({ seed, hash: '#/painel' });
  const t = e.app();
  ['Prazo e execução', 'Qualidade em campo', 'Financeiro', 'Prestadores', 'Cliente', 'Obras lado a lado'].forEach((s) => assert.match(t, new RegExp(s)));
  const d = e.x.dashDados();
  assert.equal(d.n, 2); assert.equal(d.nEnc, 1);
  assert.match(t, /Obras em andamento\s*2\s*1 encerrada/);
});

test('dashboard · ocorrências, apontamentos vencidos e alertas somam as obras em andamento', async () => {
  const seed = { obras: { o1: obra({ nome: 'A' }), o2: obra({ nome: 'B' }), o3: obra({ nome: 'Enc', situacao: 'encerrada' }) },
    ocorrencias: { c1: { obraId: 'o1', gravidade: 'critica', status: 'aberta' }, c2: { obraId: 'o1', gravidade: 'media', status: 'aberta', prazo: dia(-3) }, c3: { obraId: 'o2', gravidade: 'simples', status: 'fechada' }, c4: { obraId: 'o3', gravidade: 'critica', status: 'aberta' } } };
  const e = await abrir({ seed, hash: '#/painel' });
  const d = e.x.dashDados();
  assert.equal(d.ocAb, 2); assert.equal(d.ocCr, 1); assert.equal(d.ocVenc, 1);
  assert.match(e.app(), /Ocorrências abertas\s*2\s*1 crítica/);
  assert.match(e.app(), /Apontamentos vencidos\s*1/);
});

test('dashboard · PPC e conformidade das fichas', async () => {
  const seed = { obras: { o1: obra({ nome: 'A' }) },
    fichas: { f1: { obraId: 'o1', resultado: 'aprovado' }, f2: { obraId: 'o1', resultado: 'aprovado' }, f3: { obraId: 'o1', resultado: 'reprovado' }, f4: { obraId: 'o1', resultado: 'aprovado' } } };
  const e = await abrir({ seed, hash: '#/painel' });
  assert.equal(Math.round(e.x.dashDados().conf), 75);
  assert.match(e.app(), /Conformidade das fichas \??\s*75%/);
});

test('dashboard · valores em R$ aparecem para a diretoria e somem para o perfil campo', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm({ nome: 'A' }) }, contasPagar: { c1: { obraId: 'o1', status: 'aberta', valor: 8400, vencimento: dia(-2) } } }, orc('o1', 255000));
  const e = await abrir({ seed, hash: '#/painel' });
  assert.match(e.app(), /Financeiro/); assert.match(e.app(), /Orçamento revisado/); assert.match(e.app(), /Contas vencidas\s*1\s*R\$ 8,4 mil/);
  // campo: sem a seção financeira, sem CPI, sem nenhum "R$"
  const c = await abrir({ supa: { seed: { obras: { o1: { obra_id: 'o1', dados: obraAdm({ nome: 'A' }) } }, contasPagar: { c1: { obra_id: 'o1', dados: { obraId: 'o1', status: 'aberta', valor: 8400, vencimento: dia(-2) } } } }, perfil: { papel: 'campo' } }, hash: '#/painel' });
  const dash = c.doc.querySelector('.dash').textContent;
  assert.doesNotMatch(dash, /Financeiro|Orçamento revisado|CPI|R\$/);
  assert.match(dash, /Prazo e execução/);
});

test('dashboard · texto vindo dos dados é escapado', async () => {
  const seed = { obras: { o1: obra({ nome: '<img src=x onerror="window.__d=1">' }) } };
  const e = await abrir({ seed, hash: '#/painel' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null); assert.equal(e.win.__d, undefined);
});

test('dashboard · satisfação e chamados de garantia entram no bloco Cliente', async () => {
  const seed = { obras: { o1: obra({ nome: 'A', entregueEm: dia(-100) }) }, pesquisasSatisfacao: { o1_entrega: { obraId: 'o1', marco: 'entrega', notas: { recomendacao: 8 } } },
    chamadosGarantia: { c1: { obraId: 'o1', status: 'aberto', criadoEm: dia(-9) + 'T10:00:00Z', slaRespDias: 3, slaResDias: 30 } } };
  const e = await abrir({ seed, hash: '#/painel' });
  assert.match(e.app(), /Satisfação do cliente\s*8/); assert.match(e.app(), /Chamados de garantia abertos\s*1\s*1 fora do prazo/);
});
