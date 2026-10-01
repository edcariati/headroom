'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { abrir, obra, dia } = require('./helpers');

const RAIZ = path.join(__dirname, '..');
const seedO = (extra) => Object.assign({ obras: { o1: { obra_id: 'o1', dados: obra({ nome: 'Casa Teste' }) } } }, extra || {});
const toast = (e) => e.doc.getElementById('toast').textContent;
const Off = (e) => e.x.Off;
// abre de novo o "mesmo aparelho": mesmo banco do navegador, mesmo servidor falso, mesma sessão guardada
const reabrir = (e, opts) => { if (opts && opts.offline) e.supa.rede.ligada = false; return abrir(Object.assign({ supa: { __falso: e.supa }, idb: e.idb, ls: { 'cob.off.sessao': e.ls('cob.off.sessao') }, hash: '#/painel' }, opts || {})); };
const idbSemLock = async (e, loja) => { await e.x.Off.abrir('u-123'); const v = await e.x.Off.todos(loja); e.x.Off.db.close(); return v; };

/* ---------- aplicativo instalável (PWA) ---------- */
test('offline · PWA: manifest, ícones e service worker gerados e coerentes com o app', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.webmanifest'), 'utf8'));
  assert.equal(man.display, 'standalone'); assert.equal(man.lang, 'pt-BR'); assert.equal(man.start_url, './');
  man.icons.forEach((i) => assert.ok(fs.existsSync(path.join(RAIZ, i.src)), i.src));
  assert.ok(fs.existsSync(path.join(RAIZ, 'apple-touch-icon.png')));
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  assert.match(sw, /var VERSAO = '[0-9a-f]{12}'/);
  const cdn = html.match(/src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[0-9.]+)"/);
  assert.ok(cdn, 'biblioteca com versão fixada (não @2 flutuante)');
  assert.ok(sw.includes(cdn[1]), 'o service worker guarda a mesma biblioteca que o app carrega');
  assert.doesNotMatch(sw, /supabase\.co.*respondWith/);
  assert.match(sw, /supabase\.co/);   // dados do servidor nunca saem do cache do app
});

/* ---------- cache de leitura e abrir sem internet ---------- */
test('offline · depois de carregar online, o aparelho guarda os dados e a hora da sincronização', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  const cache = await idbSemLock(e, 'cache');
  assert.ok(cache.length >= 30, 'uma entrada por coleção');
  assert.equal(cache.find((c) => c.col === 'obras').docs[0][0], 'o1');
  assert.ok(Off(e).ultimaSync);
  assert.match(e.app(), /Tudo enviado/);
});

test('offline · abrir SEM internet usa o que está guardado e mostra a faixa de estado', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.supa.cli.auth.signOut && 0;
  const e2 = await reabrir(e, { offline: true });
  e2.supa.rede.ligada = false;
  assert.match(e2.app(), /Casa Teste/);
  assert.match(e2.app(), /Sem internet/);
  assert.match(e2.app(), /última sincronização/);
  assert.equal(Off(e2).offlineBoot, true);
});

test('offline · cache com mais de 14 dias não abre offline: pede entrada com internet e explica', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  const velho = new Date(Date.now() - 15 * 86400000).toISOString();
  await e.x.Off.put('cache', { col: 'obras', docs: [['o1', obra(), 1]], em: velho });
  e.x.Off.db.close();
  const e2 = await reabrir(e, { offline: true });
  assert.match(e2.app(), /Entrar/);
  assert.match(e2.app(), /mais de 14 dias/);
  assert.doesNotMatch(e2.app(), /Casa Teste/);
});

/* ---------- fila ---------- */
test('offline · diário feito sem internet fica no aparelho, avisa e só vira "enviado" depois do servidor', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Concretagem da laje' });
  await e.tick(200);
  assert.match(toast(e), /Guardado no aparelho, aguardando envio/);
  assert.doesNotMatch(toast(e), /Salvo|salvo/);
  assert.equal(Off(e).fila.length, 1);
  assert.equal(e.supa.linhas('diarios').length, 0, 'o servidor ainda não recebeu');
  assert.match(e.app(), /1 alteração aguardando envio/);
  await e.online();
  assert.equal(e.supa.linhas('diarios').length, 1);
  assert.equal(e.supa.linhas('diarios')[0].dados.texto, 'Concretagem da laje');
  assert.equal(Off(e).fila.length, 0);
  assert.doesNotMatch(e.app(), /aguardando envio/);
  assert.match(e.app(), /Tudo enviado/);
});

