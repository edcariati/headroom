'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir, obra, dia } = require('./helpers');

const seedBase = (extra) => Object.assign({
  empresas: { emp1: { nome: 'Cariati', ativa: true, aliquotaImpostos: null, criterioRateio: 'receita' } },
  obras: { o1: obra({ nome: 'Casa Entregue', empresaId: 'emp1' }) },
  config: { garantia_prazos: { linhas: [{ sistema: 'Hidráulica', meses: 12 }, { sistema: 'Elétrica', meses: 24 }] } }
}, extra || {});

test('pós-obra · addMeses respeita fim de mês', async () => {
  const e = await abrir({ seed: seedBase() });
  assert.equal(e.x.addMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(e.x.addMeses('2026-03-15', 12), '2027-03-15');
  assert.equal(e.x.addMeses('2028-02-29', 12), '2029-02-28');
});

test('pós-obra · sem prazos padrão o app avisa e não inventa valores', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/garantias' });
  assert.match(e.app(), /Nenhum prazo padrão cadastrado/);
  assert.match(e.app(), /não assume prazos/);
  assert.equal(e.linhas('garantias').length, 0);
});

test('pós-obra · prazos padrão: formato validado e salvo', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/obra/o1/garantias' });
  await e.click('[data-act="pos-prazos"]');
  await e.submit({ texto: 'Hidráulica; doze' });
  assert.match(e.erroForm(), /Linha 1/);
  await e.submit({ texto: 'Hidráulica; 12\nElétrica; 24' });
  assert.deepEqual(JSON.parse(JSON.stringify(e.linhas('config').find((c) => c.id === 'garantia_prazos').linhas)), [{ sistema: 'Hidráulica', meses: 12 }, { sistema: 'Elétrica', meses: 24 }]);
});

test('pós-obra · registrar entrega cria garantias dos prazos padrão e as visitas de 30, 90 e 180 dias', async () => {
  const e = await abrir({ seed: seedBase(), hash: '#/obra/o1/garantias' });
  await e.click('[data-act="pos-entrega"]');
  await e.submit({ data: '2026-03-01' });
  const gs = e.linhas('garantias').sort((a, b) => a.sistema.localeCompare(b.sistema));
  assert.deepEqual(gs.map((g) => [g.sistema, g.inicio, g.fim]), [['Elétrica', '2026-03-01', '2028-03-01'], ['Hidráulica', '2026-03-01', '2027-03-01']]);
  const vs = e.linhas('visitasPosObra').sort((a, b) => a.marco - b.marco);
  assert.deepEqual(vs.map((v) => [v.marco, v.dataPrevista, v.status]), [[30, '2026-03-31', 'pendente'], [90, '2026-05-30', 'pendente'], [180, '2026-08-28', 'pendente']]);
  assert.equal(e.linhas('obras')[0].entregueEm, '2026-03-01');
});

test('pós-obra · corrigir a data de entrega recalcula sem duplicar e preserva visita realizada', async () => {
  const e = await abrir({ seed: seedBase(), hash: '#/obra/o1/garantias' });
  await e.click('[data-act="pos-entrega"]'); await e.submit({ data: '2026-03-01' });
  const v30 = e.linhas('visitasPosObra').find((v) => v.marco === 30);
  await e.recarrega('visitasPosObra', v30.id, Object.assign({}, v30, { status: 'realizada', dataRealizada: '2026-04-02' }));
  await e.click('[data-act="pos-entrega"]'); await e.submit({ data: '2026-03-10' });
  assert.equal(e.linhas('garantias').length, 2);
  assert.equal(e.linhas('visitasPosObra').length, 3);
  assert.equal(e.linhas('visitasPosObra').find((v) => v.marco === 30).status, 'realizada');
  assert.equal(e.linhas('visitasPosObra').find((v) => v.marco === 90).dataPrevista, '2026-06-08');
  assert.equal(e.linhas('garantias').find((g) => g.sistema === 'Hidráulica').fim, '2027-03-10');
});

test('pós-obra · garantia manual só depois da entrega; cálculo do fim', async () => {
  const e = await abrir({ seed: seedBase(), hash: '#/obra/o1/garantias' });
  await e.click('[data-act="gar-nova"]');
  await e.submit({ sistema: 'Piso', inicio: '2026-03-01', meses: 6 });
  assert.match(e.erroForm(), /só começa a correr depois da entrega/);
  await e.recarrega('obras', 'o1', Object.assign({}, e.linhas('obras')[0], { entregueEm: '2026-03-01' }));
  await e.submit({ sistema: 'Piso', inicio: '2026-03-01', meses: 6 });
  const g = e.linhas('garantias')[0];
  assert.equal(g.fim, '2026-09-01');
});

