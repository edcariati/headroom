'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obraAdm, obra, dia } = require('./helpers');

const orcSeed = () => ({
  orcamentos: { b1: { obraId: 'o1', versao: 1, data: dia(-5), motivo: 'Base', total: 1000, nItens: 2, lotes: 1, porEtapa: { 5: 600, 7: 400 }, porTipo: { material: 600, mao_de_obra: 400 } } },
  orcItens: { b1_0: { obraId: 'o1', orcId: 'b1', lote: 0, itens: [
    { codigo: '5.01', etapa: 5, descricao: 'Concreto', unidade: 'm³', quantidade: 2, precoUnitario: 300, tipo: 'material', prestador: '', prestadorId: '', total: 600 },
    { codigo: '7.01', etapa: 7, descricao: 'Alvenaria', unidade: 'm²', quantidade: 10, precoUnitario: 40, tipo: 'mao_de_obra', prestador: '', prestadorId: '', total: 400 }] } }
});
const ped = (o) => Object.assign({ obraId: 'o1', numero: 1, descricao: 'Serviço extra', tipo: 'servico', etapa: 5, status: 'orcando', orcamentos: [], criadoEm: new Date().toISOString() }, o);
const tres = [{ id: 'a', favorecido: 'A', valor: 1000 }, { id: 'b', favorecido: 'B', valor: 1200 }, { id: 'c', favorecido: 'C', valor: 1500 }];

/* ---------- relatório quinzenal ---------- */
test('quinzenal · quinzena sem relatório vira pendência da engenharia, alerta e evento na agenda', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm({ inicio: dia(-60) }) } }, hash: '#/obra/o1/quinzenal' });
  const o = e.x.G('obras', 'o1');
  assert.ok(e.x.qzPendentes(o).length >= 1);
  assert.match(e.app(), /Pendente da engenharia/);
  assert.ok(e.x.alertasG(o).some((a) => /Relatório quinzenal/.test(a.t)));
  assert.ok(e.x.eventosAuto('o1').some((ev) => /Relatório quinzenal/.test(ev.titulo)));
});

test('quinzenal · rascunho, texto, emissão congela e o cliente vê só o emitido', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm({ inicio: dia(-60) }) } }, hash: '#/obra/o1/quinzenal' });
  await e.click('[data-act="qz-criar"]');
  const rel = () => e.linhas('relatorios')[0];
  assert.equal(rel().tipo, 'quinzenal');
  assert.match(rel().mes, /^\d{4}-\d{2}-Q[12]$/);
  await e.click('[data-act="qz-emitir"]');
  assert.match(e.dlg(), /Falta preencher/);
  await e.click('[data-close]');
  await e.click('[data-act="qz-editar"]');
  await e.submit({ texto: 'Concretagem da laje concluída.', posicao: 'Precisamos da escolha do piso até sexta.', proximos: 'Iniciar alvenaria.' });
  assert.equal(rel().textoEngenharia, 'Concretagem da laje concluída.');
  await e.click('[data-act="qz-emitir"]');
  await e.click('[data-x="1"]');
  assert.equal(rel().status, 'emitido');
  assert.ok(rel().snapshot && rel().snapshot.avanco);
  assert.match(e.app(), /Precisamos da escolha do piso/);
  assert.equal(e.x.qzPendentes(e.x.G('obras', 'o1')).filter((q) => q.k === rel().mes).length, 0);
});

test('quinzenal · o relatório não carrega valores em R$ do financeiro', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm({ inicio: dia(-60) }) } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/quinzenal' });
  const o = e.x.G('obras', 'o1');
  const d = e.x.quinzDados(o, { k: '2026-01-Q1', ini: '2026-01-01', fim: '2026-01-15' });
  assert.equal(/R\$|orcado|pago|comprometido/i.test(JSON.stringify(Object.keys(d.alinhamento)) + JSON.stringify(Object.keys(d.avanco))), false);
});