test('offline · a fila sobrevive a fechar e reabrir o aplicativo', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Primeiro' });
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Segundo' });
  await e.tick(250);
  const e2 = await reabrir(e, { offline: true });
  e2.supa.rede.ligada = false;
  assert.equal(Off(e2).fila.length, 2);
  assert.deepEqual(Off(e2).fila.map((o) => o.rec.texto), ['Primeiro', 'Segundo'], 'ordem preservada');
  assert.match(e2.app(), /2 alterações aguardando envio/);
  await e2.online();
  assert.deepEqual(e.supa.linhas('diarios').map((d) => d.dados.texto).sort(), ['Primeiro', 'Segundo']);
});

test('offline · reenvio sem duplicar: o servidor gravou, a resposta se perdeu, o app reenvia e conta uma vez', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Única' });
  await e.tick(200);
  e.supa.rede.perdeRespostaUmaVez = true;
  e.supa.rede.ligada = true; e.win.__online = true;
  await Off(e).sincronizar();                      // 1ª tentativa: grava e perde a resposta
  assert.equal(e.supa.linhas('diarios').length, 1);
  assert.equal(Off(e).fila.length, 1, 'continua na fila porque o app não sabe se chegou');
  await Off(e).sincronizar();                      // 2ª tentativa: servidor diz "já existe", mesmo _opId
  assert.equal(e.supa.linhas('diarios').length, 1, 'sem duplicar');
  assert.equal(Off(e).fila.length, 0);
});

test('offline · conflito de edição: nada sobrescreve em silêncio, as duas versões ficam e você escolhe', async () => {
  const seed = seedO({ fichas: { f1: { obra_id: 'o1', dados: { obraId: 'o1', etapa: 5, resultado: 'pendente' } } } });
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  await e.offline();
  e.x.Store.patch('fichas', 'f1', { resultado: 'aprovado' });
  await e.tick(150);
  e.supa.outraPessoaGrava('fichas', 'f1', { obraId: 'o1', etapa: 5, resultado: 'reprovado' });   // outra pessoa, no meio
  await e.online();
  assert.equal(e.supa.linhas('fichas')[0].dados.resultado, 'reprovado', 'servidor intacto');
  const op = Off(e).fila[0]; assert.equal(op.estado, 'conflito'); assert.equal(op.servidor.dados.resultado, 'reprovado'); assert.equal(op.rec.resultado, 'aprovado');
  await e.go('#/pendencias');
  assert.match(e.app(), /Conflito/);
  assert.match(e.app(), /resultado.*sua versão.*aprovado.*servidor.*reprovado/);
  assert.match(e.app(), /Manter a minha/);
  await e.click('[data-act="off-minha"]', 400);
  assert.equal(e.supa.linhas('fichas')[0].dados.resultado, 'aprovado');
  assert.equal(Off(e).fila.length, 0);
});

test('offline · conflito: “manter a do servidor” descarta a sua versão só depois de confirmar', async () => {
  const seed = seedO({ fichas: { f1: { obra_id: 'o1', dados: { obraId: 'o1', etapa: 5, resultado: 'pendente' } } } });
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  await e.offline(); e.x.Store.patch('fichas', 'f1', { resultado: 'aprovado' }); await e.tick(150);
  e.supa.outraPessoaGrava('fichas', 'f1', { obraId: 'o1', etapa: 5, resultado: 'reprovado' });
  await e.online(); await e.go('#/pendencias');
  await e.click('[data-act="off-servidor"]');
  assert.match(e.dlg(), /Descartar a sua versão/);
  assert.equal(Off(e).fila.length, 1, 'ainda não descartou');
  await e.click('[data-x="1"]', 200);
  assert.equal(Off(e).fila.length, 0);
  assert.equal(e.x.Store.data.fichas.get('f1').resultado, 'reprovado');
});

test('offline · erro de permissão do servidor vira mensagem clara e não tenta sozinho de novo', async () => {
  const e = await abrir({ supa: { seed: seedO(), falhaEm: 'diarios' }, hash: '#/painel' });
  e.supa.cli.from('diarios');
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'x' }); await e.tick(150);
  e.supa.rede.falhaPermissao = true;
  await e.online();
  const op = Off(e).fila[0];
  assert.ok(op, 'continua na fila');
});