test('pós-obra · alerta de garantia a vencer (janelas de 30 e 60 dias)', async () => {
  const seed = seedBase({ garantias: { g1: { obraId: 'o1', sistema: 'Hidráulica', inicio: dia(-300), meses: 12, fim: dia(20) }, g2: { obraId: 'o1', sistema: 'Elétrica', fim: dia(400) } } });
  const e = await abrir({ seed, hash: '#/obra/o1/resumo' });
  assert.match(e.app(), /1 garantia vence em até 60 dias: Hidráulica/);
});

const chamado = (over) => Object.assign({ obraId: 'o1', sistema: 'Hidráulica', ambiente: 'Banheiro', descricao: 'Vazamento no chuveiro', urgencia: 'alta', status: 'aberto', abertoPor: 'equipe', criadoEm: new Date().toISOString(), slaRespDias: 3, slaResDias: 10, hist: [] }, over || {});

test('pós-obra · abrir chamado grava o SLA da urgência (padrão provisório)', async () => {
  const e = await abrir({ seed: seedBase(), hash: '#/obra/o1/chamados' });
  await e.click('[data-act="cham-novo"]');
  await e.submit({ sistema: 'Elétrica', ambiente: 'Sala', descricao: 'Tomada sem energia', urgencia: 'critica' });
  const c = e.linhas('chamadosGarantia')[0];
  assert.equal(c.status, 'aberto'); assert.equal(c.abertoPor, 'equipe');
  assert.equal(c.slaRespDias, 1); assert.equal(c.slaResDias, 3);
});

test('pós-obra · SLA: fora do prazo pela resposta e pela resolução', async () => {
  const e = await abrir({ seed: seedBase() });
  const c = (status, d, r, s) => ({ status, criadoEm: dia(-d) + 'T10:00:00Z', slaRespDias: r, slaResDias: s });
  assert.equal(e.x.chForaSLA(c('aberto', 4, 3, 30)), true);
  assert.equal(e.x.chForaSLA(c('aberto', 3, 3, 30)), false);
  assert.equal(e.x.chForaSLA(c('em_atendimento', 4, 3, 30)), false);
  assert.equal(e.x.chForaSLA(c('em_atendimento', 11, 3, 10)), true);
  assert.equal(e.x.chForaSLA(c('resolvido', 99, 3, 10)), false);
  assert.equal(e.x.chForaSLA(c('negado', 99, 3, 10)), false);
});

test('pós-obra · negar exige justificativa; não coberto encerra como negado', async () => {
  const e = await abrir({ seed: seedBase({ chamadosGarantia: { c1: chamado() } }), hash: '#/obra/o1/chamados' });
  await e.click('[data-act="cham-parecer"][data-id="c1"]');
  await e.submit({ parecer: 'nao_coberto', justificativa: '' });
  assert.match(e.erroForm(), /justificativa é obrigatória/);
  await e.submit({ parecer: 'nao_coberto', justificativa: 'Mau uso: registro trocado pelo morador.' });
  const c = e.linhas('chamadosGarantia')[0];
  assert.equal(c.status, 'negado'); assert.equal(c.parecer, 'nao_coberto'); assert.match(c.justificativa, /Mau uso/);
  assert.match(e.app(), /Negado/);
});

test('pós-obra · resolver exige parecer coberto ou parcial', async () => {
  const e = await abrir({ seed: seedBase({ chamadosGarantia: { c1: chamado() } }), hash: '#/obra/o1/chamados' });
  await e.click('[data-act="cham-resolver"][data-id="c1"]');
  assert.match(e.doc.getElementById('toast').textContent, /Registre o parecer/);
  assert.equal(e.dlgAberto(), false);
});

test('pós-obra · resolver com custo lança custo direto no DRE (mês atual) e guarda o custo à parte', async () => {
  const e = await abrir({ seed: seedBase({ chamadosGarantia: { c1: chamado({ parecer: 'coberto', status: 'em_atendimento' }) } }), hash: '#/obra/o1/chamados' });
  await e.click('[data-act="cham-resolver"][data-id="c1"]');
  await e.submit({ obs: 'Trocado o registro.', custo: '350.50' });
  const c = e.linhas('chamadosGarantia')[0];
  assert.equal(c.status, 'resolvido'); assert.equal(c.resolvidoEm, dia(0));
  const cus = e.linhas('chamadosCustos');
  assert.equal(cus.length, 1); assert.equal(cus[0].valor, 350.5);
  const l = e.linhas('lancamentos');
  assert.equal(l.length, 1);
  assert.deepEqual([l[0].categoria, l[0].subcategoria, l[0].valor, l[0].origem, l[0].competencia, l[0].empresaId], ['custo_direto', 'Garantia', 350.5, 'garantia', dia(0).slice(0, 7), 'emp1']);
});