/* ---------- meta × evolução × pagamentos ---------- */
test('meta × evolução · pagar adiante do físico desalinha a etapa e aparece no alerta e na aba', async () => {
  const seed = Object.assign({
    obras: { o1: obraAdm() },
    atividades: { a1: { obraId: 'o1', nome: 'Fundação', etapa: 5, inicio: dia(-20), fim: dia(20), avanco: 30 } },
    compras: { c1: { obraId: 'o1', item: 'Concreto', etapa: 5, status: 'pago', pedido: { total: 400, fornecedorId: 'f1', data: dia(-5) }, conf: { data: dia(-4) } } }
  }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/metaevo' });
  const m = e.x.metaEvo('o1'), l = m.linhas.filter((x) => x.n === 5)[0];
  assert.equal(l.k, 'crit');
  assert.equal(m.kpi.nAtivas, 1); assert.equal(m.kpi.alinh, 0);
  assert.ok(m.kpi.adiante > 200);
  assert.match(e.app(), /Meta × evolução × pagamentos/);
  assert.match(e.app(), /Desalinhada/);
  assert.ok(e.x.alertasG(e.x.G('obras', 'o1')).some((a) => /desalinhada/.test(a.t)));
});

test('meta × evolução · etapa dentro da meta e do físico fica alinhada', async () => {
  const seed = Object.assign({
    obras: { o1: obraAdm() },
    atividades: { a1: { obraId: 'o1', nome: 'Fundação', etapa: 5, inicio: dia(-20), fim: dia(20), avanco: 50 } },
    compras: { c1: { obraId: 'o1', item: 'Concreto', etapa: 5, status: 'pago', pedido: { total: 240, fornecedorId: 'f1', data: dia(-5) }, conf: { data: dia(-4) } } }
  }, orcSeed());
  const e = await abrir({ seed, hash: '#/painel' });
  const m = e.x.metaEvo('o1');
  assert.equal(m.linhas.filter((x) => x.n === 5)[0].k, '');
  assert.equal(m.kpi.alinh, 1);
});

/* ---------- pedidos de pagamento ---------- */
test('pedido de pagamento · orçamentos, dispensa, aprovação, conta a pagar e baixa entram no custo da etapa', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm() } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/pedidos' });
  await e.click('[data-act="ped-novo"]');
  await e.submit({ descricao: 'Impermeabilização da laje', tipo: 'servico', etapa: '5', foraEscopo: 'nao' });
  const p = () => e.linhas('pedidosPag')[0];
  assert.equal(p().numero, 1); assert.equal(p().status, 'orcando');
  await e.click('[data-act="ped-orc-novo"]');
  await e.submit({ favorecido: 'Impermeabiliza A', valor: '1000' });
  await e.click('[data-act="ped-orc-novo"]');
  await e.submit({ favorecido: 'Impermeabiliza B', valor: '1200' });
  assert.equal(p().orcamentos.length, 2);
  await e.click('[data-act="ped-enviar"]');
  assert.match(e.dlg(), /Escolha um dos orçamentos|Não dá para enviar/);
  await e.click('[data-close]');
  await e.click('[data-act="ped-abrir"][data-id="' + e.linhas('pedidosPag')[0].id + '"]');
  const menor = p().orcamentos.filter((o) => o.valor === 1000)[0];
  await e.click('[data-act="ped-orc-esc"][data-oid2="' + menor.id + '"]');
  assert.equal(p().escolhida, menor.id);
  await e.click('[data-act="ped-enviar"]');
  assert.match(e.dlg(), /Menos de 3 orçamentos/);
  await e.submit({ dispensa: 'Só dois fornecedores atendem a região.' });
  assert.equal(p().status, 'aprovacao');
  await e.click('[data-act="ped-aprovar"]');
  await e.submit({ data: dia(0) });
  assert.equal(p().status, 'aprovado');
  const conta = e.linhas('contasPagar').filter((c) => c.origem === 'pedido')[0];
  assert.ok(conta); assert.equal(conta.valor, 1000); assert.equal(conta.status, 'aberta');
  assert.equal(e.x.custoEtapa('o1').etapas.filter((x) => x.etapa === 5)[0].comprometido, 1000);
  await e.click('[data-act="ped-pagar"]');
  await e.submit({ data: dia(0), forma: 'Pix' });
  assert.equal(e.x.pedStatus(p()), 'pago');
  assert.equal(e.linhas('contasPagar').filter((c) => c.origem === 'pedido')[0].status, 'paga');
  assert.equal(e.x.custoEtapa('o1').etapas.filter((x) => x.etapa === 5)[0].pago, 1000);
});

