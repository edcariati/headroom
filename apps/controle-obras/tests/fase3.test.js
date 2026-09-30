'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, obraAdm, dia } = require('./helpers');

const compra = (over) => Object.assign({ obraId: 'o1', item: 'Concreto fck 30', etapa: 5, un: 'm³', qtd: 12, dataUso: dia(10), prazoEntrega: 3, status: 'necessidade', cotacoes: [], criadoEm: new Date().toISOString() }, over || {});
const cot = (preco) => ({ id: 'q1', fornecedorId: 'f1', preco, prazo: 2, frete: 0, cond: '28 dias', obs: '' });
const forn = { f1: { nome: 'Concreteira Boa', categoria: 'Concreto' } };

test('fase 3 · Gestão: compra vai da necessidade à conferência e nunca ao pagamento', async () => {
  const seed = { obras: { o1: obra() }, compras: { c1: compra() } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  assert.match(e.app(), /a compra é do cliente/);
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  await e.submit({ data: dia(0), nf: '1234', qtd: '12', obs: '' });
  assert.equal(e.linhas('compras')[0].status, 'entregue');
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  await e.submit({ resultado: 'conferido', criterio: 'ok', obs: '' });
  const c = e.linhas('compras')[0];
  assert.equal(c.status, 'conferido');
  assert.equal(e.linhas('movEstoque').length, 1);
  assert.equal(e.linhas('movEstoque')[0].tipo, 'entrada');
  assert.doesNotMatch(e.app(), /Marcar como pago/);
});

test('fase 3 · Administração: acima do orçado + margem exige aprovação do cliente por escrito (nível 3)', async () => {
  const seed = { obras: { o1: obraAdm() }, fornecedores: forn, compras: { c1: compra({ status: 'aprovacao', orcado: 1000, cotacoes: [cot(1100)], escolhida: 'q1' }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  assert.match(e.dlg(), /nível 3/);
  await e.submit({ data: dia(0), ref: '' });
  assert.match(e.erroForm(), /por escrito/);
  await e.submit({ data: dia(0), ref: 'E-mail do cliente de hoje às 14h' });
  const c = e.linhas('compras')[0];
  assert.equal(c.aprov.nivel, 3);
  assert.equal(c.aprov.por, 'cliente');
});

test('fase 3 · Administração: dentro do orçado a Cariati aprova no nível 2', async () => {
  const seed = { obras: { o1: obraAdm() }, fornecedores: forn, compras: { c1: compra({ status: 'aprovacao', orcado: 1000, cotacoes: [cot(1040)], escolhida: 'q1' }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  assert.match(e.dlg(), /nível 2/);
  await e.click('[data-x="1"]');
  assert.equal(e.linhas('compras')[0].aprov.nivel, 2);
});

test('fase 3 · alçada da obra também exige o cliente', async () => {
  const seed = { obras: { o1: obraAdm({ alcada: 500 }) }, fornecedores: forn, compras: { c1: compra({ status: 'aprovacao', orcado: 2000, cotacoes: [cot(900)], escolhida: 'q1' }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  assert.match(e.dlg(), /alçada/);
  assert.match(e.dlg(), /nível 3/);
});

test('fase 3 · pedido bloqueado: item sob medida sem confirmação e concretagem sem ficha de armadura', async () => {
  const aprov = { nivel: 2, por: 'cariati', data: dia(0) };
  const seed = { obras: { o1: obraAdm() }, fornecedores: forn, compras: { c1: compra({ status: 'aprovacao', sobMedida: true, cotacoes: [cot(900)], escolhida: 'q1', aprov }), c2: compra({ item: 'Concreto', concretagem: true, etapa: 5, status: 'aprovacao', cotacoes: [cot(900)], escolhida: 'q1', aprov }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  assert.match(e.dlg(), /sob medida/);
  assert.equal(e.linhas('compras').find((c) => c.id === 'c1').status, 'aprovacao');
  await e.click('[data-close]');
  await e.click('[data-act="compra-avancar"][data-id="c2"]');
  assert.match(e.dlg(), /Armadura/);
});

test('fase 3 · pagamento só depois do recebimento conferido', async () => {
  const seed = { obras: { o1: obraAdm() }, fornecedores: forn, compras: { c1: compra({ status: 'entregue', pedido: { data: dia(-2), fornecedorId: 'f1', total: 1000, entregaPrevista: dia(0) }, entrega: { data: dia(0), nf: '1', qtd: 12 } }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  assert.doesNotMatch(e.app(), /Marcar como pago/);
  assert.match(e.app(), /Conferir recebimento/);
  await e.recarrega('compras', 'c1', Object.assign({}, e.db.data.compras ? {} : {}, e.linhas('compras')[0], { status: 'conferido', conf: { data: dia(0), resultado: 'conferido' } }));
  assert.match(e.app(), /Marcar como pago/);
});

test('fase 3 · recebimento recusado abre ocorrência e devolve a compra', async () => {
  const seed = { obras: { o1: obraAdm() }, fornecedores: forn, compras: { c1: compra({ status: 'entregue', pedido: { data: dia(-2), fornecedorId: 'f1', total: 1000, entregaPrevista: dia(0) }, entrega: { data: dia(0), nf: '1', qtd: 12 } }) } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  await e.click('[data-act="compra-avancar"][data-id="c1"]');
  await e.submit({ resultado: 'recusado', criterio: '', obs: '' });
  assert.match(e.erroForm(), /motivo da recusa/);
  await e.submit({ resultado: 'recusado', obs: 'Slump fora do especificado' });
  assert.equal(e.linhas('compras')[0].status, 'pedido');
  const oc = e.linhas('ocorrencias');
  assert.equal(oc.length, 1);
  assert.equal(oc[0].origem, 'recebimento');
  assert.equal(e.linhas('movEstoque').length, 0);
});

test('fase 3 · saída de estoque não passa do saldo', async () => {
  const seed = { obras: { o1: obra() }, movEstoque: { m1: { obraId: 'o1', item: 'Cimento', un: 'saco', tipo: 'entrada', qtd: 10, data: dia(-1), etapa: 0 } } };
  const e = await abrir({ seed, hash: '#/obra/o1/estoque' });
  await e.click('[data-act="mov-novo"][data-t="saida"]');
  await e.submit({ chave: 'cimento|saco', qtd: '20', data: dia(0), etapa: '', obs: '' });
  assert.match(e.erroForm(), /maior que o saldo/);
  await e.submit({ qtd: '4' });
  assert.equal(e.linhas('movEstoque').length, 2);
});

test('fase 3 · locação: checklist "Não" exige explicação e devolução registra o real', async () => {
  const seed = { obras: { o1: obra() }, fornecedores: forn, locacoes: { l1: { obraId: 'o1', equipamento: 'Betoneira 400 L', fornecedorId: 'f1', inicio: dia(-3), fimPrevisto: dia(4), valorDia: 80, status: 'prevista', apontamentos: {} } } };
  const e = await abrir({ seed, hash: '#/obra/o1/locacoes' });
  await e.click('[data-act="loc-ativar"][data-id="l1"]');
  await e.submit({ e_0: 'sim', e_1: 'nao', e_2: 'sim', obs: '' });
  assert.match(e.erroForm(), /Explique/);
  await e.submit({ obs: 'Arranhão na caçamba, sem prejuízo' });
  assert.equal(e.linhas('locacoes')[0].status, 'ativa');
  await e.click('[data-act="loc-devolver"][data-id="l1"]');
  await e.submit({ data: dia(0), s_0: 'sim', s_1: 'sim', s_2: 'sim', obs: '' });
  const l = e.linhas('locacoes')[0];
  assert.equal(l.status, 'devolvida');
  assert.equal(l.devolucao.data, dia(0));
});

test('fase 3 · Administração: locação acima da alçada só ativa com o cliente', async () => {
  const seed = { obras: { o1: obraAdm({ alcada: 300 }) }, locacoes: { l1: { obraId: 'o1', equipamento: 'Andaime', inicio: dia(0), fimPrevisto: dia(9), valorDia: 100, status: 'prevista', apontamentos: {} } } };
  const e = await abrir({ seed, hash: '#/obra/o1/locacoes' });
  await e.click('[data-act="loc-ativar"][data-id="l1"]');
  await e.submit({ e_0: 'sim', e_1: 'sim', e_2: 'sim', por: 'cariati', ref: '', obs: '' });
  assert.match(e.erroForm(), /exige aprovação do cliente/);
  await e.submit({ por: 'cliente', ref: 'WhatsApp de hoje, print anexado' });
  assert.equal(e.linhas('locacoes')[0].aprov.nivel, 3);
});

test('fase 3 · dano aberto gera alerta com o total', async () => {
  const seed = { obras: { o1: obra() }, danos: { d1: { obraId: 'o1', descricao: 'Vidro quebrado', custo: 500, status: 'aberta' }, d2: { obraId: 'o1', descricao: 'Piso riscado', custo: 250, status: 'aberta' } } };
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /2 danos em aberto, somando R\$\s*750,00/);
});

test('fase 3 · contrato de prestador guarda valor e retenção', async () => {
  const seed = { obras: { o1: obra() }, prestadores: { p1: { nome: 'Alvenaria Ltda', seguro: dia(90), treinamento: dia(90) } } };
  const e = await abrir({ seed, hash: '#/obra/o1/contratos' });
  await e.click('[data-act="ct-novo"]');
  await e.submit({ prestadorId: 'p1', escopo: 'Alvenaria de vedação', valor: '42000', retencao: '5', inicio: dia(0), fim: dia(60), criterio: 'm² aprovado em ficha', regraDano: '', status: 'ativo' });
  const c = e.linhas('contratosPrest')[0];
  assert.equal(c.valor, 42000);
  assert.equal(c.retencao, 5);
  assert.equal(c.status, 'ativo');
});

test('fase 3 · excluir a obra apaga todos os registros dela (cascata)', async () => {
  const cols = ['etapas', 'atividades', 'pacotes', 'diarios', 'fichas', 'ocorrencias', 'eventos', 'atas', 'acoes', 'docsLegais', 'docsPrest', 'rfis', 'materiais', 'locs', 'servicos', 'compras', 'movEstoque', 'locacoes', 'contratosPrest', 'termos', 'danos'];
  const seed = { obras: { o1: obra(), o2: obra({ nome: 'Outra' }) } };
  cols.forEach((c) => { seed[c] = { a1: { obraId: 'o1', n: 1, nome: 'x' }, b1: { obraId: 'o2', n: 1, nome: 'y' } }; });
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  await e.click('[data-act="obra-editar"]');
  await e.click('[data-act="obra-excluir"]');
  await e.click('[data-x="1"]');
  assert.equal(e.linhas('obras').length, 1);
  cols.forEach((c) => {
    assert.equal(e.linhas(c).filter((x) => x.obraId === 'o1').length, 0, c + ' ainda tem registros da obra excluída');
    assert.equal(e.linhas(c).filter((x) => x.obraId === 'o2').length, 1, c + ' perdeu registros de outra obra');
  });
});

test('fase 3 · texto de compra, fornecedor e dano é escapado', async () => {
  const xss = '<img src=x onerror="window.__xss=3">';
  const seed = { obras: { o1: obra() }, fornecedores: { f1: { nome: xss, categoria: xss } }, compras: { c1: compra({ item: xss, obs: xss }) }, danos: { d1: { obraId: 'o1', descricao: xss, custo: 1, status: 'aberta', local: xss } } };
  const e = await abrir({ seed, hash: '#/obra/o1/compras' });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.click('[data-act="compra-abrir"]');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.go('#/fornecedores');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  await e.go('#/obra/o1/contratos');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__xss, undefined);
});
