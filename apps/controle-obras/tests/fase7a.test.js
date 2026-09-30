'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, dia } = require('./helpers');

const seed = () => ({
  obras: { o1: obra({ nome: 'Casa Teste' }) },
  prestadores: { p1: { nome: 'João Pedreiro', contato: '(15) 99999-1234' } },
  ocorrencias: { oc1: { obraId: 'o1', tipo: 'apontamento', gravidade: 'media', descricao: 'Rejunte falhado', local: 'Sala', prestadorId: 'p1', prazo: dia(-2), status: 'aberta', interacoes: [] } },
  acoes: { a1: { obraId: 'o1', descricao: 'Confirmar o concreto', responsavel: 'Ana', prazo: dia(3), status: 'aberta', interacoes: [] } }
});

test('whatsapp · telefone é normalizado e inválido é recusado', async () => {
  const e = await abrir({ seed: seed() });
  assert.equal(e.x.waFone('(15) 99999-1234'), '5515999991234');
  assert.equal(e.x.waFone('15 3251-1234'), '551532511234');
  assert.equal(e.x.waFone('+55 15 99999-1234'), '5515999991234');
  assert.equal(e.x.waFone('1234'), '');
  assert.equal(e.x.waFone(''), '');
});

test('whatsapp · link wa.me codifica o texto', async () => {
  const e = await abrir({ seed: seed() });
  const l = e.x.waLink('5515999991234', 'Olá! Tudo bem?\nObrigado');
  assert.equal(l, 'https://wa.me/5515999991234?text=' + encodeURIComponent('Olá! Tudo bem?\nObrigado'));
});

test('whatsapp · mensagem da ocorrência vencida cita obra, apontamento e prazo, sem valores', async () => {
  const e = await abrir({ seed: seed() });
  const t = e.x.waTexto('ocorrencias', Object.assign({ id: 'oc1' }, seed().ocorrencias.oc1));
  assert.match(t, /João Pedreiro/);
  assert.match(t, /Casa Teste/);
  assert.match(t, /Rejunte falhado/);
  assert.match(t, /ainda está em aberto/);
  assert.doesNotMatch(t, /R\$/);
});

test('whatsapp · enviar abre o link e registra o contato no histórico da ocorrência', async () => {
  const e = await abrir({ seed: seed() });
  const abertos = []; e.win.open = (u) => { abertos.push(u); return {}; };
  e.x.waForm('ocorrencias', 'oc1');
  await e.tick(100);
  assert.match(e.dlg(), /Enviar pelo WhatsApp/);
  assert.equal(e.doc.querySelector('#dform [name="fone"]').value, '(15) 99999-1234');
  await e.submit({ fone: '123' });
  assert.match(e.erroForm(), /Telefone inválido/);
  assert.equal(abertos.length, 0);
  await e.submit({ fone: '(15) 99999-1234' });
  assert.equal(abertos.length, 1);
  assert.match(abertos[0], /^https:\/\/wa\.me\/5515999991234\?text=/);
  const oc = e.linhas('ocorrencias')[0];
  assert.equal(oc.interacoes.length, 1);
  assert.equal(oc.interacoes[0].canal, 'WhatsApp');
  assert.match(oc.interacoes[0].texto, /Rejunte falhado/);
});

test('whatsapp · ação pede o telefone (responsável é texto livre) e registra o contato', async () => {
  const e = await abrir({ seed: seed() });
  const abertos = []; e.win.open = (u) => { abertos.push(u); return {}; };
  e.x.waForm('acoes', 'a1');
  await e.tick(100);
  assert.equal(e.doc.querySelector('#dform [name="fone"]').value, '');
  await e.submit({ fone: '15 98888-7777' });
  assert.equal(abertos.length, 1);
  assert.equal(e.linhas('acoes')[0].interacoes.length, 1);
});

test('whatsapp · botões aparecem nas ocorrências e nas ações', async () => {
  const e = await abrir({ seed: seed(), hash: '#/obra/o1/reunioes' });
  assert.ok(e.doc.querySelector('[data-act="acao-whats"]'));
});

test('avisos · preferências: carregam o padrão, salvam e respeitam o desligado', async () => {
  const e = await abrir({ supa: { seed: { obras: { o1: { obra_id: 'o1', dados: obra() } } } }, hash: '#/avisos' });
  assert.match(e.app(), /Preferências de aviso/);
  const f = e.doc.getElementById('fpref').elements;
  assert.equal(f.email.checked, true);
  assert.equal(f.ini.value, '20:00');
  f.email.checked = false; f.resumo.checked = false; f.ini.value = '22:00'; f.fim.value = '06:30';
  e.doc.getElementById('fpref').dispatchEvent(new e.win.Event('submit', { bubbles: true, cancelable: true }));
  await e.tick(200);
  const l = e.supa.linhas('notificacao_preferencias')[0];
  assert.deepEqual(l.canais, ['app']);
  assert.equal(l.resumo_diario, false);
  assert.equal(l.silencio_ini, '22:00');
  assert.match(e.doc.getElementById('toast').textContent, /Preferências salvas/);
});
