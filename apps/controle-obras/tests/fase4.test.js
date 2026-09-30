'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, obraAdm, dia } = require('./helpers');

const CSV10 = [
  'codigo;etapa;descricao;unidade;quantidade;preco_unitario;tipo;prestador;total',
  '3.01;3;Terraplanagem;m³;100;40,00;empreitada;Terra Ltda;4000,00',
  '5.01;5;Escavação de sapatas;m³;30;55,50;empreitada;;1665,00',
  '5.02;5;Concreto fck 30;m³;18;520,00;material;;9360,00',
  '5.03;5;Armação CA-50;kg;900;9,80;material;;8820,00',
  '5.04;5;Forma de madeira;m²;120;48,00;mao_de_obra;;5760,00',
  '7.01;7;Alvenaria de vedação;m²;240;62,00;mao_de_obra;Alvenaria Souza;14880,00',
  '7.02;7;Bloco cerâmico;un;9000;1,25;material;;11250,00',
  '9.01;9;Tubulação PVC;m;200;14,90;material;;2980,00',
  '9.02;9;Fiação elétrica;m;1500;3,20;material;;4800,00',
  '14.01;14;Porcelanato 90x90;m²;150;139,90;material;;20985,00'
].join('\n');
const TOTAL10 = 4000 + 1665 + 9360 + 8820 + 5760 + 14880 + 11250 + 2980 + 4800 + 20985;

test('fase 4 · passo 1 · leitura de números e CSV', async () => {
  const e = await abrir();
  const { numBR, csvParse, r2 } = e.x;
  assert.equal(numBR('1.234,56'), 1234.56);
  assert.equal(numBR('1,234.56'), 1234.56);
  assert.equal(numBR('1234,5'), 1234.5);
  assert.equal(numBR('12.500'), 12500);
  assert.equal(numBR('R$ 38,50'), 38.5);
  assert.ok(Number.isNaN(numBR('abc')));
  assert.equal(r2(1.005), 1.01);
  assert.equal(r2(0.1 + 0.2), 0.3);
  assert.equal(JSON.stringify(csvParse('a;b\n"x;y";"he said ""hi"""\n')), JSON.stringify([['a', 'b'], ['x;y', 'he said "hi"']]));
});

test('fase 4 · passo 1 · CSV de 10 itens é aceito e os totais fecham', async () => {
  const e = await abrir({ seed: { prestadores: { p1: { nome: 'Terra Ltda' } } } });
  const rel = e.x.orcParse(CSV10);
  assert.equal(rel.ok, true, JSON.stringify(rel.erros));
  assert.equal(rel.itens.length, 10);
  assert.equal(rel.total, TOTAL10);
  assert.equal(rel.porEtapa[5], 1665 + 9360 + 8820 + 5760);
  assert.equal(rel.porTipo.material, 9360 + 8820 + 11250 + 2980 + 4800 + 20985);
  assert.equal(rel.itens[0].prestadorId, 'p1');
  assert.match(rel.avisos.join(' '), /Alvenaria Souza.*não está cadastrado/);
});

test('fase 4 · passo 1 · linha resumida, duplicado e etapa inválida são apontados', async () => {
  const e = await abrir();
  const rel = e.x.orcParse([
    'codigo,etapa,descricao,unidade,quantidade,preco_unitario,tipo,total',
    '1,3,Terraplanagem,m³,10,5,empreitada,50',
    '1,3,Repetido,m³,10,5,empreitada,50',
    '2,30,Etapa fora,m³,10,5,empreitada,50',
    '3,5,Só total,,,,material,5000',
    '4,5,Total errado,m²,10,5,material,999',
    '5,5,Sem quantidade,m²,0,5,material,'
  ].join('\n'));
  assert.equal(rel.ok, false);
  const msgs = rel.erros.map((x) => x.linha + ':' + x.motivo).join('\n');
  assert.match(msgs, /3:.*código “1” repetido/);
  assert.match(msgs, /4:.*etapa “30” fora de 1 a 22/);
  assert.match(msgs, /5:Linha resumida/);
  assert.match(msgs, /6:.*não bate/);
  assert.match(msgs, /7:.*quantidade deve ser maior que zero/);
  assert.equal(rel.itens.length, 1);
});

