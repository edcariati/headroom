'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, dia, mesAtras } = require('./helpers');

test('fase 2 · alerta crítico de CNO depois de 30 dias sem cadastro', async () => {
  const e = await abrir({ seed: { obras: { o1: obra({ inicio: dia(-35) }) } }, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /sem cadastro no CNO/);
});

test('fase 2 · CNO registrado apaga o alerta', async () => {
  const seed = { obras: { o1: obra({ inicio: dia(-35) }) }, docsLegais: { o1_cno: { obraId: 'o1', tipo: 'cno', numero: '123456', validade: '', anexos: [] } } };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.doesNotMatch(e.app(), /sem cadastro no CNO/);
});

test('fase 2 · documentos mensais em dia aparecem no indicador do prestador', async () => {
  const mes = mesAtras(1), docs = {};
  ['inss', 'fgts', 'folha', 'certidoes'].forEach((k) => { docs['o1_p1_' + mes + '_' + k] = { obraId: 'o1', prestadorId: 'p1', mes, tipo: k, status: 'conferido' }; });
  const seed = { obras: { o1: obra() }, prestadores: { p1: { nome: 'Alvenaria Ltda', seguro: dia(90), treinamento: dia(90) } }, atividades: { a1: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, prestadorId: 'p1', inicio: dia(-2), fim: dia(10), avanco: 10 } }, docsPrest: docs };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /Documentos do prestador em dia.*1 de 1/);
});

test('fase 2 · RFI vencido e decisão de material vencida geram alertas', async () => {
  const seed = { obras: { o1: obra() }, rfis: { r1: { obraId: 'o1', pergunta: 'Cota do baldrame?', destinatario: 'Projetista', prazo: dia(-2), status: 'aberto', criadoEm: new Date().toISOString() } }, materiais: { m1: { obraId: 'o1', item: 'Porcelanato', aprovador: 'Cliente', prazo: dia(-1), resultado: 'pendente' } } };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /1 RFI sem resposta e vencido/);
  assert.match(e.app(), /1 decisão de material ou amostra vencida/);
});

test('fase 2 · compromisso no mesmo horário e responsável pede confirmação', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/agenda' });
  const base = { tipo: 'Vistoria', area: 'engenharia', obraId: 'o1', data: dia(1), hora: '09:00', responsavel: 'Ana' };
  await e.click('[data-act="ev-novo"]');
  await e.submit(Object.assign({ titulo: 'Vistoria A' }, base));
  assert.equal(e.linhas('eventos').length, 1);
  await e.click('[data-act="ev-novo"]');
  await e.submit(Object.assign({ titulo: 'Vistoria B' }, base));
  assert.match(e.erroForm(), /já tem/);
  assert.equal(e.linhas('eventos').length, 1);
  await e.submit({});
  assert.equal(e.linhas('eventos').length, 2);
});

test('fase 2 · reagendar exige motivo e conta o reagendamento', async () => {
  const seed = { obras: { o1: obra() }, eventos: { v1: { obraId: 'o1', titulo: 'Concretagem', tipo: 'Concretagem', area: 'engenharia', data: dia(0), hora: '08:00', status: 'agendado', reag: 0 } } };
  const e = await abrir({ seed, hash: '#/agenda' });
  await e.click('[data-act="ev-reag"][data-id="v1"]');
  await e.submit({ data: dia(5), hora: '08:00', motivo: '' });
  assert.match(e.erroForm(), /motivo/);
  await e.submit({ data: dia(5), hora: '08:00', motivo: 'Chuva forte' });
  const v = e.linhas('eventos')[0];
  assert.equal(v.status, 'reagendado');
  assert.equal(v.reag, 1);
  assert.equal(v.data, dia(5));
});

test('fase 2 · linha de balanço avisa quando uma equipe alcança a outra', async () => {
  const seed = {
    obras: { o1: obra() },
    locs: { l1: { obraId: 'o1', nome: 'Casa 1', ordem: 1 }, l2: { obraId: 'o1', nome: 'Casa 2', ordem: 2 } },
    servicos: {
      s1: { obraId: 'o1', nome: 'Alvenaria', inicio: dia(-10), diasPorLoc: 5, av: { l1: { p: 60, ini: dia(-10) } }, ordem: 1 },
      s2: { obraId: 'o1', nome: 'Reboco', inicio: dia(-3), diasPorLoc: 5, pred: 's1', av: {}, ordem: 2 }
    }
  };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /“Reboco” começa em Casa 1.*“Alvenaria” ainda não concluiu/);
});

test('fase 2 · pré-entrega vira ocorrência da etapa 21', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/entrega' });
  await e.click('[data-act="ent-nova"]');
  await e.submit({ ambiente: 'Sala', ambienteOutro: '', descricao: 'Rejunte falhado atrás da porta', gravidade: 'simples', prestadorId: '', prazo: dia(7) });
  const oc = e.linhas('ocorrencias');
  assert.equal(oc.length, 1);
  assert.equal(oc[0].origem, 'pre_entrega');
  assert.equal(oc[0].etapa, 21);
  assert.equal(oc[0].ambiente, 'Sala');
});

test('fase 2 · material com ressalvas exige a descrição', async () => {
  const seed = { obras: { o1: obra() }, materiais: { m1: { obraId: 'o1', item: 'Porcelanato sala', aprovador: 'Cliente', prazo: dia(5), resultado: 'pendente', nivel3: true, aditivo: false } } };
  const e = await abrir({ seed, hash: '#/obra/o1/projeto' });
  await e.click('[data-act="mat-dec"][data-id="m1"]');
  await e.submit({ resultado: 'ressalvas', data: dia(0), obs: '' });
  assert.match(e.erroForm(), /ressalvas/);
  await e.submit({ resultado: 'ressalvas', data: dia(0), obs: 'Tom mais escuro que a amostra' });
  assert.equal(e.linhas('materiais')[0].resultado, 'ressalvas');
});

test('fase 2 · ata exige decisões e ação exige responsável e prazo', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/reunioes' });
  await e.click('[data-act="ata-nova"]');
  await e.submit({ rito: 'semanal', data: dia(0), participantes: 'Equipe', pauta: '', decisoes: '', assinada: 'nao' });
  assert.match(e.erroForm(), /decisões/);
  await e.submit({ decisoes: 'Antecipar a concretagem.' });
  assert.equal(e.linhas('atas').length, 1);
  await e.click('[data-act="acao-nova"]');
  await e.submit({ descricao: 'Confirmar o concreto', responsavel: '', prazo: dia(3), ataId: '' });
  assert.match(e.erroForm(), /responsável/);
});

test('fase 2 · texto de RFI e de ata é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=2">';
  const seed = { obras: { o1: obra() }, rfis: { r1: { obraId: 'o1', pergunta: xss, destinatario: xss, prazo: dia(3), status: 'aberto', criadoEm: new Date().toISOString() } }, atas: { t1: { obraId: 'o1', rito: 'semanal', data: dia(0), participantes: xss, pauta: xss, decisoes: xss } } };
  const e = await abrir({ seed, hash: '#/obra/o1/projeto' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.go('#/obra/o1/reunioes');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});