test('pedido de pagamento · escolher valor maior exige justificativa; com 3 orçamentos não precisa de dispensa', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm() }, pedidosPag: { p1: ped({ orcamentos: tres }) } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/pedidos' });
  await e.click('[data-act="ped-abrir"][data-id="p1"]');
  await e.click('[data-act="ped-orc-esc"][data-oid2="b"]');
  assert.match(e.dlg(), /Não é o menor valor/);
  await e.submit({ j: '' });
  assert.match(e.erroForm(), /justificativa/i);
  await e.submit({ j: 'Prazo menor e garantia de 5 anos.' });
  assert.equal(e.linhas('pedidosPag')[0].escolhida, 'b');
  await e.click('[data-act="ped-enviar"]');
  assert.equal(e.linhas('pedidosPag')[0].status, 'aprovacao');
});

test('pedido de pagamento · etapa sem orçamento exige marcar fora do escopo', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm() } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/pedidos' });
  await e.click('[data-act="ped-novo"]');
  await e.submit({ descricao: 'Piscina não prevista', tipo: 'servico', etapa: '9', foraEscopo: 'nao' });
  assert.match(e.erroForm(), /fora do escopo/i);
  await e.submit({ descricao: 'Piscina não prevista', tipo: 'servico', etapa: '9', foraEscopo: 'sim', motivoFora: 'cliente' });
  assert.equal(e.linhas('pedidosPag')[0].foraEscopo, true);
});

test('fora do escopo · não aprova sem aditivo assinado; com aditivo assinado exige o registro do cliente; emergência libera com prazo', async () => {
  const adt = (s) => ({ obraId: 'o1', numero: 1, descricao: 'Piscina', tipo: 'acrescimo', itens: [], status: s, impactoPrazoDias: 0, criadoEm: new Date().toISOString() });
  const seed = Object.assign({ obras: { o1: obraAdm() }, aditivos: { ad1: adt('assinado'), ad2: adt('aguardando_cliente') },
    pedidosPag: { p1: ped({ status: 'aprovacao', escolhida: 'a', orcamentos: tres, foraEscopo: true, motivoFora: 'cliente' }), p2: ped({ numero: 2, status: 'aprovacao', escolhida: 'a', orcamentos: tres, foraEscopo: true, motivoFora: 'cliente', aditivoId: 'ad1' }), p3: ped({ numero: 3, status: 'aprovacao', escolhida: 'a', orcamentos: tres, foraEscopo: true, aditivoId: 'ad2' }) } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/pedidos' });
  await e.click('[data-act="ped-abrir"][data-id="p1"]');
  await e.click('[data-act="ped-aprovar"]');
  assert.match(e.dlg(), /vincule o aditivo/);
  await e.click('[data-close]');
  await e.click('[data-act="ped-abrir"][data-id="p3"]');
  await e.click('[data-act="ped-aprovar"]');
  assert.match(e.dlg(), /Aguardando o cliente/);
  await e.click('[data-close]');
  await e.click('[data-act="ped-abrir"][data-id="p2"]');
  await e.click('[data-act="ped-aprovar"]');
  await e.submit({ data: dia(0), ref: '' });
  assert.match(e.erroForm(), /registro/i);
  await e.submit({ data: dia(0), ref: 'e-mail do cliente de hoje' });
  assert.equal(e.linhas('pedidosPag').filter((p) => p.numero === 2)[0].status, 'aprovado');
  assert.equal(e.linhas('pedidosPag').filter((p) => p.numero === 2)[0].aprov.por, 'cliente');
  await e.click('[data-act="ped-abrir"][data-id="p1"]');
  await e.click('[data-act="fe-emerg"]');
  await e.submit({ motivo: 'Vazamento na laje', data: dia(0), ref: 'WhatsApp de hoje' });
  const p1 = e.linhas('pedidosPag').filter((p) => p.numero === 1)[0];
  assert.equal(p1.emergencia.regularizarAte, dia(5));
  assert.equal(e.x.foraEscopoOk(p1), true);
  assert.equal(e.x.foraEscopoOk(p1, true), false);
});

test('fora do escopo · compra fora do escopo não emite pedido sem aditivo', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm() }, fornecedores: { f1: { nome: 'Forn' } },
    compras: { c1: { obraId: 'o1', item: 'Piso extra', etapa: 5, un: 'm²', qtd: 10, dataUso: dia(10), status: 'aprovacao', cotacoes: [{ id: 'q1', fornecedorId: 'f1', preco: 500 }], escolhida: 'q1', aprov: { nivel: 2, por: 'cariati', data: dia(0) }, foraEscopo: true, criadoEm: new Date().toISOString() } } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  assert.match(e.dlg(), /Fora do escopo/);
});