test('fase 4 · passo 1 · cabeçalho sem colunas obrigatórias é rejeitado', async () => {
  const e = await abrir();
  const rel = e.x.orcParse('codigo;descricao\n1;x');
  assert.equal(rel.ok, false);
  assert.match(rel.erros[0].motivo, /Faltam colunas obrigatórias.*etapa.*unidade.*quantidade/);
});

test('fase 4 · passo 1 · importa pela tela, guarda em lotes e a 2ª versão preserva a 1ª', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm() } }, hash: '#/obra/o1/orcamento' });
  await e.click('[data-act="orc-importar"]');
  e.doc.querySelector('#orc_csv').value = CSV10;
  await e.click('[data-orc="validar"]');
  assert.match(e.dlg(), /10 linhas válidas de 10/);
  await e.click('[data-orc="confirmar"]');
  const v1 = e.linhas('orcamentos');
  assert.equal(v1.length, 1);
  assert.equal(v1[0].versao, 1);
  assert.equal(v1[0].total, TOTAL10);
  assert.equal(e.linhas('orcItens').length, 1);
  assert.match(e.app(), /Orçamento revisado/);
  assert.match(e.app(), /R\$\s*84\.500,00/);
  // nova versão exige motivo e mantém a anterior
  await e.click('[data-act="orc-importar"]');
  e.doc.querySelector('#orc_csv').value = CSV10.replace('20985,00', '22000,00').replace('139,90', '146,6667');
  await e.click('[data-orc="validar"]');
  assert.match(e.dlg(), /não bate|válidas/);
  e.doc.querySelector('#orc_csv').value = CSV10.replace('4000,00', '4400,00').replace('40,00', '44,00');
  await e.click('[data-orc="validar"]');
  await e.click('[data-orc="confirmar"]');
  assert.match(e.dlg(), /motivo da nova versão/);
  e.doc.querySelector('#orc_mot').value = 'Reajuste da terraplanagem';
  await e.click('[data-orc="confirmar"]');
  const vs = e.linhas('orcamentos').sort((a, b) => a.versao - b.versao);
  assert.equal(vs.length, 2);
  assert.equal(vs[0].total, TOTAL10);
  assert.equal(vs[1].total, TOTAL10 + 400);
  assert.equal(vs[1].motivo, 'Reajuste da terraplanagem');
  const cmp = e.x.orcComparaVersoes(vs[0], vs[1]);
  assert.equal(cmp.dif, 400);
  assert.equal(cmp.alterados.length, 1);
  assert.equal(e.x.orcItensDe(vs[0]).find((i) => i.codigo === '3.01').precoUnitario, 40);
});

test('fase 4 · passo 1 · modelo CSV e texto escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=4">';
  const seed = { obras: { o1: obraAdm() }, orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(0), motivo: xss, origem: xss, total: 10, nItens: 1, lotes: 1, porEtapa: { 5: 10 }, porTipo: { material: 10 } } }, orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [{ codigo: xss, etapa: 5, descricao: xss, unidade: 'un', quantidade: 1, precoUnitario: 10, tipo: 'material', prestador: xss, prestadorId: '', total: 10 }] } } };
  const e = await abrir({ seed, hash: '#/obra/o1/orcamento' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
  assert.match(e.app(), /<img src=x/);
  await e.click('[data-act="orc-modelo"]');
  assert.deepEqual(e.erros, []);
});