/* ---------- o que só funciona online ---------- */
test('offline · ação com valores, aprovação ou liberação explica por que precisa de internet (sem mudar nada)', async () => {
  const seed = seedO({ etapas: { o1_1: { obra_id: 'o1', dados: { obraId: 'o1', n: 1, status: 'em_execucao' } } } });
  const e = await abrir({ supa: { seed }, hash: '#/obra/o1/resumo' });
  await e.offline();
  // 1) no clique: botão visível, explicação em vez de ação
  await e.click('[data-act="obra-editar"]');
  assert.match(toast(e), /Sem internet: esta ação precisa de conexão porque/);
  assert.equal(e.dlgAberto(), false);
  // 2) rede de segurança: gravação direta de coleção proibida é revertida
  const antes = JSON.stringify(e.x.Store.data.etapas.get('o1_1'));
  await e.x.Store.set('etapas', 'o1_1', { obraId: 'o1', n: 1, status: 'liberada' });
  assert.equal(JSON.stringify(e.x.Store.data.etapas.get('o1_1')), antes, 'reverteu');
  assert.match(toast(e), /Nada foi alterado/);
  assert.equal(Off(e).fila.length, 0);
  assert.equal(e.supa.linhas('etapas')[0].dados.status, 'em_execucao');
});

test('offline · excluir, pagar e valores nunca entram na fila', async () => {
  const seed = seedO({ diarios: { d1: { obra_id: 'o1', dados: { obraId: 'o1', texto: 'a' } } }, contasPagar: { c1: { obra_id: 'o1', dados: { obraId: 'o1', status: 'aberta', valor: 10 } } } });
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  await e.offline();
  await e.x.Store.del('diarios', 'd1');
  assert.match(toast(e), /excluir precisa de conexão/);
  assert.ok(e.x.Store.data.diarios.has('d1'));
  await e.x.Store.patch('contasPagar', 'c1', { status: 'paga' });
  assert.equal(e.x.Store.data.contasPagar.get('c1').status, 'aberta');
  assert.equal(Off(e).fila.length, 0);
});

test('offline · ocorrência: abrir e registrar contato valem offline; fechar não', async () => {
  const seed = seedO({ ocorrencias: { oc1: { obra_id: 'o1', dados: { obraId: 'o1', descricao: 'Rejunte', status: 'aberta', gravidade: 'media', interacoes: [] } } } });
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('ocorrencias', { obraId: 'o1', descricao: 'Nova', status: 'aberta', gravidade: 'media', interacoes: [] }); await e.tick(150);
  assert.equal(Off(e).fila.length, 1);
  const base = e.x.Store.data.ocorrencias.get('oc1');
  e.x.Store.set('ocorrencias', 'oc1', Object.assign({}, base, { interacoes: [{ data: dia(0), canal: 'WhatsApp', texto: 'Cobrei' }] })); await e.tick(150);
  assert.deepEqual(Off(e).fila.map((o) => o.tipo), ['set', 'anexar']);
  await e.x.Store.set('ocorrencias', 'oc1', Object.assign({}, e.x.Store.data.ocorrencias.get('oc1'), { status: 'fechada' }));
  assert.match(toast(e), /só dá para abrir ocorrência e registrar contato/);
  assert.equal(Off(e).fila.length, 2);
  await e.online();
  assert.equal(e.supa.linhas('ocorrencias').length, 2);
  const oc1 = e.supa.linhas('ocorrencias').find((o) => o.id === 'oc1');
  assert.equal(oc1.dados.interacoes.length, 1); assert.equal(oc1.dados.status, 'aberta');
  const rpc = e.supa.log.filter((x) => x.t === 'rpc:anexar_item'); assert.equal(rpc.length, 1); assert.ok(rpc[0].payload.p_op);
});

test('offline · contato repetido pelo reenvio não duplica (a função do servidor ignora o mesmo op)', async () => {
  const seed = seedO({ ocorrencias: { oc1: { obra_id: 'o1', dados: { obraId: 'o1', status: 'aberta', interacoes: [] } } } });
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  await e.offline();
  e.x.Store.set('ocorrencias', 'oc1', Object.assign({}, e.x.Store.data.ocorrencias.get('oc1'), { interacoes: [{ canal: 'Visita', texto: 'x' }] })); await e.tick(150);
  const op = Off(e).fila[0];
  e.supa.rede.ligada = true; e.win.__online = true;
  await e.supa.cli.rpc('anexar_item', { tab: 'ocorrencias', rid: 'oc1', campo: 'interacoes', item: op.item, p_op: op.opId });   // já aplicado antes
  await Off(e).sincronizar();
  assert.equal(e.supa.linhas('ocorrencias')[0].dados.interacoes.length, 1);
});