test('pedido de pagamento · texto do usuário é escapado', async () => {
  const xss = '<img src=x onerror=alert(1)>';
  const e = await abrir({ seed: { obras: { o1: obraAdm() }, pedidosPag: { p1: ped({ descricao: xss, orcamentos: [{ id: 'a', favorecido: xss, valor: 10 }] }) } }, hash: '#/obra/o1/pedidos' });
  assert.equal(e.doc.querySelector('#app img'), null);
  await e.click('[data-act="ped-abrir"][data-id="p1"]');
  assert.equal(e.doc.querySelector('#dlg img'), null);
});

/* ---------- pagamentos e prazos ---------- */
test('pagamentos e prazos · vencidos, prazos atrasados e fluxo do mês × programação', async () => {
  const seed = Object.assign({ obras: { o1: obraAdm() },
    atividades: { a1: { obraId: 'o1', nome: 'Fundação', etapa: 5, prestadorId: 'p1', inicio: dia(-5), fim: dia(5), avanco: 10 } },
    prestadores: { p1: { nome: 'Fulano Fundações' } },
    compras: { c1: { obraId: 'o1', item: 'Cimento', etapa: 9, status: 'pedido', pedido: { total: 300, fornecedorId: 'f1', data: dia(-10), entregaPrevista: dia(-2) }, dataUso: dia(-1) } },
    contasPagar: { cp1: { obraId: 'o1', origem: 'compra', origemId: 'c1', descricao: 'Compra: Cimento', valor: 300, status: 'aberta', vencimento: dia(0) }, cp2: { obraId: 'o1', origem: 'outro', origemId: 'x', descricao: 'Vencida', valor: 100, status: 'aberta', vencimento: dia(-3) } } }, orcSeed());
  const e = await abrir({ seed, hash: '#/obra/o1/pagprazos' });
  const t = e.app();
  assert.match(t, /Pagamentos a fazer/); assert.match(t, /Vencidos/); assert.match(t, /Prazos de entrega/); assert.match(t, /atrasado/);
  assert.match(t, /Fluxo de pagamento do mês × programação/);
  const fm = e.x.fluxoMes('o1', dia(0).slice(0, 7));
  const l9 = fm.linhas.filter((x) => x.n === 9)[0], l5 = fm.linhas.filter((x) => x.n === 5)[0];
  assert.ok(l9 && l9.semProg, 'pagamento em etapa sem programação');
  assert.ok(l5 && l5.prog && l5.plan > 0 && l5.semPag, 'etapa programada sem pagamento previsto');
  assert.match(t, /pagamento sem programação/);
});

/* ---------- final de obra × compras ---------- */
test('final de obra · compras abertas, locação ativa e pedido em andamento travam o checklist de encerramento', async () => {
  const seed = { obras: { o1: obraAdm() }, compras: { c1: { obraId: 'o1', item: 'Tinta', status: 'pedido', pedido: { total: 100, data: dia(-3), entregaPrevista: dia(2) } } },
    locacoes: { l1: { obraId: 'o1', equipamento: 'Betoneira', status: 'ativa', valorDia: 10, inicio: dia(-3), fimPrevisto: dia(5) } }, pedidosPag: { p1: ped({ status: 'aprovado' }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/encerramento' });
  const it = e.x.checklistEncerramento(e.x.G('obras', 'o1'));
  ['compras', 'locacoes', 'pedidosPag'].forEach((k) => assert.equal(it.filter((x) => x.k === k)[0].ok, false, k));
  assert.match(e.app(), /Alinhamento final com compras/);
});

test('navegação · abas novas aparecem nos grupos certos', async () => {
  const e = await abrir({ seed: { obras: { o1: obraAdm() } }, hash: '#/obra/o1/financeiro' });
  const t = e.app();
  ['Pedidos de pagamento', 'Pagamentos e prazos', 'Meta × evolução'].forEach((s) => assert.match(t, new RegExp(s)));
  await e.go('#/obra/o1/relatorio');
  assert.match(e.app(), /Relatório quinzenal/);
});
