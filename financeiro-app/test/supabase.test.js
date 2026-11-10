import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreSupabase } from '../api/_lib/store-supabase.js';
import { carregarDados } from '../api/_lib/dados.js';
import { tratar } from '../api/_lib/router.js';

// Banco de mentira: imita as funções fin_* do supabase/schema.sql (inclusive a recusa sem o segredo).
function bancoFalso(segredo = 'segredo-certo') {
  const linhas = new Map(); let n = 0; const chamadas = [];
  const fetchFn = async (url, { headers, body }) => {
    const nome = url.split('/rpc/')[1]; const a = JSON.parse(body); chamadas.push(nome);
    const resp = (status, obj) => ({ ok: status < 300, status, text: async () => (obj === undefined ? '' : JSON.stringify(obj)) });
    if (!headers.apikey || a.p_segredo !== segredo) return resp(400, { message: 'nao autorizado' });
    const grava = (c, d) => { const etag = `e${++n}`; linhas.set(c, { dados: d, etag }); return etag; };
    switch (nome) {
      case 'fin_listar': return resp(200, [...linhas].filter(([c]) => c.startsWith(a.p_prefixo)).map(([caminho, v]) => ({ caminho, etag: v.etag })));
      case 'fin_ler': return resp(200, linhas.get(a.p_caminho)?.dados ?? null);
      case 'fin_ler_muitos': return resp(200, a.p_caminhos.filter((c) => linhas.has(c)).map((caminho) => ({ caminho, dados: linhas.get(caminho).dados })));
      case 'fin_gravar': return resp(200, grava(a.p_caminho, a.p_dados));
      case 'fin_gravar_muitos': a.p_itens.forEach((x) => grava(x.caminho, x.dados)); return resp(200, a.p_itens.length);
      case 'fin_excluir': linhas.delete(a.p_caminho); return resp(204);
      default: return resp(404, { message: 'função desconhecida' });
    }
  };
  return { fetchFn, linhas, chamadas };
}
const novoStore = (b, segredo = 'segredo-certo') => new StoreSupabase({ url: 'https://x.supabase.co/', chave: 'sb_publishable_teste', segredo, fetchFn: b.fetchFn });

test('Supabase: gravar, ler, listar, ler vários e excluir', async () => {
  const b = bancoFalso(); const s = novoStore(b);
  const e1 = await s.gravar('dados/contas/a.json', { id: 'a', nome: 'Conta' });
  await s.gravarMuitos([['dados/contas/b.json', { id: 'b' }], ['usuarios/u.json', { id: 'u' }]]);
  assert.ok(e1);
  assert.deepEqual((await s.listar('dados/')).map((x) => x.caminho), ['dados/contas/a.json', 'dados/contas/b.json']);
  assert.deepEqual(await s.ler('dados/contas/a.json'), { id: 'a', nome: 'Conta' });
  assert.equal(await s.ler('nao/existe.json'), null);
  const m = await s.lerMuitos(['dados/contas/a.json', 'dados/contas/b.json', 'x']);
  assert.equal(m.size, 2);
  await s.excluir('dados/contas/a.json');
  assert.equal(await s.ler('dados/contas/a.json'), null);
});

test('Supabase: segredo errado é recusado e o erro explica', async () => {
  const s = novoStore(bancoFalso(), 'errado');
  await assert.rejects(() => s.listar('dados/'), /Supabase fin_listar: 400/);
  assert.throws(() => new StoreSupabase({ url: 'u', chave: 'k' }), /sem configuração/);
});

test('Supabase: o app inteiro funciona sobre ele (cadastros iniciais, usuário semente, lançamento)', async () => {
  const b = bancoFalso(); const store = novoStore(b);
  const d = await carregarDados(store);
  assert.ok(d.categorias.length >= 70 && d.servicos.length >= 160);
  assert.ok(b.chamadas.includes('fin_gravar_muitos') && b.chamadas.includes('fin_ler_muitos'));
  const semente = JSON.stringify([{ email: 'financeiro@cariati.com.br', nome: 'Financeiro', senha: 'SenhaForte123' }]);
  const chamar = (metodo, rota, corpo, cookie) => tratar({ metodo, rota, corpo, cookie, ip: '2.2.2.2' }, { store, senha: 'admin-secreta-1', semente, hoje: () => '2026-06-15' });
  const login = await chamar('POST', 'login', { email: 'financeiro@cariati.com.br', senha: 'SenhaForte123' });
  assert.equal(login.status, 200);
  const cookie = login.cabecalhos['Set-Cookie'].split(';')[0];
  const conta = await chamar('POST', 'cadastros/contas', { nome: 'Banco', saldo_inicial_cents: 1000 }, cookie);
  assert.equal(conta.status, 201);
  const l = await chamar('POST', 'lancamentos', { tipo: 'receita', nome: 'X', valor_total_cents: 5000, primeiro_vencimento: '2026-06-20', conta_id: conta.corpo.id }, cookie);
  assert.equal(l.status, 201);
  assert.equal((await chamar('GET', 'contas-saldos', null, cookie)).corpo[0].saldo_cents, 1000);
});
