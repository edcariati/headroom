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

/* ---------------- passo 3: medição ---------------- */
const fichasOk = (oid, n, qtd, resultado) => { const o = {}; for (let i = 0; i < qtd; i++) o[oid + '_' + n + '_' + i] = { obraId: oid, etapa: n, idx: i, item: 'F' + i, resultado: resultado || 'aprovado', primeira: 'ok', hist: [] }; return o; };
const mesDe = (d) => d.slice(0, 7);
function seedMed(over, opts) {
  opts = opts || {};
  const docs = {};
  if (opts.docs !== false) ['inss', 'fgts', 'folha', 'certidoes'].forEach((k) => { docs['o1_p1_' + mesDe(dia(0)) + '_' + k] = { obraId: 'o1', prestadorId: 'p1', mes: mesDe(dia(0)), tipo: k, status: 'conferido' }; });
  const s = {
    obras: { o1: (opts.gestao ? obra : obraAdm)({ tolerAvanco: 5 }) },
    prestadores: { p1: { nome: 'Alvenaria Souza', seguro: dia(90), treinamento: dia(90) } },
    orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-20), motivo: 'Orçamento base', total: 10000, nItens: 2, lotes: 1, porEtapa: { 7: 10000 }, porTipo: { mao_de_obra: 10000 } } },
    orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [
      { codigo: '7.01', etapa: 7, descricao: 'Alvenaria de vedação', unidade: 'm²', quantidade: 100, precoUnitario: 60, tipo: 'mao_de_obra', prestador: 'Alvenaria Souza', prestadorId: 'p1', total: 6000 },
      { codigo: '7.02', etapa: 7, descricao: 'Reboco', unidade: 'm²', quantidade: 50, precoUnitario: 80, tipo: 'mao_de_obra', prestador: 'Alvenaria Souza', prestadorId: 'p1', total: 4000 }] } },
    contratosPrest: { ct1: { obraId: 'o1', prestadorId: 'p1', escopo: 'Alvenaria e reboco', valor: 10000, retencao: 5, inicio: dia(-20), fim: dia(60), status: 'ativo', regraDano: 'Reparo descontado da medição' } },
    atividades: { a1: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, prestadorId: 'p1', inicio: dia(-20), fim: dia(60), avanco: 50 } },
    docsPrest: docs,
    fichas: fichasOk('o1', 7, 1)
  };
  return Object.assign(s, over || {});
}
const med = (o) => Object.assign({ obraId: 'o1', contratoId: 'ct1', prestadorId: 'p1', numero: 1, periodoIni: dia(-30), periodoFim: dia(0), status: 'em_analise', analiseDesde: new Date().toISOString(), retencaoPct: 5, descontos: [], justificativas: [], hist: [],
  itens: [{ codigo: '7.01', descricao: 'Alvenaria de vedação', unidade: 'm²', precoUnitario: 60, qtdOrcada: 100, qtdAnterior: 0, qtdMedida: 40, etapa: 7, valor: 2400, aditivoId: '' }] }, o || {});
const cods = (t) => t.bloqueios.map((b) => b.cod).join(',');

test('fase 4 · passo 3 · cálculo: bruto, retenção, desconto e líquido nas duas modalidades', async () => {
  const e = await abrir({ seed: seedMed({ medicoes: { m1: med({ descontos: [{ tipo: 'dano', valor: 100 }] }) } }) });
  const m = e.linhas('medicoes')[0], adm = e.x.G('obras', 'o1');
  const c = e.x.medCalc(m, adm);
  assert.equal(c.bruto, 2400);
  assert.equal(c.retencao, 120);
  assert.equal(c.descontos, 100);
  assert.equal(c.liquido, 2180);
  const g = await abrir({ seed: seedMed({ medicoes: { m1: med({ descontos: [{ tipo: 'dano', valor: 100 }] }) } }, { gestao: true }) });
  const cg = g.x.medCalc(g.linhas('medicoes')[0], g.x.G('obras', 'o1'));
  assert.equal(cg.liquido, 2400);           // Gestão: cliente paga o valor medido
  assert.equal(cg.recomendado, 220);        // retenção 120 + dano 100 só como recomendação
});

test('fase 4 · passo 3 · trava 1: documentos do mês precisam estar conferidos', async () => {
  const ok = await abrir({ seed: seedMed({ medicoes: { m1: med() } }) });
  assert.equal(cods(ok.x.medTravas(ok.linhas('medicoes')[0], ok.x.G('obras', 'o1'))), '');
  const bad = await abrir({ seed: seedMed({ medicoes: { m1: med() } }, { docs: false }) });
  const t = bad.x.medTravas(bad.linhas('medicoes')[0], bad.x.G('obras', 'o1'));
  assert.equal(cods(t), 'docs');
  assert.match(t.bloqueios[0].t, /INSS, FGTS, Folha, Certidões/);
});

test('fase 4 · passo 3 · quantidade acumulada não passa da orçada', async () => {
  const seed = seedMed({ medicoes: {
    m0: med({ numero: 1, status: 'paga', itens: [{ codigo: '7.01', descricao: 'Alvenaria', unidade: 'm²', precoUnitario: 60, qtdOrcada: 100, qtdAnterior: 0, qtdMedida: 70, etapa: 7, valor: 4200 }] }),
    m1: med({ numero: 2, itens: [{ codigo: '7.01', descricao: 'Alvenaria', unidade: 'm²', precoUnitario: 60, qtdOrcada: 100, qtdAnterior: 70, qtdMedida: 40, etapa: 7, valor: 2400 }] })
  } });
  const e = await abrir({ seed });
  const t = e.x.medTravas(e.linhas('medicoes').find((m) => m.numero === 2), e.x.G('obras', 'o1'));
  assert.ok(t.bloqueios.some((b) => b.cod === 'qtd' && /Excedente: 10/.test(b.t)), JSON.stringify(t.bloqueios));
});