test('pós-obra · resolver de novo não duplica o lançamento; sem empresa o custo não vai ao DRE', async () => {
  const e = await abrir({ seed: seedBase({ chamadosGarantia: { c1: chamado({ parecer: 'coberto', status: 'em_atendimento' }) } }), hash: '#/obra/o1/chamados' });
  await e.click('[data-act="cham-resolver"][data-id="c1"]'); await e.submit({ obs: 'ok', custo: '100' });
  const c1 = e.linhas('chamadosGarantia')[0];
  await e.recarrega('chamadosGarantia', 'c1', Object.assign({}, c1, { status: 'em_atendimento' }));
  await e.click('[data-act="cham-resolver"][data-id="c1"]'); await e.submit({ obs: 'ok de novo', custo: '120' });
  assert.equal(e.linhas('lancamentos').length, 1);
  assert.equal(e.linhas('lancamentos')[0].valor, 120);
  const s = await abrir({ seed: { obras: { o1: obra() }, chamadosGarantia: { c1: chamado({ parecer: 'coberto', status: 'em_atendimento' }) } }, hash: '#/obra/o1/chamados' });
  await s.click('[data-act="cham-resolver"][data-id="c1"]'); await s.submit({ obs: 'feito', custo: '90' });
  assert.equal(s.linhas('lancamentos').length, 0);
  assert.equal(s.linhas('chamadosCustos').length, 1);
  assert.match(s.doc.getElementById('toast').textContent, /não tem empresa/);
});

test('pós-obra · agendar visita do chamado entra na agenda', async () => {
  const e = await abrir({ seed: seedBase({ chamadosGarantia: { c1: chamado() } }), hash: '#/obra/o1/chamados' });
  await e.click('[data-act="cham-visita"][data-id="c1"]');
  await e.submit({ data: dia(5), hora: '14:00' });
  assert.equal(e.linhas('chamadosGarantia')[0].status, 'visita_agendada');
  const ev = e.linhas('eventos');
  assert.equal(ev.length, 1); assert.equal(ev[0].data, dia(5)); assert.match(ev[0].titulo, /Visita de assistência: Hidráulica/);
});

test('pós-obra · visita: pendência exige descrição e vira chamado', async () => {
  const seed = seedBase({ visitasPosObra: { v1: { obraId: 'o1', marco: 30, status: 'pendente', dataPrevista: dia(2) } } });
  const e = await abrir({ seed, hash: '#/obra/o1/visitas' });
  await e.click('[data-act="vis-fazer"][data-id="v1"]');
  await e.submit({ r3: 'pend', o3: '' });
  assert.match(e.erroForm(), /Descreva cada pendência/);
  await e.submit({ r3: 'pend', o3: 'Janela raspando no batente', obs: 'Tudo bem, com um ajuste.' });
  const v = e.linhas('visitasPosObra')[0];
  assert.equal(v.status, 'realizada'); assert.equal(v.obs, 'Tudo bem, com um ajuste.');
  const cs = e.linhas('chamadosGarantia');
  assert.equal(cs.length, 1); assert.equal(cs[0].sistema, 'Esquadrias'); assert.match(cs[0].descricao, /Janela raspando/); assert.equal(cs[0].origemVisita, 'v1');
});

test('pós-obra · satisfação: nota fora de 0–10 é recusada e a resposta fica gravada uma vez', async () => {
  const seed = seedBase({ obras: { o1: obra({ empresaId: 'emp1', entregueEm: '2026-03-01' }) } });
  const e = await abrir({ seed, hash: '#/obra/o1/satisfacao' });
  assert.deepEqual(Array.from(e.x.pesquisasPedidas(e.linhas('obras')[0])), ['entrega']);
  e.x.pesquisaForm('o1', 'entrega'); await e.tick(80);
  await e.submit({ recomendacao: '11', qualidade: '9', prazo: '9', comunicacao: '9', limpeza: '9' });
  assert.match(e.erroForm(), /nota de 0 a 10/);
  await e.submit({ recomendacao: '6', qualidade: '8', prazo: '7', comunicacao: '9', limpeza: '10', comentario: 'Demorou' });
  const p = e.linhas('pesquisasSatisfacao');
  assert.equal(p.length, 1); assert.equal(p[0].id, 'o1_entrega'); assert.equal(p[0].notas.recomendacao, 6);
  assert.deepEqual(Array.from(e.x.pesquisasPedidas(e.linhas('obras')[0])), []);
  await e.go('#/obra/o1/resumo');
  assert.match(e.app(), /nota abaixo de 7/);
});

