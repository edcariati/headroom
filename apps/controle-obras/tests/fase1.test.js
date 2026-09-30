'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, dia, segunda } = require('./helpers');

const fichasAprovadas = (oid, n, qtd) => {
  const o = {};
  for (let i = 0; i < qtd; i++) o[oid + '_' + n + '_' + i] = { obraId: oid, etapa: n, idx: i, item: 'Item ' + i, resultado: 'aprovado', primeira: 'ok', obs: '', fotos: [], hist: [] };
  return o;
};

test('fase 1 · cadastra obra pelo formulário e abre o resumo', async () => {
  const e = await abrir();
  assert.match(e.app(), /Nenhuma obra cadastrada/);
  await e.click('[data-act="obra-nova"]');
  await e.submit({ nome: 'Casa Silva', codigo: 'CA000001', cliente: 'Família Silva', modalidade: 'Administração de Obra', tipologia: 'Sobrado', area: '180', inicio: dia(0) });
  const obras = e.linhas('obras');
  assert.equal(obras.length, 1);
  assert.equal(obras[0].nome, 'Casa Silva');
  assert.equal(obras[0].modalidade, 'Administração de Obra');
  assert.equal(obras[0].metaPPC, 80);
  assert.equal(obras[0].margemPreco, 5);
  assert.match(e.win.location.hash, /^#\/obra\/.+\/resumo$/);
  assert.match(e.app(), /Casa Silva/);
  assert.deepEqual(e.erros, []);
});

test('fase 1 · a etapa só é liberada com fichas, condições e sem ocorrência crítica', async () => {
  const seed = { obras: { o1: obra() }, etapas: { o1_1: { obraId: 'o1', n: 1, status: 'aguardando_vistoria', hist: [], condicoesOk: false } } };
  const e = await abrir({ seed, hash: '#/obra/o1/etapa/1' });
  await e.click('[data-act="etapa-mover"][data-to="liberada"]');
  assert.match(e.dlg(), /Ficha sem inspeção/);
  assert.match(e.dlg(), /Condições de liberação/);
  assert.equal(e.linhas('etapas')[0].status, 'aguardando_vistoria');
});

test('fase 1 · libera a etapa quando tudo está em ordem', async () => {
  const seed = { obras: { o1: obra() }, fichas: fichasAprovadas('o1', 1, 5), etapas: { o1_1: { obraId: 'o1', n: 1, status: 'aguardando_vistoria', hist: [], condicoesOk: true } } };
  const e = await abrir({ seed, hash: '#/obra/o1/etapa/1' });
  await e.click('[data-act="etapa-mover"][data-to="liberada"]');
  const et = e.linhas('etapas')[0];
  assert.equal(et.status, 'liberada');
  assert.equal(et.liberadaEm, dia(0));
});

test('fase 1 · ocorrência crítica aberta bloqueia a liberação', async () => {
  const seed = {
    obras: { o1: obra() }, fichas: fichasAprovadas('o1', 1, 5),
    etapas: { o1_1: { obraId: 'o1', n: 1, status: 'aguardando_vistoria', hist: [], condicoesOk: true } },
    ocorrencias: { c1: { obraId: 'o1', etapa: 1, tipo: 'apontamento', gravidade: 'critica', descricao: 'Fissura', status: 'aberta', prazo: dia(3), interacoes: [], criadoEm: new Date().toISOString() } }
  };
  const e = await abrir({ seed, hash: '#/obra/o1/etapa/1' });
  await e.click('[data-act="etapa-mover"][data-to="liberada"]');
  assert.match(e.dlg(), /ocorrência crítica aberta/);
  assert.equal(e.linhas('etapas')[0].status, 'aguardando_vistoria');
});

test('fase 1 · iniciar antes da etapa anterior exige justificativa', async () => {
  const seed = { obras: { o1: obra() } };
  const e = await abrir({ seed, hash: '#/obra/o1/etapa/2' });
  await e.click('[data-act="etapa-mover"][data-to="em_execucao"]');
  await e.submit({ j: '' });
  assert.match(e.erroForm(), /justificativa/i);
  await e.submit({ j: 'Cliente pediu antecipar a mobilização' });
  const et = e.linhas('etapas').find((x) => x.n === 2);
  assert.equal(et.status, 'em_execucao');
  assert.match(et.hist[0].nota, /Exceção: Cliente pediu/);
});

test('fase 1 · ficha reprovada abre apontamento automático com prazo de 7 dias', async () => {
  const seed = { obras: { o1: obra() } };
  const e = await abrir({ seed, hash: '#/obra/o1/etapa/1' });
  await e.click('[data-act="ficha"][data-i="0"]');
  await e.submit({ resultado: 'reprovado', obs: 'Relatório sem assinatura', abrirOc: 'sim' });
  const f = e.linhas('fichas')[0];
  assert.equal(f.resultado, 'reprovado');
  assert.equal(f.primeira, 'nok');
  const oc = e.linhas('ocorrencias');
  assert.equal(oc.length, 1);
  assert.equal(oc[0].origem, 'ficha');
  assert.equal(oc[0].gravidade, 'importante');
  assert.equal(oc[0].prazo, dia(7));
});

test('fase 1 · ficha "não se aplica" exige explicação', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/etapa/1' });
  await e.click('[data-act="ficha"][data-i="0"]');
  await e.submit({ resultado: 'na', obs: '' });
  assert.match(e.erroForm(), /não se aplica/);
  assert.equal(e.linhas('fichas').length, 0);
});