test('fase 4 · passo 3 · trava 2: medição maior que o avanço + tolerância exige justificativa', async () => {
  const grande = med({ itens: [{ codigo: '7.01', descricao: 'Alvenaria', unidade: 'm²', precoUnitario: 60, qtdOrcada: 100, qtdAnterior: 0, qtdMedida: 100, etapa: 7, valor: 6000 }] });
  const e = await abrir({ seed: seedMed({ medicoes: { m1: grande } }) });
  let t = e.x.medTravas(e.linhas('medicoes')[0], e.x.G('obras', 'o1'));
  assert.equal(cods(t), 'avanco');                 // 60% medido > 50% + 5
  assert.match(t.bloqueios[0].t, /60% do contrato.*50%.*5 pontos/);
  const dentro = await abrir({ seed: seedMed({ medicoes: { m1: grande }, atividades: { a1: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, prestadorId: 'p1', inicio: dia(-20), fim: dia(20), avanco: 56 } } }) });
  assert.equal(cods(dentro.x.medTravas(dentro.linhas('medicoes')[0], dentro.x.G('obras', 'o1'))), '');   // 60 ≤ 56 + 5
  const just = await abrir({ seed: seedMed({ medicoes: { m1: Object.assign({}, grande, { justificativas: [{ trava: 'avanco', texto: 'Fiscalizado em campo', por: 'u1', em: dia(0) }] }) } }) });
  assert.equal(cods(just.x.medTravas(just.linhas('medicoes')[0], just.x.G('obras', 'o1'))), '');
});

test('fase 4 · passo 3 · trava 3: ficha de verificação aprovada na etapa; reprovada bloqueia; sem inspeção só avisa', async () => {
  const semFicha = await abrir({ seed: seedMed({ medicoes: { m1: med() }, fichas: {} }) });
  assert.equal(cods(semFicha.x.medTravas(semFicha.linhas('medicoes')[0], semFicha.x.G('obras', 'o1'))), 'ficha');
  const rep = await abrir({ seed: seedMed({ medicoes: { m1: med() }, fichas: Object.assign(fichasOk('o1', 7, 1), { o1_7_1: { obraId: 'o1', etapa: 7, idx: 1, item: 'F1', resultado: 'reprovado', hist: [] } }) }) });
  assert.match(rep.x.medTravas(rep.linhas('medicoes')[0], rep.x.G('obras', 'o1')).bloqueios[0].t, /reprovada/);
  const ok = await abrir({ seed: seedMed({ medicoes: { m1: med() } }) });
  const t = ok.x.medTravas(ok.linhas('medicoes')[0], ok.x.G('obras', 'o1'));
  assert.equal(cods(t), '');
  assert.match(t.avisos.join(' '), /6 fichas ainda sem inspeção/);
});

test('fase 4 · passo 3 · trava 4: item de aditivo só entra com o aditivo assinado', async () => {
  const item = { codigo: 'A1.1', descricao: 'Muro extra', unidade: 'm²', precoUnitario: 50, qtdOrcada: 10, qtdAnterior: 0, qtdMedida: 2, etapa: 7, valor: 100, aditivoId: 'ad1' };
  const ad = (st) => ({ ad1: { obraId: 'o1', numero: 1, descricao: 'x', tipo: 'acrescimo', status: st, itens: [{ descricao: 'Muro extra', unidade: 'm²', quantidade: 10, precoUnitario: 50, total: 500, etapa: 7, tipoItem: 'empreitada', prestadorId: 'p1' }] } });
  const bad = await abrir({ seed: seedMed({ medicoes: { m1: med({ itens: [item] }) }, aditivos: ad('rascunho') }) });
  assert.equal(cods(bad.x.medTravas(bad.linhas('medicoes')[0], bad.x.G('obras', 'o1'))), 'aditivo');
  const ok = await abrir({ seed: seedMed({ medicoes: { m1: med({ itens: [item] }) }, aditivos: ad('assinado') }) });
  assert.equal(cods(ok.x.medTravas(ok.linhas('medicoes')[0], ok.x.G('obras', 'o1'))), '');
  assert.ok(ok.x.medItensDoPrestador('o1', 'p1').some((i) => i.codigo === 'A1.1'));
});

test('fase 4 · passo 3 · trava 5: ocorrência crítica do prestador retém o valor da etapa', async () => {
  const seed = seedMed({ medicoes: { m1: med({ itens: [
    { codigo: '7.01', descricao: 'Alvenaria', unidade: 'm²', precoUnitario: 60, qtdOrcada: 100, qtdAnterior: 0, qtdMedida: 40, etapa: 7, valor: 2400 },
    { codigo: '8.01', descricao: 'Telhado', unidade: 'm²', precoUnitario: 100, qtdOrcada: 50, qtdAnterior: 0, qtdMedida: 10, etapa: 8, valor: 1000 }] }) },
    ocorrencias: { c1: { obraId: 'o1', etapa: 8, tipo: 'apontamento', gravidade: 'critica', descricao: 'Telha sem fixação', prestadorId: 'p1', status: 'aberta', prazo: dia(3), interacoes: [], criadoEm: new Date().toISOString() } } });
  const e = await abrir({ seed });
  const m = e.linhas('medicoes')[0], o = e.x.G('obras', 'o1');
  const c = e.x.medCalc(m, o);
  assert.equal(c.bruto, 3400);
  assert.equal(c.retidoApontamento, 1000);
  assert.equal(c.retencao, 120);                 // 5% de (3400 − 1000)
  assert.equal(c.liquido, 3400 - 1000 - 120);
  assert.match(e.x.medTravas(m, o).avisos.join(' '), /1\.000,00.*retidos/);
});