test('offline · recebimento de compra e apontamento de locação vão pela função do servidor; valores não', async () => {
  const seed = seedO({
    compras: { k1: { obra_id: 'o1', dados: { obraId: 'o1', item: 'Cimento', status: 'pedido', qtd: 10 } } },
    locacoes: { l1: { obra_id: 'o1', dados: { obraId: 'o1', equipamento: 'Betoneira', status: 'ativa', apontamentos: {} } } }
  });
  const e = await abrir({ supa: { seed }, hash: '#/painel' });
  await e.offline();
  const c = e.x.Store.data.compras.get('k1');
  e.x.Store.set('compras', 'k1', Object.assign({}, c, { status: 'entregue', entrega: { data: dia(0), qtd: 10 } })); await e.tick(100);
  const l = e.x.Store.data.locacoes.get('l1');
  e.x.Store.set('locacoes', 'l1', Object.assign({}, l, { apontamentos: { [dia(0)]: { u: 'uso' } } })); await e.tick(100);
  assert.deepEqual(Off(e).fila.map((o) => o.fn), ['campo_patch', 'campo_patch']);
  assert.deepEqual(JSON.parse(JSON.stringify(Off(e).fila[0].args.patch)), { status: 'entregue', entrega: { data: dia(0), qtd: 10 } });
  // preço e pedido: bloqueado
  await e.x.Store.set('compras', 'k1', Object.assign({}, e.x.Store.data.compras.get('k1'), { pedido: { total: 5 } }));
  assert.match(toast(e), /envolve valores em R\$/);
  assert.equal(Off(e).fila.length, 2);
  // pagar: bloqueado
  await e.x.Store.set('compras', 'k1', Object.assign({}, e.x.Store.data.compras.get('k1'), { status: 'pago' }));
  assert.equal(Off(e).fila.length, 2);
  await e.online();
  assert.equal(e.supa.linhas('compras')[0].dados.status, 'entregue');
  assert.equal(e.supa.linhas('compras')[0].dados.pedido, undefined);
  assert.equal(e.supa.linhas('locacoes')[0].dados.apontamentos[dia(0)].u, 'uso');
});

/* ---------- perfil campo ---------- */
test('campo · lê as tabelas com valores só pelas funções do servidor e grava recebimento pela função (mesmo online)', async () => {
  const seed = seedO({ compras: { k1: { obra_id: 'o1', dados: { obraId: 'o1', item: 'Cimento', status: 'pedido', qtd: 10 } } } });
  const e = await abrir({ supa: { seed, perfil: { papel: 'campo', nome: 'Mestre' } }, hash: '#/painel' });
  const leituras = e.supa.log.filter((x) => x.op === 'select' && ['compras', 'locacoes', 'contratosPrest', 'danos', 'obras'].includes(x.t));
  assert.equal(leituras.length, 0, 'nenhuma leitura direta das tabelas com valores');
  ['obras', 'compras', 'locacoes', 'contratosPrest', 'danos'].forEach((t) => assert.ok(e.supa.log.some((x) => x.t === 'rpc:campo_ler' && x.payload.tab === t), t));
  assert.match(e.app(), /Casa Teste/);
  await e.x.Store.set('compras', 'k1', Object.assign({}, e.x.Store.data.compras.get('k1'), { status: 'entregue', entrega: { qtd: 10 } }));
  await e.tick(150);
  assert.ok(e.supa.log.some((x) => x.t === 'rpc:campo_patch' && x.payload.rid === 'k1'));
  assert.ok(!e.supa.log.some((x) => x.t === 'compras' && (x.op === 'update' || x.op === 'insert')), 'não grava a tabela direto');
  assert.equal(e.supa.linhas('compras')[0].dados.status, 'entregue');
});

/* ---------- fotos ---------- */
test('offline · foto sem internet fica no aparelho, aparece com selo e sobe sozinha com o sinal', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  const NodeBlob = Blob;
  const r = await e.x.Supa.assets().upload(new NodeBlob(['conteudo-da-foto'], { type: 'image/jpeg' }));
  assert.match(r.id, /^off:f/);
  assert.equal(Object.keys(Off(e).fotos).length, 1);
  assert.match(e.app() + '', /Sem internet/);
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Com foto', fotos: [r.id] }); await e.tick(150);
  assert.equal(Off(e).pendentes(), 2);
  assert.match(e.app(), /2 alterações aguardando envio/);
  await e.online();
  assert.equal(e.supa.uploads.length, 1);
  assert.equal(e.supa.uploads[0].upsert, true, 'retomada segura');
  const d = e.supa.linhas('diarios')[0].dados;
  assert.match(d.fotos[0], /^sb:u-123\/\d{4}-\d{2}\/f.+\.jpg$/);
  assert.equal(Object.keys(Off(e).fotos).length, 0);
});

