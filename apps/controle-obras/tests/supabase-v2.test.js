'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, dia } = require('./helpers');

const seedObra = () => ({ obras: { o1: { obra_id: 'o1', dados: obra() } } });

test('supabase v2 · sem login mostra a tela de entrada', async () => {
  const e = await abrir({ supa: { session: false } });
  assert.match(e.app(), /Entrar/);
});

test('supabase v2 · login sem perfil mostra “acesso ainda não liberado”', async () => {
  const e = await abrir({ supa: { perfil: null } });
  assert.match(e.app(), /acesso ainda não foi liberado/);
  assert.doesNotMatch(e.app(), /Casa Teste/);
});

test('supabase v2 · perfil desativado também não entra', async () => {
  const e = await abrir({ supa: { perfil: { ativo: false } } });
  assert.match(e.app(), /acesso ainda não foi liberado/);
});

test('supabase v2 · carrega as obras das tabelas e ignora registros excluídos', async () => {
  const seed = seedObra(); seed.obras.o2 = { obra_id: 'o2', excluido_em: '2026-01-01', dados: obra({ nome: 'Obra Apagada' }) };
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  assert.match(e.app(), /Casa Teste/);
  assert.doesNotMatch(e.app(), /Obra Apagada/);
});

test('supabase v2 · criar grava na tabela da coleção com obra_id e versão 1', async () => {
  const e = await abrir({ supa: { seed: seedObra() }, hash: '#/obra/o1/ocorrencias' });
  await e.win.eval("1"); // garante o ambiente
  const id = await e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Concretagem' });
  await e.tick(200);
  const l = e.supa.linhas('diarios');
  assert.equal(l.length, 1);
  assert.equal(l[0].obra_id, 'o1');
  assert.equal(l[0].versao, 1);
  assert.equal(l[0].dados.texto, 'Concretagem');
  assert.equal(l[0].dados.id, undefined);
  assert.ok(id);
});

test('supabase v2 · editar usa a versão conhecida e incrementa', async () => {
  const e = await abrir({ supa: { seed: { ...seedObra(), diarios: { d1: { obra_id: 'o1', dados: { obraId: 'o1', data: dia(0), texto: 'a' } } } } } });
  await e.x.Store.patch('diarios', 'd1', { texto: 'b' });
  await e.tick(200);
  const l = e.supa.linhas('diarios')[0];
  assert.equal(l.dados.texto, 'b');
  assert.equal(l.versao, 2);
  await e.x.Store.patch('diarios', 'd1', { texto: 'c' });
  await e.tick(200);
  assert.equal(e.supa.linhas('diarios')[0].versao, 3);
});

test('supabase v2 · conflito: se outra pessoa gravou antes, não sobrescreve e recarrega', async () => {
  const e = await abrir({ supa: { seed: { ...seedObra(), diarios: { d1: { obra_id: 'o1', dados: { obraId: 'o1', data: dia(0), texto: 'a' } } } } } });
  e.supa.outraPessoaGrava('diarios', 'd1', { obraId: 'o1', data: dia(0), texto: 'da outra pessoa' });
  await e.x.Store.patch('diarios', 'd1', { texto: 'minha' });
  await e.tick(250);
  assert.equal(e.supa.linhas('diarios')[0].dados.texto, 'da outra pessoa');
  assert.match(e.doc.getElementById('toast').textContent, /alterado por outra pessoa/);
  assert.equal(e.x.Store.data.diarios.get('d1').texto, 'da outra pessoa');
});

test('supabase v2 · excluir chama a função do servidor (nunca DELETE físico)', async () => {
  const e = await abrir({ supa: { seed: { ...seedObra(), diarios: { d1: { obra_id: 'o1', dados: { obraId: 'o1' } } } } } });
  await e.x.Store.del('diarios', 'd1');
  await e.tick(200);
  assert.ok(e.supa.log.some((x) => x.t === 'rpc:excluir_registro' && x.payload.tab === 'diarios' && x.payload.rid === 'd1'));
  assert.ok(!e.supa.log.some((x) => x.op === 'delete'));
  assert.ok(e.supa.linhas('diarios')[0].excluido_em);
});

test('supabase v2 · mudança de outra pessoa (Realtime) aparece e exclusão remove', async () => {
  const e = await abrir({ supa: { seed: seedObra() }, hash: '#/painel' });
  assert.equal(e.supa.canais(), 1);
  e.supa.emite('obras', { id: 'o9', obra_id: 'o9', dados: obra({ nome: 'Obra Nova Remota' }), versao: 1, excluido_em: null });
  await e.tick(150);
  assert.match(e.app(), /Obra Nova Remota/);
  e.supa.emite('obras', { id: 'o9', obra_id: 'o9', dados: obra({ nome: 'Obra Nova Remota' }), versao: 2, excluido_em: '2026-09-01' });
  await e.tick(150);
  assert.doesNotMatch(e.app(), /Obra Nova Remota/);
});

test('supabase v2 · perfil leitura/cliente não grava e explica', async () => {
  const e = await abrir({ supa: { seed: seedObra(), perfil: { papel: 'leitura' } } });
  await e.x.Store.add('diarios', { obraId: 'o1' });
  await e.tick(150);
  assert.equal(e.supa.linhas('diarios').length, 0);
  assert.match(e.doc.getElementById('toast').textContent, /somente leitura/);
});

test('supabase v2 · erro de permissão do servidor vira mensagem clara', async () => {
  const e = await abrir({ supa: { seed: seedObra(), falhaEm: 'diarios' } });
  e.supa.cli.from('diarios'); // garante a tabela
  await e.x.Store.add('diarios', { obraId: 'o1' });
  await e.tick(200);
  assert.match(e.doc.getElementById('toast').textContent, /Não foi possível salvar/);
});

test('supabase v2 · falha ao carregar uma tabela avisa, mas o app abre', async () => {
  const e = await abrir({ supa: { seed: seedObra(), falhaEm: 'fichas' } });
  assert.match(e.doc.getElementById('toast').textContent, /carregar parte dos dados/);
  assert.match(e.app(), /Casa Teste/);
});

test('supabase v2 · nenhum segredo: o app nunca usa a chave service_role', async () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./);
  assert.doesNotMatch(html, /sb_secret_[A-Za-z0-9]/);
});