test('fase 4 · passo 3 · Administração: aprovar gera a conta a pagar e pagar dá baixa', async () => {
  const e = await abrir({ seed: seedMed({ medicoes: { m1: med() } }), hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-abrir"]');
  await e.click('[data-act="med-aprovar"]');
  await e.click('[data-x="1"]');
  let m = e.linhas('medicoes')[0];
  assert.equal(m.status, 'aprovada');
  assert.equal(m.valorLiquido, 2280);
  const cs = e.linhas('contasPagar');
  assert.equal(cs.length, 1);
  assert.equal(cs[0].valor, 2280);
  assert.equal(cs[0].retencao, 120);
  assert.equal(cs[0].origem, 'medicao');
  assert.equal(cs[0].status, 'aberta');
  assert.equal(e.doc.querySelector('[data-act="med-itens"]'), null);   // aprovada é imutável
  await e.click('[data-act="med-pagar"]');
  await e.click('[data-x="1"]');
  m = e.linhas('medicoes')[0];
  assert.equal(m.status, 'paga');
  assert.equal(e.linhas('contasPagar')[0].status, 'paga');
});

test('fase 4 · passo 3 · Gestão: aprova sem gerar conta e sem reter', async () => {
  const e = await abrir({ seed: seedMed({ medicoes: { m1: med() } }, { gestao: true }), hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-abrir"]');
  assert.match(e.dlg(), /A pagar pelo cliente/);
  assert.match(e.dlg(), /Recomendação ao cliente: reter R\$\s*120,00/);
  await e.click('[data-act="med-aprovar"]');
  await e.click('[data-x="1"]');
  const m = e.linhas('medicoes')[0];
  assert.equal(m.status, 'aprovada');
  assert.equal(m.valorLiquido, 2400);
  assert.equal(e.linhas('contasPagar').length, 0);
});

test('fase 4 · passo 3 · aprovação bloqueada mostra o motivo e nada muda', async () => {
  const e = await abrir({ seed: seedMed({ medicoes: { m1: med() } }, { docs: false }), hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-abrir"]');
  await e.click('[data-act="med-aprovar"]');
  assert.match(e.dlg(), /Não é possível aprovar a medição/);
  assert.match(e.dlg(), /Documentos de .* ainda não conferidos/);
  assert.equal(e.linhas('medicoes')[0].status, 'em_analise');
  assert.equal(e.linhas('contasPagar').length, 0);
});

test('fase 4 · passo 3 · nova medição pelo formulário: excedente bloqueia, saldo salva, descontos de dano', async () => {
  const seed = seedMed({ danos: { d1: { obraId: 'o1', descricao: 'Vidro quebrado', custo: 300, causadorId: 'p1', status: 'aberta' } } });
  const e = await abrir({ seed, hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-nova"]');
  await e.submit({ contratoId: 'ct1', periodoIni: dia(-30), periodoFim: dia(0) });
  assert.equal(e.linhas('medicoes').length, 1);
  assert.match(e.dlg(), /quantidades do período/);
  await e.submit({ q_0: '150', q_1: '', retencaoPct: '5' });
  assert.match(e.erroForm(), /Quantidade acima do orçado/);
  await e.submit({ q_0: '40', q_1: '10', retencaoPct: '5' });
  let m = e.linhas('medicoes')[0];
  assert.equal(m.itens.length, 2);
  assert.equal(m.valorBruto, 2400 + 800);
  assert.equal(m.status, 'rascunho');
  assert.match(e.dlg(), /Danos abertos causados por este prestador/);
  await e.click('[data-act="med-desc-dano"]');
  m = e.linhas('medicoes')[0];
  assert.equal(m.descontos[0].valor, 300);
  assert.match(e.dlg(), /Líquido a pagar.*R\$\s*2\.740,00/);        // 3200 − 160 (5%) − 300
});

test('fase 4 · passo 3 · sem contrato ou sem orçamento a medição avisa o que falta', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm() } }, hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-nova"]');
  assert.match(e.dlg(), /Cadastre um contrato de prestador/);
});

test('fase 4 · passo 3 · texto da medição é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=6">';
  const e = await abrir({ seed: seedMed({ medicoes: { m1: med({ justificativas: [{ trava: 'avanco', texto: xss, por: 'u1', em: dia(0) }], descontos: [{ tipo: 'outro', valor: 1, descricao: xss }] }) } }), hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-abrir"]');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});

/* ---------------- passo 4: contas a pagar, aportes e fluxo de caixa ---------------- */
const mesAdd1 = (m, n) => { const p = m.split('-').map(Number), d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const M0 = dia(0).slice(0, 7), M1 = mesAdd1(M0, 1);
const conta = (o) => Object.assign({ obraId: 'o1', origem: 'outro', origemId: 'x', descricao: 'Conta', credorTipo: '', credorId: '', credorNome: 'Fulano', valor: 1000, retencao: 0, desconto: 0, vencimento: '', status: 'aberta', pagoEm: '', forma: '', obs: '' }, o || {});
const seedFin = (extra) => Object.assign({ obras: { o1: obraAdm() }, fornecedores: { f1: { nome: 'Concreteira Boa' } } }, extra || {});

test('fase 4 · passo 4 · pedido de compra gera a conta, com vencimento pela condição de pagamento', async () => {
  const c1 = { obraId: 'o1', item: 'Concreto fck 30', etapa: 5, un: 'm³', qtd: 12, dataUso: dia(10), prazoEntrega: 3, status: 'aprovacao', aprov: { nivel: 2, por: 'cariati', data: dia(0) }, cotacoes: [{ id: 'q1', fornecedorId: 'f1', preco: 6000, prazo: 2, frete: 0, cond: 'Boleto 28 dias', obs: '' }], escolhida: 'q1', criadoEm: new Date().toISOString() };
  const e = await abrir({ seed: seedFin({ compras: { c1 } }), hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  await e.submit({ data: dia(0), entregaPrevista: dia(5), total: '6000', obs: '' });
  assert.equal(e.linhas('compras')[0].status, 'pedido');
  const cs = e.linhas('contasPagar');
  assert.equal(cs.length, 1);
  assert.equal(cs[0].origem, 'compra');
  assert.equal(cs[0].valor, 6000);
  assert.equal(cs[0].credorId, 'f1');
  assert.equal(cs[0].vencimento, e.x.vencDaCond('28 dias', dia(5)));
  assert.equal(e.x.vencDaCond('à vista', dia(5)), '');
});

test('fase 4 · passo 4 · condição sem "N dias" deixa o vencimento em branco e sinalizado', async () => {
  const c1 = { obraId: 'o1', item: 'Cimento', etapa: 5, un: 'saco', qtd: 100, dataUso: dia(10), status: 'aprovacao', aprov: { nivel: 2, por: 'cariati', data: dia(0) }, cotacoes: [{ id: 'q1', fornecedorId: 'f1', preco: 3000, prazo: 2, cond: 'À vista', obs: '' }], escolhida: 'q1', criadoEm: new Date().toISOString() };
  const e = await abrir({ seed: seedFin({ compras: { c1 } }), hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  await e.submit({ data: dia(0), entregaPrevista: dia(5), total: '3000', obs: '' });
  assert.equal(e.linhas('contasPagar')[0].vencimento, '');
  await e.go('#/obra/o1/financeiro');
  await e.click('[data-act="fin-filtro"][data-f="todas"]');
  assert.match(e.app(), /Sem vencimento/);
});

test('fase 4 · passo 4 · pagar a compra dá baixa na conta', async () => {
  const seed = seedFin({ compras: { c1: { obraId: 'o1', item: 'Concreto', un: 'm³', qtd: 1, status: 'conferido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 500, entregaPrevista: dia(-1) }, entrega: { data: dia(-1), qtd: 1 }, conf: { data: dia(-1), resultado: 'conferido' }, cotacoes: [], criadoEm: new Date().toISOString() } }, contasPagar: { cp_compra_c1: conta({ origem: 'compra', origemId: 'c1', valor: 500, vencimento: dia(5) }) } });
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  await e.submit({ data: dia(0) });
  assert.equal(e.linhas('compras')[0].status, 'pago');
  const c = e.linhas('contasPagar')[0];
  assert.equal(c.status, 'paga');
  assert.equal(c.pagoEm, dia(0));
});

test('fase 4 · passo 4 · locação devolvida gera a conta pelo valor real', async () => {
  const seed = seedFin({ locacoes: { l1: { obraId: 'o1', equipamento: 'Betoneira', fornecedorId: 'f1', inicio: dia(-3), fimPrevisto: dia(6), valorDia: 80, status: 'ativa', apontamentos: {} } } });
  const e = await abrir({ seed, hash: '#/obra/o1/locacoes' });
  await e.click('[data-act="loc-devolver"][data-id="l1"]');
  await e.submit({ data: dia(0), s_0: 'sim', s_1: 'sim', s_2: 'sim', obs: '' });
  const c = e.linhas('contasPagar')[0];
  assert.equal(c.origem, 'locacao');
  assert.equal(c.valor, 4 * 80);          // 4 dias, do dia -3 ao dia 0, e não os 10 previstos
});

test('fase 4 · passo 4 · pagar pela conta exige origem conferida e propaga para a origem', async () => {
  const compra = (st) => ({ obraId: 'o1', item: 'Areia', un: 'm³', qtd: 1, status: st, pedido: { data: dia(-3), fornecedorId: 'f1', total: 500, entregaPrevista: dia(-1) }, cotacoes: [], criadoEm: new Date().toISOString() });
  const seed = seedFin({ compras: { c1: compra('pedido'), c2: compra('conferido') }, medicoes: { m1: { obraId: 'o1', contratoId: 'ct1', prestadorId: 'p1', numero: 1, periodoIni: dia(-30), periodoFim: dia(0), status: 'aprovada', itens: [], valorLiquido: 700 } }, contasPagar: {
    cp_compra_c1: conta({ origem: 'compra', origemId: 'c1', descricao: 'Compra C1', valor: 500 }),
    cp_compra_c2: conta({ origem: 'compra', origemId: 'c2', descricao: 'Compra C2', valor: 500 }),
    cp_medicao_m1: conta({ origem: 'medicao', origemId: 'm1', descricao: 'Medição 1', valor: 700 }) } });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  await e.click('[data-act="conta-paga"][data-id="cp_compra_c1"]');
  assert.match(e.dlg(), /recebimento da compra ainda não foi conferido/);
  await e.click('[data-close]');
  await e.click('[data-act="conta-paga"][data-id="cp_compra_c2"]');
  await e.submit({ data: dia(0), forma: 'Pix' });
  assert.equal(e.linhas('contasPagar').find((c) => c.id === 'cp_compra_c2').status, 'paga');
  assert.equal(e.linhas('compras').find((c) => c.id === 'c2').status, 'pago');
  await e.click('[data-act="conta-paga"][data-id="cp_medicao_m1"]');
  await e.submit({ data: dia(0), forma: 'Transferência' });
  assert.equal(e.linhas('medicoes')[0].status, 'paga');
});

test('fase 4 · passo 4 · cancelar conta exige motivo; conta paga não muda', async () => {
  const seed = seedFin({ contasPagar: { c1: conta({ descricao: 'Aluguel de container', valor: 900 }), c2: conta({ descricao: 'Já paga', status: 'paga', pagoEm: dia(-2), valor: 300 }) } });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  await e.click('[data-act="conta-cancelar"][data-id="c1"]');
  await e.submit({ motivo: '' });
  assert.match(e.erroForm(), /motivo do cancelamento/);
  await e.submit({ motivo: 'Serviço cancelado pelo cliente' });
  const c = e.linhas('contasPagar').find((x) => x.id === 'c1');
  assert.equal(c.status, 'cancelada');
  assert.equal(c.motivoCancelamento, 'Serviço cancelado pelo cliente');
  await e.click('[data-act="fin-filtro"][data-f="pagas"]');
  assert.equal(e.doc.querySelector('[data-act="conta-paga"]'), null);
  assert.equal(e.doc.querySelector('[data-act="conta-cancelar"]'), null);
});

test('fase 4 · passo 4 · fluxo de caixa mensal e saldo acumulado conferidos', async () => {
  const seed = seedFin({
    aportes: { a1: { obraId: 'o1', descricao: '1º aporte', valorPrevisto: 10000, dataPrevista: M0 + '-05', valorRecebido: 10000, dataRecebida: M0 + '-05' }, a2: { obraId: 'o1', descricao: '2º aporte', valorPrevisto: 5000, dataPrevista: M1 + '-05', valorRecebido: null, dataRecebida: '' } },
    contasPagar: {
      c1: conta({ valor: 4000, vencimento: M0 + '-10', status: 'paga', pagoEm: M0 + '-10' }),
      c2: conta({ valor: 3000, vencimento: M0 + '-20' }),
      c3: conta({ valor: 9000, vencimento: M1 + '-15' }),
      c4: conta({ valor: 500, vencimento: '' }),
      c5: conta({ valor: 777, vencimento: M1 + '-20', status: 'cancelada' })
    } });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  const fx = e.x.fluxoCaixa('o1');
  assert.equal(fx.meses.length, 2);
  const [a, b] = fx.meses;
  assert.equal(a.aportePrev, 10000); assert.equal(a.aporteRec, 10000);
  assert.equal(a.desembPrev, 7000);  assert.equal(a.desembReal, 4000);
  assert.equal(a.saldoMes, 6000);    assert.equal(a.saldoAcum, 6000);       // realizado
  assert.equal(b.aportePrev, 5000);  assert.equal(b.desembPrev, 9000);
  assert.equal(b.saldoMes, -4000);   assert.equal(b.saldoAcum, 2000);       // previsto
  assert.equal(fx.semData.n, 1);
  assert.equal(fx.semData.valor, 500);
  assert.ok(e.doc.querySelector('svg.lob'));
  assert.match(e.app(), /1 conta sem vencimento/);
  assert.doesNotMatch(e.app(), /Saldo negativo em/);
});

test('fase 4 · passo 4 · meses com saldo acumulado negativo são destacados', async () => {
  const seed = seedFin({ aportes: { a1: { obraId: 'o1', descricao: 'Aporte', valorPrevisto: 1000, dataPrevista: M0 + '-05', valorRecebido: 1000, dataRecebida: M0 + '-05' } }, contasPagar: { c1: conta({ valor: 5000, vencimento: M1 + '-10' }) } });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  assert.equal(e.x.fluxoCaixa('o1').meses[1].saldoAcum, -4000);
  assert.match(e.app(), /Saldo negativo em 1 mês/);
});

test('fase 4 · passo 4 · aporte: previsto, atraso e recebimento', async () => {
  const e = await abrir({ seed: seedFin(), hash: '#/obra/o1/financeiro' });
  await e.click('[data-act="aporte-novo"]');
  await e.submit({ descricao: '1º aporte', valorPrevisto: '20000', dataPrevista: dia(-3), valorRecebido: '', dataRecebida: '' });
  assert.match(e.app(), /Atrasado/);
  await e.click('[data-act="aporte-receber"]');
  await e.submit({ valorRecebido: '18000', dataRecebida: '' });
  assert.match(e.erroForm(), /valor e a data do recebimento juntos/);
  await e.submit({ valorRecebido: '18000', dataRecebida: dia(0) });
  const a = e.linhas('aportes')[0];
  assert.equal(a.valorRecebido, 18000);
  assert.equal(a.dataRecebida, dia(0));
  assert.doesNotMatch(e.app(), /Atrasado/);
});

test('fase 4 · passo 4 · Gestão mostra só o desembolso previsto do cliente', async () => {
  const m = (n, st, liq, extra) => Object.assign({ obraId: 'o1', contratoId: 'ct1', prestadorId: 'p1', numero: n, periodoIni: dia(-20), periodoFim: dia(0), status: st, valorLiquido: liq, itens: [{ codigo: '1', descricao: 'x', unidade: 'm²', precoUnitario: 100, qtdOrcada: 100, qtdAnterior: 0, qtdMedida: liq / 100, etapa: 7, valor: liq }], retencaoPct: 0, descontos: [], justificativas: [] }, extra || {});
  const seed = { obras: { o1: obra() }, prestadores: { p1: { nome: 'P' } }, medicoes: { m1: m(1, 'aprovada', 2400), m2: m(2, 'em_analise', 800) } };
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  const d = e.x.desembolsoCliente('o1');
  assert.equal(d.length, 1);
  assert.equal(d[0].aprovadas, 2400);
  assert.equal(d[0].aAprovar, 800);
  assert.match(e.app(), /Desembolso previsto do cliente/);
  assert.equal(e.doc.querySelector('[data-act="conta-nova"]'), null);      // sem contas a pagar na Gestão
});

test('fase 4 · passo 4 · texto de conta e aporte é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=7">';
  const seed = seedFin({ contasPagar: { c1: conta({ descricao: xss, credorNome: xss, obs: xss }) }, aportes: { a1: { obraId: 'o1', descricao: xss, valorPrevisto: 1, dataPrevista: dia(2), obs: xss } } });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});

/* ---------------- passo 5: comprometido, apropriado e pago ---------------- */
const compraP = (o) => Object.assign({ obraId: 'o1', item: 'Item', un: 'un', qtd: 1, etapa: 7, status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 1000, entregaPrevista: dia(2) }, cotacoes: [], criadoEm: new Date().toISOString() }, o || {});
const linha = (c, n) => c.etapas.find((x) => x.etapa === n);

test('fase 4 · passo 5 · contrato + medição não contam duas vezes', async () => {
  const seed = seedMed({ medicoes: { m1: med({ status: 'aprovada', valorLiquido: 2280, valorBruto: 2400 }) } });
  const e = await abrir({ seed });
  const c = e.x.custoEtapa('o1');
  const x = linha(c, 7);
  assert.equal(x.orcado, 10000);
  assert.equal(x.apropriado, 2400);                  // medição aprovada (bruto)
  assert.equal(x.comprometido, 10000 - 2400);        // saldo do contrato ainda não medido
  assert.equal(x.exposicao, 10000);                  // = valor do contrato, nem um centavo a mais
  assert.equal(x.pago, 0);
  assert.equal(x.acima, false);
});

test('fase 4 · passo 5 · medição em análise ainda não é apropriada; paga entra pelo líquido', async () => {
  const analise = await abrir({ seed: seedMed({ medicoes: { m1: med() } }) });
  assert.equal(linha(analise.x.custoEtapa('o1'), 7).apropriado, 0);
  assert.equal(linha(analise.x.custoEtapa('o1'), 7).comprometido, 10000);
  const paga = await abrir({ seed: seedMed({ medicoes: { m1: med({ status: 'paga', valorLiquido: 2280, valorBruto: 2400 }) } }) });
  const x = linha(paga.x.custoEtapa('o1'), 7);
  assert.equal(x.apropriado, 2400);
  assert.equal(x.pago, 2280);
});

test('fase 4 · passo 5 · compras: pedido é comprometido, conferida é apropriada, paga é paga', async () => {
  const seed = seedMed({ compras: {
    c1: compraP({ status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 1000, entregaPrevista: dia(2) } }),
    c2: compraP({ status: 'entregue', pedido: { data: dia(-3), fornecedorId: 'f1', total: 200, entregaPrevista: dia(2) } }),
    c3: compraP({ status: 'conferido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 300, entregaPrevista: dia(2) } }),
    c4: compraP({ status: 'pago', pedido: { data: dia(-3), fornecedorId: 'f1', total: 400, entregaPrevista: dia(2) } }),
    c5: compraP({ status: 'aprovacao', pedido: undefined })
  } });
  const e = await abrir({ seed });
  const x = linha(e.x.custoEtapa('o1'), 7);
  assert.equal(x.comprometido, 1000 + 200 + 10000);   // pedidos ainda não conferidos + saldo do contrato
  assert.equal(x.apropriado, 300 + 400);
  assert.equal(x.pago, 400);
});

test('fase 4 · passo 5 · locações: prevista/ativa comprometem, devolvida apropria o real e a conta paga vira pago', async () => {
  const loc = (id, st, extra) => Object.assign({ obraId: 'o1', equipamento: id, inicio: dia(-3), fimPrevisto: dia(6), valorDia: 100, etapa: 7, status: st, apontamentos: {} }, extra || {});
  const seed = seedMed({ locacoes: { l1: loc('A', 'prevista'), l2: loc('B', 'ativa'), l3: loc('C', 'devolvida', { devolucao: { data: dia(0) } }) }, contasPagar: { cp_locacao_l3: conta({ origem: 'locacao', origemId: 'l3', valor: 400, status: 'paga', pagoEm: dia(0) }) } });
  const e = await abrir({ seed });
  const x = linha(e.x.custoEtapa('o1'), 7);
  assert.equal(x.comprometido, 1000 + 1000 + 10000);   // 10 dias × 100 cada (previsto) + contrato
  assert.equal(x.apropriado, 400);                     // 4 dias × 100 (real)
  assert.equal(x.pago, 400);
});

test('fase 4 · passo 5 · custo sem etapa aparece em "Sem etapa"; sem orçamento é sinalizado', async () => {
  const seed = seedMed({ compras: { c1: compraP({ etapa: 0, status: 'conferido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 250, entregaPrevista: dia(2) } }), c2: compraP({ etapa: 12, status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 900, entregaPrevista: dia(2) } }) } });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  const c = e.x.custoEtapa('o1');
  assert.equal(linha(c, 0).apropriado, 250);
  assert.equal(linha(c, 12).semOrcamento, true);
  assert.match(e.app(), /Sem etapa/);
  assert.match(e.app(), /Sem orçamento/);
});

test('fase 4 · passo 5 · exposição acima do orçado da etapa é sinalizada', async () => {
  const seed = seedMed({ compras: { c1: compraP({ status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 3000, entregaPrevista: dia(2) } }) }, contratosPrest: {} });
  const e = await abrir({ seed, hash: '#/obra/o1/financeiro' });
  const c = e.x.custoEtapa('o1');
  assert.equal(linha(c, 7).exposicao, 3000);
  assert.equal(linha(c, 7).acima, false);
  const acima = await abrir({ seed: seedMed({ compras: { c1: compraP({ status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 3000, entregaPrevista: dia(2) } }) } }), hash: '#/obra/o1/financeiro' });
  assert.equal(linha(acima.x.custoEtapa('o1'), 7).acima, true);      // 3000 + saldo do contrato 10000 > 10000
  assert.match(acima.app(), /Acima do orçado/);
});

test('fase 4 · passo 5 · Gestão só conta contratos e medições', async () => {
  const seed = seedMed({ compras: { c1: compraP({ status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 3000, entregaPrevista: dia(2) } }) }, medicoes: { m1: med({ status: 'aprovada', valorLiquido: 2400, valorBruto: 2400 }) } }, { gestao: true });
  const e = await abrir({ seed });
  const x = linha(e.x.custoEtapa('o1'), 7);
  assert.equal(x.comprometido, 7600);
  assert.equal(x.apropriado, 2400);
});

test('fase 4 · passo 5 · repartir fecha o valor exato e o saldo sem itens vai para "Sem etapa"', async () => {
  const e = await abrir();
  const p = e.x.repartir(100, { 5: 1, 7: 1, 9: 1 });
  assert.equal(Math.round((p[5] + p[7] + p[9]) * 100) / 100, 100);
  const semItens = await abrir({ seed: seedMed({ contratosPrest: { ct2: { obraId: 'o1', prestadorId: 'p2', escopo: 'x', valor: 5000, status: 'ativo', inicio: dia(-1), fim: dia(30) } }, prestadores: { p1: { nome: 'A' }, p2: { nome: 'B' } } }) });
  assert.equal(linha(semItens.x.custoEtapa('o1'), 0).comprometido, 5000);
});

/* ---------------- passo 6: físico-financeiro, curvas S e indicadores ---------------- */
function seedEV(opts) {
  opts = opts || {};
  const it = (cod, et, v) => ({ codigo: cod, etapa: et, descricao: 'Serviço ' + cod, unidade: 'vb', quantidade: 1, precoUnitario: v, tipo: 'empreitada', prestador: '', prestadorId: '', total: v });
  const s = {
    obras: { o1: (opts.gestao ? obra : obraAdm)({ area: 100 }) },
    orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-20), motivo: 'Orçamento base', total: 10000, nItens: 2, lotes: 1, porEtapa: { 7: 6000, 8: 4000 }, porTipo: { empreitada: 10000 } } },
    orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [it('7.01', 7, 6000), it('8.01', 8, 4000)] } },
    atividades: {
      a7: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, inicio: dia(-9), fim: dia(10), avanco: 40 },     // 20 dias, hoje é o 10º
      a8: { obraId: 'o1', nome: 'Cobertura', etapa: 8, inicio: dia(1), fim: dia(10), avanco: 0 }
    }
  };
  if (!opts.gestao) s.compras = { c1: compraP({ etapa: 7, status: 'conferido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 3000, entregaPrevista: dia(-1) }, conf: { data: dia(0), resultado: 'conferido' } }) };
  return Object.assign(s, opts.extra || {});
}

test('fase 4 · passo 6 · BAC, PV, EV, AC, CPI, SPI e EAC conferidos à mão', async () => {
  const e = await abrir({ seed: seedEV() });
  const m = e.x.evm(e.x.G('obras', 'o1'));
  assert.equal(m.bac, 10000);
  assert.equal(m.pv, 3000);                     // etapa 7: 10 de 20 dias × 6000; etapa 8 ainda não começou
  assert.equal(m.ev, 2400);                     // etapa 7: 40% × 6000
  assert.equal(m.ac, 3000);                     // compra conferida
  assert.ok(Math.abs(m.cpi - 0.8) < 1e-9);      // 2400 ÷ 3000
  assert.ok(Math.abs(m.spi - 0.8) < 1e-9);      // 2400 ÷ 3000
  assert.equal(m.eac, 12500);                   // 10000 ÷ 0,8
  assert.ok(Math.abs(m.fisPct - 0.24) < 1e-9);
  assert.ok(Math.abs(m.gastoPct - 0.30) < 1e-9);
});

test('fase 4 · passo 6 · etapa liberada conta 100% no físico', async () => {
  const e = await abrir({ seed: seedEV({ extra: { etapas: { o1_8: { obraId: 'o1', n: 8, status: 'liberada', liberadaEm: dia(0), hist: [] } } } }) });
  assert.equal(e.x.fisicoEtapa('o1', 8).v, 1);
  assert.equal(e.x.evm(e.x.G('obras', 'o1')).ev, 2400 + 4000);
});

test('fase 4 · passo 6 · Gestão: só SPI (sem custo real, CPI e EAC)', async () => {
  const e = await abrir({ seed: seedEV({ gestao: true }), hash: '#/obra/o1/fisfin' });
  const m = e.x.evm(e.x.G('obras', 'o1'));
  assert.equal(m.ac, null);
  assert.equal(m.cpi, null);
  assert.equal(m.eac, null);
  assert.ok(Math.abs(m.spi - 0.8) < 1e-9);
  assert.doesNotMatch(e.app(), /CPI \(EV/);
  assert.match(e.app(), /SPI \(EV ÷ PV\)/);
});

test('fase 4 · passo 6 · orçamento sem cronograma e etapa sem atividades são avisados', async () => {
  const seed = seedEV({ extra: { atividades: { a7: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, inicio: dia(-9), fim: dia(10), avanco: 40 } } } });
  const e = await abrir({ seed, hash: '#/obra/o1/fisfin' });
  const m = e.x.evm(e.x.G('obras', 'o1'));
  assert.equal(m.semCronograma.join(), '8');
  assert.equal(m.semFisico.join(), '8');
  assert.match(e.app(), /Orçamento sem cronograma nas etapas: 8/);
});

test('fase 4 · passo 6 · a distribuição planejada soma o orçado da etapa e a curva S fecha em 100%', async () => {
  const e = await abrir({ seed: seedEV() });
  const cv = e.x.curvasS(e.x.G('obras', 'o1'));
  const totalPlan = cv.custoPlan[cv.custoPlan.length - 1];
  assert.ok(Math.abs(totalPlan - 10000) < 0.05, 'planejado acumulado = ' + totalPlan);
  assert.ok(Math.abs(cv.fisPlan[cv.fisPlan.length - 1] - 100) < 0.01);
  // realizado só existe até o mês atual e, nele, é o EV ÷ BAC
  const iAtual = cv.meses.indexOf(dia(0).slice(0, 7));
  assert.ok(Math.abs(cv.fisReal[iAtual] - 24) < 1e-6);
  assert.equal(cv.fisReal[cv.fisReal.length - 1] == null || cv.meses[cv.meses.length - 1] <= dia(0).slice(0, 7), true);
  assert.ok(Math.abs(cv.apropriado[iAtual] - 3000) < 1e-6);
});

test('fase 4 · passo 6 · as três curvas S são desenhadas em SVG', async () => {
  const e = await abrir({ seed: seedEV({ extra: { aportes: { a1: { obraId: 'o1', descricao: 'Aporte', valorPrevisto: 5000, dataPrevista: dia(0), valorRecebido: 5000, dataRecebida: dia(0) } } } }), hash: '#/obra/o1/fisfin' });
  assert.equal(e.doc.querySelectorAll('svg.lob').length, 3);
  assert.match(e.app(), /Curva S física/);
  assert.match(e.app(), /Curva S de custo/);
  assert.match(e.app(), /Aportes do cliente por mês/);
  assert.match(e.app(), /CPI \(EV ÷ AC\)0,8/);
});

test('fase 4 · passo 6 · quadro: financeiro adiante do físico é sinalizado', async () => {
  const seed = seedEV({ extra: { compras: { c1: compraP({ etapa: 7, status: 'conferido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 4200, entregaPrevista: dia(-1) }, conf: { data: dia(0), resultado: 'conferido' } }) } } });
  const e = await abrir({ seed, hash: '#/obra/o1/fisfin' });
  const q = e.x.quadroAcompanhamento(e.x.G('obras', 'o1')).find((x) => x.etapa === 7);
  assert.equal(Math.round(q.fis), 40);
  assert.equal(Math.round(q.fin), 70);             // 4200 ÷ 6000
  assert.equal(q.alerta, true);
  assert.match(e.app(), /Financeiro adiante do físico/);
});

test('fase 4 · passo 6 · aprovar medição com CPI ou SPI abaixo de 1 exige a análise da causa', async () => {
  const atrasado = seedMed({ atividades: { a1: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, prestadorId: 'p1', inicio: dia(-20), fim: dia(0), avanco: 40 } }, medicoes: { m1: med() } });
  const e = await abrir({ seed: atrasado, hash: '#/obra/o1/medicao' });
  await e.click('[data-act="med-abrir"]');
  await e.click('[data-act="med-aprovar"]');
  assert.match(e.dlg(), /Desvio de custo ou prazo/);
  assert.match(e.dlg(), /SPI/);
  await e.submit({ analise: '' });
  assert.match(e.erroForm(), /análise da causa/);
  assert.equal(e.linhas('medicoes')[0].status, 'em_analise');
  await e.submit({ analise: 'Chuva atrasou a alvenaria; cliente avisado por WhatsApp.' });
  const m = e.linhas('medicoes')[0];
  assert.equal(m.status, 'aprovada');
  assert.match(m.analiseDesvio, /Chuva/);
});

/* ---------------- passo 7: indicadores, alertas, agenda e cascata ---------------- */
test('fase 4 · passo 7 · indicadores no resumo da obra', async () => {
  const ad = { a1: { obraId: 'o1', numero: 1, descricao: 'x', tipo: 'acrescimo', status: 'assinado', itens: [{ descricao: 'Extra', unidade: 'vb', quantidade: 1, precoUnitario: 500, total: 500, etapa: 7, tipoItem: 'empreitada' }], assinatura: { data: dia(0), ref: 'ok' } } };
  const e = await abrir({ seed: seedEV({ extra: { aditivos: ad } }), hash: '#/obra/o1/resumo' });
  const t = e.app();
  assert.match(t, /Orçamento revisado.*R\$\s*10\.500,00/);
  assert.match(t, /CPI.*Valor agregado \(EV\) ÷ custo real \(AC\)/);
  assert.match(t, /SPI/);
  assert.match(t, /Avanço físico × orçamento consumido/);
  assert.match(t, /Comprometido, apropriado e pago/);
  assert.match(t, /Aditivos ÷ valor contratado.*5%/);
  const g = await abrir({ seed: seedEV({ gestao: true }), hash: '#/obra/o1/resumo' });
  assert.doesNotMatch(g.app(), /Valor agregado \(EV\) ÷ custo real/);
});

test('fase 4 · passo 7 · alertas de medição, contas, aportes e aditivos', async () => {
  const antigo = new Date(); antigo.setDate(antigo.getDate() - 10);
  const seed = seedMed({
    medicoes: { m1: med({ analiseDesde: antigo.toISOString() }) },
    contasPagar: { c1: conta({ descricao: 'Vencida', valor: 800, vencimento: dia(-2) }), c2: conta({ descricao: 'Próxima', valor: 200, vencimento: dia(3) }), c3: conta({ descricao: 'Longe', valor: 999, vencimento: dia(40) }) },
    aportes: { a1: { obraId: 'o1', descricao: 'Aporte', valorPrevisto: 5000, dataPrevista: dia(-4), valorRecebido: null, dataRecebida: '' } },
    aditivos: { ad1: { obraId: 'o1', numero: 1, descricao: 'x', tipo: 'acrescimo', status: 'aguardando_cliente', enviadoEm: antigo.toISOString(), itens: [] } }
  }, {});
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  const t = e.app();
  assert.match(t, /1 medição em análise há mais de 7 dias/);
  assert.match(t, /1 conta a pagar vencida, somando R\$\s*800,00/);
  assert.match(t, /1 conta vence em até 7 dias, somando R\$\s*200,00/);
  assert.match(t, /1 aporte previsto e não recebido: R\$\s*5\.000,00/);
  assert.match(t, /1 aditivo aguardando o cliente há mais de 7 dias/);
});

test('fase 4 · passo 7 · medição bloqueada por documentos do prestador', async () => {
  const e = await abrir({ seed: seedMed({ medicoes: { m1: med() } }, { docs: false }), hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /1 medição bloqueada por documentos do prestador não conferidos/);
});

test('fase 4 · passo 7 · alertas de CPI/SPI, orçamento sem cronograma, acima do orçado e sem orçamento', async () => {
  const seed = seedEV({ extra: { atividades: { a7: { obraId: 'o1', nome: 'Alvenaria', etapa: 7, inicio: dia(-9), fim: dia(10), avanco: 40 } },
    compras: { c1: compraP({ etapa: 7, status: 'conferido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 7000, entregaPrevista: dia(-1) }, conf: { data: dia(0), resultado: 'conferido' } }), c2: compraP({ etapa: 15, status: 'pedido', pedido: { data: dia(-3), fornecedorId: 'f1', total: 100, entregaPrevista: dia(2) } }) } } });
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  const t = e.app();
  assert.match(t, /CPI 0,34 e SPI 0,8 abaixo de 1: avisar o cliente e registrar a causa/);
  assert.match(t, /Orçamento sem cronograma nas etapas 8/);
  assert.match(t, /acima do orçado na\(s\) etapa\(s\) 7/);
  assert.match(t, /Custo lançado sem orçamento na\(s\) etapa\(s\) 15/);
});

test('fase 4 · passo 7 · sem problemas, sem alertas novos; o painel geral reúne os alertas', async () => {
  const limpo = await abrir({ seed: seedEV({ extra: { compras: {} } }), hash: '#/obra/o1/resumo' });
  assert.doesNotMatch(limpo.app(), /conta a pagar vencida|acima do orçado|sem cronograma/);
  const seed = seedFin({ contasPagar: { c1: conta({ descricao: 'Vencida', valor: 800, vencimento: dia(-2) }) } });
  const e = await abrir({ seed, hash: '#/painel' });
  assert.match(e.app(), /Casa Adm.*conta a pagar vencida/);
});

test('fase 4 · passo 7 · agenda: vencimentos, aportes e fechamento mensal', async () => {
  const seed = seedMed({ medicoes: { m1: med({ status: 'rascunho' }) }, contasPagar: { c1: conta({ descricao: 'Concreteira', valor: 800, vencimento: dia(0) }) }, aportes: { a1: { obraId: 'o1', descricao: '2º aporte', valorPrevisto: 5000, dataPrevista: dia(0) } } });
  const e = await abrir({ seed, hash: '#/obra/o1/agenda' });
  assert.match(e.app(), /Vence: Concreteira/);
  assert.match(e.app(), /Aporte previsto: 2º aporte/);
  assert.equal(e.x.ultimoDiaUtil('2026-09'), '2026-09-30');
  assert.equal(e.x.ultimoDiaUtil('2026-08'), '2026-08-31');
  assert.equal(e.x.ultimoDiaUtil('2026-05'), '2026-05-29');    // 31/05 é domingo
});

test('fase 4 · passo 7 · excluir a obra também apaga orçamento, aditivos, medições, contas e aportes', async () => {
  const cols = ['orcamentos', 'orcItens', 'aditivos', 'medicoes', 'contasPagar', 'aportes'];
  const seed = { obras: { o1: obra(), o2: obra({ nome: 'Outra' }) } };
  cols.forEach((c) => { seed[c] = { a1: { obraId: 'o1', n: 1 }, b1: { obraId: 'o2', n: 1 } }; });
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  await e.click('[data-act="obra-editar"]');
  await e.click('[data-act="obra-excluir"]');
  await e.click('[data-x="1"]');
  cols.forEach((c) => {
    assert.equal(e.linhas(c).filter((x) => x.obraId === 'o1').length, 0, c + ' ainda tem registros da obra excluída');
    assert.equal(e.linhas(c).filter((x) => x.obraId === 'o2').length, 1, c + ' perdeu registros de outra obra');
  });
});

test('fase 4 · passo 7 · campos novos da obra são editáveis e guardados', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm() } }, hash: '#/obra/o1/resumo' });
  await e.click('[data-act="obra-editar"]');
  assert.equal(e.doc.querySelector('[name="tolerAvanco"]').value, '5');
  assert.equal(e.doc.querySelector('[name="abcA"]').value, '80');
  await e.submit({ nome: 'Casa Adm', tolerAvanco: '8', abcA: '70', abcB: '90' });
  const o = e.linhas('obras')[0];
  assert.equal(o.tolerAvanco, 8);
  assert.equal(o.abcA, 70);
  assert.equal(o.abcB, 90);
});