test('pós-obra · indicador de satisfação: média, distribuição e comparação por tipologia', async () => {
  const seed = seedBase({
    obras: { o1: obra({ entregueEm: '2026-03-01' }), o2: obra({ nome: 'Outra', tipologia: 'Sobrado' }) },
    pesquisasSatisfacao: {
      o1_entrega: { obraId: 'o1', marco: 'entrega', notas: { recomendacao: 10, qualidade: 9, prazo: 9, comunicacao: 9, limpeza: 9 } },
      o1_30: { obraId: 'o1', marco: 30, notas: { recomendacao: 8, qualidade: 8, prazo: 8, comunicacao: 8, limpeza: 8 } },
      o2_entrega: { obraId: 'o2', marco: 'entrega', notas: { recomendacao: 4, qualidade: 5, prazo: 5, comunicacao: 5, limpeza: 5 } }
    }
  });
  const e = await abrir({ seed, hash: '#/obra/o1/satisfacao' });
  const t = e.app();
  assert.match(t, /Esta obra29110/);
  assert.match(t, /Todas as obras37,33111/);
});

/* ---------- portal do cliente (Supabase simulado com perfil cliente) ---------- */
const portal = (extra) => abrir({ supa: Object.assign({ perfil: { papel: 'cliente', nome: 'Maria' }, seed: {
  obras: { o1: { obra_id: 'o1', dados: obra({ nome: 'Casa da Maria', entregueEm: '2026-03-01' }) } },
  garantias: { g1: { obra_id: 'o1', dados: { obraId: 'o1', sistema: 'Hidráulica', inicio: '2026-03-01', meses: 12, fim: '2027-03-01' } } },
  chamadosGarantia: { c1: { obra_id: 'o1', dados: chamado({ status: 'resolvido', resolvidoEm: dia(-1), solucao: 'Trocado o registro.' }) } },
  visitasPosObra: { v1: { obra_id: 'o1', dados: { obraId: 'o1', marco: 30, status: 'realizada', dataPrevista: dia(-10), dataRealizada: dia(-9), obs: 'Tudo certo.', checklist: [] } } }
} }, extra || {}), hash: '#/obra/o1/chamados' });

test('portal do cliente · só vê Pós-obra e Relatório, sem alertas internos, régua ou menus da equipe', async () => {
  const e = await portal();
  const grupos = Array.from(e.doc.querySelectorAll('nav.grupos a')).map((a) => a.textContent);
  assert.deepEqual(grupos, ['Gestão', 'Pós-obra']);
  const top = e.doc.querySelector('.top').textContent;
  assert.match(top, /Minha obra/);
  assert.doesNotMatch(top, /Agenda|Prestadores|Fornecedores|DRE|Nuvem|Exportar/);
  assert.equal(e.doc.querySelector('.regua, .legenda'), null);
  assert.doesNotMatch(e.app(), /Somente leitura|somente leitura/);
  await e.go('#/obra/o1/financeiro');   // aba da equipe: cai no portal, não mostra financeiro
  assert.doesNotMatch(e.app(), /Contas a pagar/);
  await e.go('#/painel');
  assert.match(e.app(), /Casa da Maria/);
});