/* ---------------- passo 2: aditivos e orçamento revisado ---------------- */
const seedOrc = (extra) => Object.assign({
  obras: { o1: obraAdm() },
  orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-5), motivo: 'Orçamento base', total: 1000, nItens: 2, lotes: 1, porEtapa: { 5: 600, 7: 400 }, porTipo: { material: 600, mao_de_obra: 400 } } },
  orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [
    { codigo: '5.01', etapa: 5, descricao: 'Concreto', unidade: 'm³', quantidade: 2, precoUnitario: 300, tipo: 'material', prestador: '', prestadorId: '', total: 600 },
    { codigo: '7.01', etapa: 7, descricao: 'Alvenaria', unidade: 'm²', quantidade: 10, precoUnitario: 40, tipo: 'mao_de_obra', prestador: '', prestadorId: '', total: 400 }] } }
}, extra || {});
const adt = (o) => Object.assign({ obraId: 'o1', numero: 1, descricao: 'Aditivo', tipo: 'acrescimo', itens: [], status: 'rascunho', impactoPrazoDias: 0, criadoEm: new Date().toISOString() }, o);
const it = (desc, q, pu, etapa) => ({ descricao: desc, unidade: 'un', quantidade: q, precoUnitario: pu, total: q * pu, etapa, tipoItem: 'empreitada' });

test('fase 4 · passo 2 · só aditivo assinado altera o orçamento revisado; o base fica intacto', async () => {
  const e = await abrir({ seed: seedOrc({ aditivos: {
    a1: adt({ numero: 1, status: 'assinado', itens: [it('Contenção', 5, 100, 5)] }),
    a2: adt({ numero: 2, status: 'assinado', tipo: 'supressao', itens: [it('Retirada de piso', 4, 50, 7)] }),
    a3: adt({ numero: 3, status: 'rascunho', itens: [it('Não vale', 1, 999, 5)] }),
    a4: adt({ numero: 4, status: 'aguardando_cliente', itens: [it('Ainda não', 1, 888, 5)] }),
    a5: adt({ numero: 5, status: 'recusado', itens: [it('Recusado', 1, 777, 5)] })
  } }), hash: '#/obra/o1/orcamento' });
  const rev = e.x.orcRevisado('o1');
  assert.equal(rev.base, 1000);
  assert.equal(rev.aditivos, 300);            // +500 (acréscimo) −200 (supressão)
  assert.equal(rev.total, 1300);
  assert.equal(rev.porEtapa[5], 600 + 500);
  assert.equal(rev.porEtapa[7], 400 - 200);
  assert.equal(rev.itens.length, 4);
  assert.equal(e.linhas('orcamentos')[0].total, 1000);   // base intacto
  assert.match(e.app(), /Orçamento revisado.*R\$\s*1\.300,00/);
});

test('fase 4 · passo 2 · ciclo do aditivo: rascunho → enviado → assinado (com registro) e depois imutável', async () => {
  const e = await abrir({ seed: seedOrc(), hash: '#/obra/o1/orcamento' });
  await e.click('[data-act="adt-novo"]');
  await e.submit({ descricao: 'Contenção extra por solo diferente', tipo: 'acrescimo', impactoPrazoDias: '5', itens: 'Contenção em gabião; m³; 42; 310,50; 5; empreitada\nEscavação adicional; m³; 30; 55,00; 5; empreitada' });
  let a = e.linhas('aditivos')[0];
  assert.equal(a.numero, 1);
  assert.equal(a.status, 'rascunho');
  assert.equal(a.valor, 42 * 310.5 + 30 * 55);
  assert.equal(a.itens.length, 2);
  assert.equal(e.x.orcRevisado('o1').total, 1000);        // rascunho não conta
  await e.click('[data-act="adt-enviar"]');
  await e.click('[data-x="1"]');
  assert.equal(e.linhas('aditivos')[0].status, 'aguardando_cliente');
  await e.click('[data-act="adt-assinar"]');
  await e.submit({ data: dia(0), ref: '' });
  assert.match(e.erroForm(), /Registre como o cliente assinou/);
  await e.submit({ data: dia(0), ref: 'Assinado no escritório, cópia anexada' });
  a = e.linhas('aditivos')[0];
  assert.equal(a.status, 'assinado');
  assert.equal(a.assinatura.ref, 'Assinado no escritório, cópia anexada');
  assert.equal(e.x.orcRevisado('o1').total, 1000 + 42 * 310.5 + 30 * 55);
  assert.equal(e.x.orcRevisado('o1').prazoDias, 5);
  assert.equal(e.linhas('orcamentos')[0].total, 1000);
  assert.doesNotMatch(e.app(), /Editar<\/button>.*Registrar assinatura/);
  assert.equal(e.doc.querySelector('[data-act="adt-editar"]'), null);
});