test('fase 1 · ocorrência só fecha com evidência da reinspeção', async () => {
  const seed = { obras: { o1: obra() }, ocorrencias: { c1: { obraId: 'o1', etapa: 3, tipo: 'apontamento', gravidade: 'simples', descricao: 'Reboco ondulado', status: 'aguardando_reinspecao', prazo: dia(2), interacoes: [], criadoEm: new Date().toISOString() } } };
  const e = await abrir({ seed, hash: '#/obra/o1/ocorrencias' });
  await e.click('[data-act="oc-mover"][data-to="fechada"]');
  await e.submit({ evidencia: '' });
  assert.match(e.erroForm(), /evidência/);
  await e.submit({ evidencia: 'Reinspecionado em campo, dentro da tolerância.' });
  const oc = e.linhas('ocorrencias')[0];
  assert.equal(oc.status, 'fechada');
  assert.ok(oc.fechadaEm);
});

test('fase 1 · linha de base congelada exige motivo para mudar datas', async () => {
  const seed = { obras: { o1: obra() }, atividades: { a1: { obraId: 'o1', nome: 'Locação', etapa: 3, inicio: dia(0), fim: dia(4), avanco: 0 } } };
  const e = await abrir({ seed, hash: '#/obra/o1/cronograma' });
  await e.click('[data-act="base-congelar"]');
  await e.click('[data-x="1"]');
  const o = e.linhas('obras')[0];
  assert.equal(o.baseVersao, 1);
  assert.deepEqual(e.linhas('atividades')[0].base, { inicio: dia(0), fim: dia(4) });
  await e.click('[data-act="ativ-editar"][data-id="a1"]');
  await e.submit({ nome: 'Locação', inicio: dia(2), fim: dia(6), motivo: '' });
  assert.match(e.erroForm(), /motivo/i);
  await e.submit({ nome: 'Locação', inicio: dia(2), fim: dia(6), motivo: 'Chuva' });
  const a = e.linhas('atividades')[0];
  assert.equal(a.inicio, dia(2));
  assert.deepEqual(a.base, { inicio: dia(0), fim: dia(4) });
  assert.equal(a.hist[0].motivo, 'Chuva');
});

test('fase 1 · PPC da semana = pacotes concluídos ÷ planejados', async () => {
  const sem = segunda(dia(0));
  const p = (c) => ({ obraId: 'o1', semana: sem, descricao: 'Pacote', concluido: c, causa: c === false ? 'clima' : '' });
  const seed = { obras: { o1: obra() }, pacotes: { p1: p(true), p2: p(true), p3: p(true), p4: p(false) } };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /PPC.*75%/);
  assert.match(e.app(), /3 de 4 pacotes/);
});

test('fase 1 · prestador com seguro vencido não pode ser lançado no efetivo', async () => {
  const seed = { obras: { o1: obra() }, prestadores: { pv: { nome: 'Vencido Ltda', seguro: dia(-1), treinamento: dia(90) }, pok: { nome: 'Em Dia Ltda', seguro: dia(90), treinamento: dia(90) } } };
  const e = await abrir({ seed, hash: '#/obra/o1/diario' });
  await e.click('[data-act="dia-novo"]');
  const ops = Array.from(e.doc.querySelectorAll('select[name="ef_p"] option'));
  const vencido = ops.find((o) => /Vencido/.test(o.textContent));
  const ok = ops.find((o) => /Em Dia/.test(o.textContent));
  assert.ok(vencido.disabled, 'o prestador vencido deve estar desabilitado');
  assert.ok(!ok.disabled);
});

test('fase 1 · alerta de ocorrência crítica e de atividade atrasada no resumo', async () => {
  const seed = {
    obras: { o1: obra() },
    ocorrencias: { c1: { obraId: 'o1', etapa: 5, tipo: 'apontamento', gravidade: 'critica', descricao: 'Ferro exposto', status: 'aberta', prazo: dia(-9), interacoes: [], criadoEm: new Date().toISOString() } },
    atividades: { a1: { obraId: 'o1', nome: 'Escavação', etapa: 5, inicio: dia(-10), fim: dia(-3), avanco: 40 } }
  };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /1 ocorrência crítica aberta/);
  assert.match(e.app(), /1 apontamento vencido/);
  assert.match(e.app(), /deve\(m\) ir à diretoria/);
  assert.match(e.app(), /1 atividade atrasada/);
});

test('fase 1 · texto digitado nunca vira HTML (escape)', async () => {
  const xss = '<img src=x onerror="window.__xss=1">';
  const seed = { obras: { o1: obra({ nome: xss, cliente: xss }) }, ocorrencias: { c1: { obraId: 'o1', etapa: 0, tipo: 'apontamento', gravidade: 'simples', descricao: xss, status: 'aberta', prazo: dia(3), interacoes: [], criadoEm: new Date().toISOString() } } };
  const e = await abrir({ seed, hash: '#/painel' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
  assert.match(e.app(), /<img src=x/);
  await e.go('#/obra/o1/ocorrencias');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.click('[data-act="oc-abrir"]');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});

test('fase 1 · modo somente leitura não mostra botões de edição', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/painel', somenteLeitura: true });
  assert.ok(e.doc.body.classList.contains('ro'));
  assert.match(e.app(), /somente leitura/);
});