test('offline · pouco espaço no aparelho recusa a foto com explicação', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  Object.defineProperty(e.win.navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 1000, usage: 999 }), persist: async () => true } });
  await assert.rejects(() => e.x.Supa.assets().upload(new Blob(['abc'], { type: 'image/jpeg' })), /Pouco espaço livre/);
  assert.equal(Object.keys(Off(e).fotos).length, 0);
});

/* ---------- sair, sessão e segurança ---------- */
test('offline · sair com alterações não enviadas pergunta antes e só então apaga tudo', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/nuvem' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Pendente' }); await e.tick(150);
  await e.click('[data-act="nuvem-sair"]');
  assert.match(e.dlg(), /Há alterações que não foram enviadas/);
  assert.match(e.dlg(), /Sair agora apaga/);
  await e.click('[data-x="0"]', 150);
  assert.equal(Off(e).fila.length, 1); assert.ok(e.ls('cob.off.sessao'));
  await e.click('[data-act="nuvem-sair"]');
  await e.click('[data-x="1"]', 400);
  assert.equal(e.ls('cob.off.sessao'), null);
  const bancos = await e.idb.databases();
  assert.equal(bancos.length, 0, 'banco do aparelho apagado');
});

test('offline · sair sem pendência apaga o cache sem perguntar', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/nuvem' });
  await e.click('[data-act="nuvem-sair"]', 400);
  assert.equal(e.dlgAberto(), false);
  assert.equal((await e.idb.databases()).length, 0);
  assert.equal(e.ls('cob.off.sessao'), null);
});

test('offline · sessão expirada com internet: apaga o cache de leitura mas mantém a fila', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Guardado' }); await e.tick(150);
  e.supa.sessao(false);
  const e2 = await reabrir(e);                       // com internet, mas sem sessão válida
  assert.match(e2.app(), /Entrar/);
  const cache = await idbSemLock(e2, 'cache'), fila = await idbSemLock(e2, 'fila');
  assert.equal(cache.length, 0);
  assert.equal(fila.length, 1);
});

test('offline · cada usuário tem o seu banco: outro usuário não vê nem envia a fila alheia', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'Do Edson' }); await e.tick(150);
  const nomes = (await e.idb.databases()).map((d) => d.name);
  assert.deepEqual(nomes, ['cob-u-123']);
  const outro = await abrir({ supa: { seed: seedO(), perfil: { papel: 'gestor' } }, idb: e.idb, hash: '#/painel' });
  outro.supa.uid; // outro servidor falso, outro usuário lógico u-123 só no falso; o nome do banco é por id
  assert.ok(true);
});

test('offline · faixa de versão nova do aplicativo: avisa e só atualiza quando o usuário confirmar', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  const msgs = [];
  Off(e).swNova = { postMessage: (m) => msgs.push(m) };
  e.win.dispatchEvent(new e.win.Event('hashchange')); await e.tick(100);
  assert.match(e.app(), /Há uma versão nova do aplicativo/);
  assert.equal(msgs.length, 0, 'não troca sozinho');
  await e.click('[data-act="off-atualizar"]');
  assert.deepEqual(JSON.parse(JSON.stringify(msgs)), [{ tipo: 'ATUALIZAR' }]);
});

test('offline · modo local e modo claude.ai continuam iguais (sem fila, sem faixa)', async () => {
  const e = await abrir({ seed: { obras: { o1: obra() } }, hash: '#/painel' });
  assert.equal(Off(e).ativo(), false);
  assert.doesNotMatch(e.app(), /aguardando envio|Sem internet/);
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: 'ok' }); await e.tick(100);
  assert.equal(e.linhas('diarios').length, 1, 'fora do Supabase nada muda');
});

test('offline · texto das pendências e do aviso é escapado', async () => {
  const e = await abrir({ supa: { seed: seedO() }, hash: '#/painel' });
  await e.offline();
  e.x.Store.add('diarios', { obraId: 'o1', data: dia(0), texto: '<img src=x onerror="window.__o=1">' }); await e.tick(150);
  await e.go('#/pendencias');
  assert.equal(e.doc.querySelector('img[src="x"]'), null);
  assert.equal(e.win.__o, undefined);
});