test('portal do cliente · abre chamado, confirma a resolução pelo servidor e responde a pesquisa', async () => {
  const e = await portal();
  await e.click('[data-act="cham-novo"]');
  await e.submit({ sistema: 'Elétrica', ambiente: 'Cozinha', descricao: 'Tomada esquenta', urgencia: 'alta' });
  const novo = e.supa.linhas('chamadosGarantia').find((c) => c.dados.sistema === 'Elétrica');
  assert.ok(novo, 'chamado gravado');
  assert.equal(novo.obra_id, 'o1'); assert.equal(novo.dados.abertoPor, 'cliente'); assert.equal(novo.dados.status, 'aberto'); assert.equal(novo.dados.parecer, undefined);
  assert.equal(novo.dados.prestadorId, undefined);
  // confirmar resolução: usa a função do servidor (rpc), nunca grava o aceite direto
  e.supa.cli.rpc = async (nome, args) => { e.supa.log.push({ t: 'rpc:' + nome, payload: args }); const r = e.supa.tabelas.chamadosGarantia.get(args.rid); r.dados.aceiteCliente = { aceito: args.aceito, texto: args.texto }; r.versao += 1; return { error: null }; };
  await e.click('[data-act="cham-aceite"][data-id="c1"]');
  await e.submit({ aceito: 'nao', texto: '' });
  assert.match(e.erroForm(), /Explique/);
  await e.submit({ aceito: 'sim', texto: 'Resolvido, obrigado' });
  const rpc = e.supa.log.find((x) => x.t === 'rpc:aceitar_chamado');
  assert.deepEqual(JSON.parse(JSON.stringify(rpc.payload)), { rid: 'c1', aceito: true, texto: 'Resolvido, obrigado' });
  assert.ok(!e.supa.log.some((x) => x.t === 'chamadosGarantia' && x.op === 'update' && x.payload && x.payload.dados && x.payload.dados.aceiteCliente), 'aceite não é gravado direto');
  // pesquisa
  await e.go('#/obra/o1/satisfacao');
  assert.match(e.app(), /Entrega da obra/);
  await e.click('[data-act="pesq-responder"][data-marco="entrega"]');
  await e.submit({ recomendacao: '10', qualidade: '9', prazo: '9', comunicacao: '10', limpeza: '8' });
  const p = e.supa.linhas('pesquisasSatisfacao')[0];
  assert.equal(p.id, 'o1_entrega'); assert.equal(p.dados.notas.recomendacao, 10);
});

test('portal do cliente · não vê botões de equipe, custos nem visita pendente', async () => {
  const e = await portal({ seed: { obras: { o1: { obra_id: 'o1', dados: obra({ nome: 'Casa da Maria' }) } },
    chamadosGarantia: { c1: { obra_id: 'o1', dados: chamado() } },
    visitasPosObra: { v1: { obra_id: 'o1', dados: { obraId: 'o1', marco: 30, status: 'pendente', dataPrevista: dia(2) } } } } });
  for (const a of ['cham-parecer', 'cham-visita', 'cham-resolver', 'cham-editar', 'pos-sla']) assert.equal(e.doc.querySelector('[data-act="' + a + '"]'), null, a);
  await e.go('#/obra/o1/visitas');
  assert.match(e.app(), /Nenhuma visita realizada ainda/);
  assert.doesNotMatch(e.app(), /R\$/);
});

test('portal do cliente · texto de chamado é escapado', async () => {
  const e = await portal({ seed: { obras: { o1: { obra_id: 'o1', dados: obra() } }, chamadosGarantia: { c1: { obra_id: 'o1', dados: chamado({ descricao: '<img src=x onerror="window.__p=1">' }) } } } });
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__p, undefined);
});

test('pós-obra · chamado coberto atribuído ao prestador reduz a reincidência sugerida na avaliação', async () => {
  const seed = seedBase({ prestadores: { p1: { nome: 'João' } }, chamadosGarantia: { c1: chamado({ prestadorId: 'p1', parecer: 'coberto' }), c2: chamado({ prestadorId: 'p1', parecer: 'nao_coberto' }), c3: chamado({ prestadorId: 'p2', parecer: 'coberto' }) } });
  const e = await abrir({ seed });
  assert.equal(e.x.avSugestoes('o1', 'p1').reincidencia, 8);
  assert.equal(e.x.avSugestoes('o1', 'p9').reincidencia, null);
});

test('pós-obra · incidência de garantia por sistema aparece no encerramento', async () => {
  const seed = seedBase({ obras: { o1: obra({ entregueEm: '2026-03-01' }), o2: obra({ nome: 'B', entregueEm: '2026-04-01' }) },
    chamadosGarantia: { c1: chamado({ sistema: 'Hidráulica', parecer: 'coberto' }), c2: chamado({ obraId: 'o2', sistema: 'Hidráulica', parecer: 'parcial' }), c3: chamado({ sistema: 'Pintura', parecer: 'nao_coberto' }) },
    chamadosCustos: { c1: { obraId: 'o1', chamadoId: 'c1', valor: 200 }, c2: { obraId: 'o2', chamadoId: 'c2', valor: 150.5 } } });
  const e = await abrir({ seed, hash: '#/obra/o1/encerramento' });
  const inc = JSON.parse(JSON.stringify(e.x.garantiaInc()));
  assert.equal(inc.entregues, 2);
  assert.deepEqual(inc.linhas[0], { sistema: 'Hidráulica', chamados: 2, cobertos: 2, obras: 2, custo: 350.5 });
  assert.match(e.app(), /Incidência de garantia por sistema/);
});