test('fase 4 · passo 2 · aditivo assinado não pode ser editado nem excluído', async () => {
  const e = await abrir({ seed: seedOrc({ aditivos: { a1: adt({ status: 'assinado', itens: [it('X', 1, 10, 5)], assinatura: { data: dia(0), ref: 'ok' } }) } }), hash: '#/obra/o1/orcamento' });
  assert.equal(e.doc.querySelector('[data-act="adt-editar"]'), null);
  assert.equal(e.doc.querySelector('[data-act="adt-excluir"]'), null);
});

test('fase 4 · passo 2 · validação dos itens do aditivo', async () => {
  const e = await abrir({ seed: seedOrc(), hash: '#/obra/o1/orcamento' });
  await e.click('[data-act="adt-novo"]');
  await e.submit({ descricao: 'x', tipo: 'acrescimo', impactoPrazoDias: '0', itens: '' });
  assert.match(e.erroForm(), /ao menos um item/);
  await e.submit({ itens: 'Item sem preço; un; 3; abc' });
  assert.match(e.erroForm(), /preço unitário inválido/);
  await e.submit({ itens: 'Item; un; 3; 10; 40' });
  assert.match(e.erroForm(), /etapa/);
  assert.equal(e.linhas('aditivos').length, 0);
});

test('fase 4 · passo 2 · "Gerar aditivo" a partir de ocorrência e de material', async () => {
  const seed = seedOrc({
    ocorrencias: { c1: { obraId: 'o1', etapa: 5, tipo: 'imprevisto', gravidade: 'importante', descricao: 'Rocha na escavação', status: 'aberta', prazo: dia(5), interacoes: [], criadoEm: new Date().toISOString() } },
    materiais: { m1: { obraId: 'o1', item: 'Porcelanato da sala', aprovador: 'Cliente', prazo: dia(5), resultado: 'pendente', nivel3: true, aditivo: true } }
  });
  const e = await abrir({ seed, hash: '#/obra/o1/ocorrencias' });
  await e.click('[data-act="oc-abrir"]');
  await e.click('[data-act="adt-de-oc"]');
  assert.equal(e.doc.querySelector('[name="descricao"]').value, 'Rocha na escavação');
  await e.submit({ tipo: 'acrescimo', impactoPrazoDias: '3', itens: 'Remoção de rocha; m³; 12; 200,00; 5' });
  let a = e.linhas('aditivos')[0];
  assert.equal(a.origem.col, 'ocorrencias');
  assert.equal(a.origem.id, 'c1');
  assert.equal(a.valor, 2400);
  await e.go('#/obra/o1/projeto');
  await e.click('[data-act="adt-de-mat"]');
  await e.submit({ tipo: 'acrescimo', impactoPrazoDias: '0', itens: 'Diferença de porcelanato; m²; 30; 40,00; 14' });
  a = e.linhas('aditivos').find((x) => x.origem.col === 'materiais');
  assert.equal(a.numero, 2);
  assert.equal(a.origem.id, 'm1');
});

test('fase 4 · passo 2 · texto do aditivo é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=5">';
  const e = await abrir({ seed: seedOrc({ aditivos: { a1: adt({ descricao: xss, itens: [it(xss, 1, 10, 5)] }) } }), hash: '#/obra/o1/orcamento' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.click('[data-act="adt-ver"]');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});
