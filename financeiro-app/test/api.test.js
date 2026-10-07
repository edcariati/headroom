import test from 'node:test';
import assert from 'node:assert/strict';
import { tratar } from '../api/_lib/router.js';
import { StoreMemoria } from '../api/_lib/store-memoria.js';
import { StoreBlob } from '../api/_lib/store-blob.js';
import { carregarDados } from '../api/_lib/dados.js';
import { criarSessao, sessaoValida, senhaConfere } from '../api/_lib/auth.js';

const HOJE = '2026-06-15';
const chamar = (store, metodo, rota, { query, corpo, senha, cookie } = {}) =>
  tratar({ metodo, rota, query, corpo, cookie, ip: '1.1.1.1' }, { store, senha, hoje: () => HOJE, agora: () => '2026-06-15T10:00:00.000Z' });
const j = async (store, ...a) => { const r = await chamar(store, ...a); return r; };

test('primeiro acesso cria o plano de contas padrão uma única vez', async () => {
  const store = new StoreMemoria();
  const cats = await j(store, 'GET', 'cadastros/categorias');
  assert.equal(cats.status, 200);
  assert.ok(cats.corpo.length >= 20 && cats.corpo.every((c) => c.grupo_dre));
  const auto = cats.corpo.find((c) => c.nome === 'Automóvel');
  assert.ok(auto && cats.corpo.filter((c) => c.pai_id === auto.id).map((c) => c.nome).sort().join() === 'Combustível,Estacionamento,Higienização,Mecânico,Pedágios');
  assert.equal(cats.corpo.find((c) => c.nome === 'Combustível').caminho, 'Automóvel › Combustível');
  await j(store, 'GET', 'cadastros/categorias');
  assert.equal((await j(store, 'GET', 'cadastros/categorias')).corpo.length, cats.corpo.length);
});

test('fluxo completo pela API: conta, pessoa, lançamento, baixa, estorno e exclusão', async () => {
  const store = new StoreMemoria();
  const conta = (await j(store, 'POST', 'cadastros/contas', { corpo: { nome: 'Inter', saldo_inicial_cents: 100000 } })).corpo;
  const pessoa = (await j(store, 'POST', 'cadastros/pessoas', { corpo: { nome: 'Cliente', tipo: 'cliente' } })).corpo;
  const cat = (await j(store, 'GET', 'cadastros/categorias')).corpo.find((c) => c.tipo === 'receita');
  const novo = await j(store, 'POST', 'lancamentos', { corpo: { tipo: 'receita', nome: 'Projeto X', valor_total_cents: 90000, parcelas: 3,
    primeiro_vencimento: '2026-06-20', categoria_id: cat.id, pessoa_id: pessoa.id, conta_id: conta.id } });
  assert.equal(novo.status, 201);
  const lista = (await j(store, 'GET', 'parcelas', { query: { tipo: 'receita', de: '2026-01-01', ate: '2026-12-31' } })).corpo;
  assert.equal(lista.itens.length, 3);
  assert.equal(lista.itens[0].nome, 'Projeto X 1/3');
  const pid = lista.itens[0].id;
  assert.equal((await j(store, 'POST', `parcelas/${pid}/baixa`, { corpo: { data: '2026-06-20', conta_id: conta.id } })).status, 200);
  assert.equal((await j(store, 'GET', 'contas-saldos')).corpo[0].saldo_cents, 130000);
  assert.equal((await j(store, 'POST', `parcelas/${pid}/baixa`, { corpo: { conta_id: conta.id } })).status, 400);
  assert.equal((await j(store, 'POST', `parcelas/${pid}/estorno`)).status, 200);
  assert.equal((await j(store, 'GET', 'contas-saldos')).corpo[0].saldo_cents, 100000);
  assert.equal((await j(store, 'DELETE', `cadastros/contas/${conta.id}`)).status, 409); // em uso
  assert.equal((await j(store, 'DELETE', `lancamentos/${novo.corpo.id}`)).status, 200);
  assert.equal((await j(store, 'DELETE', `cadastros/contas/${conta.id}`)).status, 200);
  const csv = await j(store, 'GET', 'parcelas.csv', { query: { de: '2026-01-01', ate: '2026-12-31' } });
  assert.match(csv.tipo, /csv/);
});

test('erros de validação viram 400 e rota inexistente 404', async () => {
  const store = new StoreMemoria();
  assert.equal((await j(store, 'POST', 'lancamentos', { corpo: { tipo: 'receita', nome: '' } })).status, 400);
  assert.equal((await j(store, 'POST', 'cadastros/categorias', { corpo: { nome: 'x', tipo: 'despesa', grupo_dre: 'receita_bruta' } })).status, 400);
  assert.equal((await j(store, 'PUT', 'cadastros/contas/inexistente', { corpo: { nome: 'x' } })).status, 404);
  assert.equal((await j(store, 'GET', 'nada')).status, 404);
});

test('senha: sem sessão bloqueia tudo, login certo libera, errado nega, e a sessão expira', async () => {
  const store = new StoreMemoria();
  const senha = 'uma-senha-bem-forte-123';
  assert.equal((await j(store, 'GET', 'resumo', { senha })).status, 401);
  assert.equal((await j(store, 'GET', 'sessao', { senha })).corpo.autenticado, false);
  const errado = await j(store, 'POST', 'login', { senha, corpo: { senha: 'errada' } });
  assert.equal(errado.status, 401);
  const certo = await j(store, 'POST', 'login', { senha, corpo: { senha } });
  assert.equal(certo.status, 200);
  const cookie = certo.cabecalhos['Set-Cookie'].split(';')[0];
  assert.match(certo.cabecalhos['Set-Cookie'], /HttpOnly/);
  assert.equal((await j(store, 'GET', 'resumo', { senha, cookie })).status, 200);
  assert.equal((await j(store, 'GET', 'resumo', { senha, cookie: 'sessao=1.abc' })).status, 401);
  const velho = criarSessao(senha, Date.now() - 13 * 3600 * 1000);
  assert.equal(sessaoValida(velho, senha), false);
  assert.equal(sessaoValida(criarSessao(senha), 'outra-senha'), false);
  assert.ok(senhaConfere(senha, senha) && !senhaConfere('x', senha) && !senhaConfere('x', undefined));
}, { timeout: 10000 });

test('produção sem ADMIN_SENHA fica bloqueada (não abre por engano)', async () => {
  const r = await tratar({ metodo: 'GET', rota: 'resumo' }, { store: new StoreMemoria(), senha: undefined, producao: true });
  assert.equal(r.status, 503);
});

test('só relê o que mudou: segunda leitura não baixa registros de novo', async () => {
  const store = new StoreMemoria();
  await carregarDados(store);
  let leituras = 0;
  const ler = store.ler.bind(store);
  store.ler = async (c) => { leituras++; return ler(c); };
  await carregarDados(store);
  assert.equal(leituras, 0);
  await j(store, 'POST', 'cadastros/centros', { corpo: { nome: 'Novo' } });
  await carregarDados(store);
  assert.equal(leituras, 0); // o que acabou de ser gravado já está no cache
});

test('StoreBlob usa Blob privado, sem sufixo aleatório, com sobrescrita e sem cache', async () => {
  const chamadas = [];
  const arquivos = new Map();
  const sdk = {
    put: async (p, corpo, op) => { chamadas.push(['put', p, op]); arquivos.set(p, corpo); return { etag: 'x1' }; },
    get: async (p, op) => { chamadas.push(['get', p, op]); return arquivos.has(p) ? { statusCode: 200, stream: new Response(arquivos.get(p)).body } : null; },
    list: async (op) => { chamadas.push(['list', op.prefix]); return { blobs: [...arquivos.keys()].filter((k) => k.startsWith(op.prefix)).map((pathname) => ({ pathname, etag: 'x1' })), hasMore: false }; },
    del: async (p) => { chamadas.push(['del', p]); arquivos.delete(p); },
  };
  const store = new StoreBlob(sdk);
  await store.gravar('dados/a/1.json', { id: '1' });
  assert.deepEqual(await store.ler('dados/a/1.json'), { id: '1' });
  assert.equal(await store.ler('dados/a/2.json'), null);
  assert.deepEqual(await store.listar('dados/'), [{ caminho: 'dados/a/1.json', etag: 'x1' }]);
  await store.excluir('dados/a/1.json');
  const put = chamadas.find((c) => c[0] === 'put')[2];
  assert.equal(put.access, 'private'); assert.equal(put.addRandomSuffix, false); assert.equal(put.allowOverwrite, true);
  assert.deepEqual(chamadas.find((c) => c[0] === 'get')[2], { access: 'private', useCache: false });
});

test('cadastro de cliente: código automático, serviços padrão e lista de clientes', async () => {
  const store = new StoreMemoria();
  const servicos = (await j(store, 'GET', 'cadastros/servicos')).corpo;
  assert.ok(servicos.length >= 5);
  assert.equal((await j(store, 'GET', 'cadastros/servicos')).corpo.length, servicos.length); // semeado uma vez
  const cli = (await j(store, 'POST', 'cadastros/pessoas', { corpo: { nome: 'Maria', tipo: 'cliente', cidade: 'Goiânia' } })).corpo;
  assert.equal(cli.codigo, 'CLI-0001');
  const forn = (await j(store, 'POST', 'cadastros/pessoas', { corpo: { nome: 'Eng', tipo: 'fornecedor' } })).corpo;
  assert.equal(forn.codigo, null);
  assert.equal((await j(store, 'GET', 'sugestoes-codigo')).corpo.cliente, 'CLI-0002');
  const proj = await j(store, 'POST', 'cadastros/contratos', { corpo: { codigo: 'CA260601', nome: 'Casa', pessoa_id: cli.id, area_m2: 150,
    servicos: [{ servico_id: servicos[0].id, nome: servicos[0].nome, valor_cents: 500000 }] } });
  assert.equal(proj.status, 201);
  assert.equal(proj.corpo.valor_total_cents, 500000);
  assert.equal((await j(store, 'POST', 'cadastros/contratos', { corpo: { codigo: 'ca260601', nome: 'Outro' } })).status, 409);
  const lista = (await j(store, 'GET', 'clientes')).corpo;
  assert.equal(lista.itens.length, 1);
  assert.deepEqual(lista.itens[0].servicos, [servicos[0].nome]);
  assert.equal((await j(store, 'DELETE', `cadastros/servicos/${servicos[0].id}`)).status, 409);
});

test('usuários por e-mail: criar com senha provisória, entrar, trocar senha, excluir e semente do ambiente', async () => {
  const store = new StoreMemoria();
  const SENHA = 'senha-admin-1234';
  const cookieDe = (r) => r.cabecalhos['Set-Cookie'].split(';')[0];
  const admin = await chamar(store, 'POST', 'login', { corpo: { senha: SENHA }, senha: SENHA });
  const ck = cookieDe(admin);
  const novo = await chamar(store, 'POST', 'usuarios', { corpo: { email: ' Financeiro@Cariati.com.br ', nome: 'Financeiro' }, senha: SENHA, cookie: ck });
  assert.equal(novo.status, 201);
  assert.equal(novo.corpo.usuario.email, 'financeiro@cariati.com.br');
  assert.equal(novo.corpo.usuario.senha_hash, undefined);
  const prov = novo.corpo.senha_provisoria;
  assert.ok(prov.length >= 12);
  assert.equal((await chamar(store, 'POST', 'usuarios', { corpo: { email: 'financeiro@cariati.com.br', nome: 'x' }, senha: SENHA, cookie: ck })).status, 409);
  assert.equal((await chamar(store, 'POST', 'usuarios', { corpo: { nome: 'x' }, senha: SENHA })).status, 401); // sem sessão
  // login do usuário: senha errada, e certa
  assert.equal((await chamar(store, 'POST', 'login', { corpo: { email: 'financeiro@cariati.com.br', senha: 'errada' }, senha: SENHA })).status, 401);
  const r = await chamar(store, 'POST', 'login', { corpo: { email: 'FINANCEIRO@cariati.com.br', senha: prov }, senha: SENHA });
  assert.equal(r.status, 200);
  const ckU = cookieDe(r);
  const sess = await chamar(store, 'GET', 'sessao', { senha: SENHA, cookie: ckU });
  assert.equal(sess.corpo.autenticado, true); assert.equal(sess.corpo.usuario.email, 'financeiro@cariati.com.br');
  assert.equal((await chamar(store, 'GET', 'cadastros/contas', { senha: SENHA, cookie: ckU })).status, 200); // mesmo acesso do admin
  assert.equal((await chamar(store, 'GET', 'usuarios', { senha: SENHA, cookie: ckU })).corpo.length, 1);
  // trocar a própria senha
  assert.equal((await chamar(store, 'POST', 'minha-senha', { corpo: { atual: 'x', nova: 'nova-senha-123' }, senha: SENHA, cookie: ckU })).status, 400);
  assert.equal((await chamar(store, 'POST', 'minha-senha', { corpo: { atual: prov, nova: 'curta' }, senha: SENHA, cookie: ckU })).status, 400);
  assert.equal((await chamar(store, 'POST', 'minha-senha', { corpo: { atual: prov, nova: 'nova-senha-123' }, senha: SENHA, cookie: ckU })).status, 200);
  assert.equal((await chamar(store, 'POST', 'login', { corpo: { email: 'financeiro@cariati.com.br', senha: prov }, senha: SENHA })).status, 401);
  assert.equal((await chamar(store, 'POST', 'login', { corpo: { email: 'financeiro@cariati.com.br', senha: 'nova-senha-123' }, senha: SENHA })).status, 200);
  // redefinir pelo admin e excluir: sessão do excluído deixa de valer
  const id = novo.corpo.usuario.id;
  assert.equal((await chamar(store, 'POST', `usuarios/${id}/senha`, { senha: SENHA, cookie: ck })).status, 200);
  assert.equal((await chamar(store, 'DELETE', `usuarios/${id}`, { senha: SENHA, cookie: ckU })).status, 409); // não exclui a si mesmo
  assert.equal((await chamar(store, 'DELETE', `usuarios/${id}`, { senha: SENHA, cookie: ck })).status, 200);
  assert.equal((await chamar(store, 'GET', 'cadastros/contas', { senha: SENHA, cookie: ckU })).status, 401);
  // semente do ambiente: cria uma vez e não sobrescreve a senha trocada depois
  const loja2 = new StoreMemoria();
  const semente = JSON.stringify([{ email: 'a@b.com', nome: 'A', senha: 'senha-semente-1' }]);
  const comSemente = (corpo) => tratar({ metodo: 'POST', rota: 'login', corpo, ip: '2.2.2.2' }, { store: loja2, senha: SENHA, semente, hoje: () => HOJE });
  assert.equal((await comSemente({ email: 'a@b.com', senha: 'senha-semente-1' })).status, 200);
  assert.equal((await comSemente({ email: 'a@b.com', senha: 'outra' })).status, 401);
  // excluído depois de semeado, não volta
  const idSem = (await tratar({ metodo: 'GET', rota: 'usuarios', cookie: `sessao=${criarSessao(SENHA)}`, ip: '3.3.3.3' }, { store: loja2, senha: SENHA, hoje: () => HOJE })).corpo[0].id;
  await tratar({ metodo: 'DELETE', rota: `usuarios/${idSem}`, cookie: `sessao=${criarSessao(SENHA)}`, ip: '3.3.3.3' }, { store: loja2, senha: SENHA, hoje: () => HOJE });
  assert.equal((await comSemente({ email: 'a@b.com', senha: 'senha-semente-1' })).status, 401);
});

test('fluxos pela API: contato, conferência, entrega e comprovante na baixa', async () => {
  const store = new StoreMemoria();
  const conta = (await j(store, 'POST', 'cadastros/contas', { corpo: { nome: 'Inter', saldo_inicial_cents: 100000 } })).corpo;
  const cli = (await j(store, 'POST', 'cadastros/pessoas', { corpo: { nome: 'Maria' } })).corpo;
  const cat = (await j(store, 'GET', 'cadastros/categorias')).corpo.find((c) => c.tipo === 'receita');
  await j(store, 'POST', 'lancamentos', { corpo: { tipo: 'receita', nome: 'P', valor_total_cents: 50000, primeiro_vencimento: '2026-06-01', categoria_id: cat.id, pessoa_id: cli.id, conta_id: conta.id } });
  const parcela = (await j(store, 'GET', 'parcelas', { query: { tipo: 'receita', de: '2026-01-01', ate: '2026-12-31' } })).corpo.itens[0];
  assert.equal((await j(store, 'GET', 'a-receber')).corpo.clientes[0].ultimo_contato, null);
  assert.equal((await j(store, 'POST', 'contatos', { corpo: { pessoa_id: cli.id, resposta: '' } })).status, 400);
  assert.equal((await j(store, 'POST', 'contatos', { corpo: { pessoa_id: cli.id, canal: 'whatsapp', resposta: 'Paga sexta' } })).status, 201);
  assert.equal((await j(store, 'GET', 'a-receber')).corpo.clientes[0].ultimo_contato.resposta, 'Paga sexta');
  assert.equal((await j(store, 'POST', `parcelas/${parcela.id}/baixa`, { corpo: { data: HOJE, conta_id: conta.id, comprovante: 'pix.pdf' } })).status, 200);
  const conf = await j(store, 'POST', 'conferencias', { corpo: { conta_id: conta.id, saldo_banco_cents: 150000 } });
  assert.equal(conf.status, 201); assert.equal(conf.corpo.diferenca_cents, 0);
  assert.equal((await j(store, 'POST', 'entregas', { corpo: { observacao: 'Enviado ao diretor' } })).status, 201);
  const f = (await j(store, 'GET', 'fluxos')).corpo;
  assert.equal(f.passos.length, 9);
  assert.equal(f.passos[5].pendencias, 0); assert.equal(f.passos[7].pendencias, 0); assert.equal(f.passos[8].pendencias, 0);
  assert.equal(f.passos[7].ultimo, HOJE);
});

test('anexos, recibo, nota fiscal, edição do lançamento e busca pela API', async () => {
  const store = new StoreMemoria();
  const conta = (await j(store, 'POST', 'cadastros/contas', { corpo: { nome: 'Inter', saldo_inicial_cents: 0 } })).corpo;
  const cli = (await j(store, 'POST', 'cadastros/pessoas', { corpo: { nome: 'Maria Souza', documento: '12345678909' } })).corpo;
  const cat = (await j(store, 'GET', 'cadastros/categorias')).corpo.find((c) => c.tipo === 'receita');
  const lanc = (await j(store, 'POST', 'lancamentos', { corpo: { tipo: 'receita', nome: 'Projeto Silva', valor_total_cents: 90000, parcelas: 3, primeiro_vencimento: '2026-06-01',
    categoria_id: cat.id, pessoa_id: cli.id, conta_id: conta.id, nf_solicitada: true } })).corpo;
  // cliente pediu NF: nota entra na fila
  const notas = (await j(store, 'GET', 'notas')).corpo;
  assert.equal(notas.length, 1); assert.equal(notas[0].status, 'a_emitir'); assert.equal(notas[0].valor_cents, 90000); assert.equal(notas[0].pessoa_nome, 'Maria Souza');
  const parcela = (await j(store, 'GET', 'parcelas', { query: { tipo: 'receita', de: '2026-01-01', ate: '2026-12-31' } })).corpo.itens[0];
  // recibo exige recebimento
  assert.equal((await j(store, 'POST', 'recibos', { corpo: { parcela_id: parcela.id } })).status, 400);
  await j(store, 'POST', `parcelas/${parcela.id}/baixa`, { corpo: { data: '2026-06-02', conta_id: conta.id } });
  const rec = await j(store, 'POST', 'recibos', { corpo: { parcela_id: parcela.id, forma: 'Pix' } });
  assert.equal(rec.status, 201); assert.equal(rec.corpo.numero, 'REC-0001'); assert.equal(rec.corpo.valor_cents, 30000); assert.equal(rec.corpo.pessoa_nome, 'Maria Souza');
  const de_novo = await j(store, 'POST', 'recibos', { corpo: { parcela_id: parcela.id } });
  assert.equal(de_novo.status, 200); assert.equal(de_novo.corpo.id, rec.corpo.id); // não duplica
  // anexos: comprovante em PDF e nota em XML (os dados da nota são lidos do XML)
  const pdf = Buffer.from('%PDF-1.4 teste').toString('base64');
  const comp = await j(store, 'POST', 'anexos', { corpo: { nome: 'pix-comprovante.pdf', tipo: 'application/pdf', dados: pdf, categoria: 'comprovante', vinculo: { tipo: 'parcela', id: parcela.id } } });
  assert.equal(comp.status, 201);
  assert.equal((await j(store, 'POST', 'anexos', { corpo: { nome: 'x.exe', tipo: 'application/x-msdownload', dados: pdf, categoria: 'outro', vinculo: { tipo: 'parcela', id: parcela.id } } })).status, 400);
  assert.equal((await j(store, 'POST', 'anexos', { corpo: { nome: 'a.pdf', tipo: 'application/pdf', dados: pdf, categoria: 'outro', vinculo: { tipo: 'lancamento', id: 'nao-existe' } } })).status, 404);
  assert.equal((await j(store, 'POST', 'anexos', { corpo: { nome: 'grande.pdf', tipo: 'application/pdf', dados: Buffer.alloc(3 * 1024 * 1024 + 1, 1).toString('base64'), categoria: 'outro', vinculo: { tipo: 'lancamento', id: lanc.id } } })).status, 413);
  const xml = '<?xml version="1.0"?><CompNfse><Nfse><InfNfse><Numero>1234</Numero><DataEmissao>2026-06-05T10:00:00</DataEmissao><ValorServicos>900.00</ValorServicos><PrestadorServico><RazaoSocial>Cariati Arquitetura</RazaoSocial></PrestadorServico><TomadorServico><RazaoSocial>Maria Souza</RazaoSocial></TomadorServico></InfNfse></Nfse></CompNfse>';
  const nf = await j(store, 'POST', 'anexos', { corpo: { nome: 'nfse-1234.xml', tipo: 'text/xml', dados: Buffer.from(xml).toString('base64'), categoria: 'nota_fiscal', vinculo: { tipo: 'lancamento', id: lanc.id } } });
  assert.deepEqual(nf.corpo.extraido, { numero: '1234', valor_cents: 90000, data_emissao: '2026-06-05', emitente: 'Cariati Arquitetura', tomador: 'Maria Souza' });
  const arq = await j(store, 'GET', `anexos/${comp.corpo.id}/arquivo`);
  assert.equal(arq.status, 200); assert.equal(arq.tipo, 'application/pdf'); assert.equal(arq.corpo.toString(), '%PDF-1.4 teste');
  assert.match(arq.cabecalhos['Content-Disposition'], /^inline/); assert.equal(arq.cabecalhos['X-Content-Type-Options'], 'nosniff');
  assert.match((await j(store, 'GET', `anexos/${nf.corpo.id}/arquivo`)).cabecalhos['Content-Disposition'], /^attachment/);
  // nota emitida: exige número; anexa o XML
  assert.equal((await j(store, 'PUT', `notas/${notas[0].id}`, { corpo: { status: 'emitida' } })).status, 400);
  const emitida = await j(store, 'PUT', `notas/${notas[0].id}`, { corpo: { status: 'emitida', numero: '1234', anexo_id: nf.corpo.id } });
  assert.equal(emitida.corpo.status, 'emitida'); assert.ok(emitida.corpo.data_emissao);
  // vínculos para as listas
  const v = (await j(store, 'GET', 'vinculos')).corpo;
  assert.equal(v.recibos[parcela.id], rec.corpo.id); assert.equal(v.anexos[parcela.id].comprovante, 1); assert.equal(v.anexos[lanc.id].nota_fiscal, 1); assert.equal(v.notas[lanc.id], 'emitida');
  // editar o lançamento inteiro
  const ed = await j(store, 'PUT', `lancamentos/${lanc.id}`, { corpo: { nome: 'Projeto Silva (revisado)', nota_fiscal: '1234', etiquetas: 'residencial', observacao: 'Cliente pediu NF' } });
  assert.equal(ed.status, 200);
  assert.equal((await j(store, 'PUT', `lancamentos/${lanc.id}`, { corpo: { categoria_id: 'nao' } })).status, 404);
  const apos = (await j(store, 'GET', 'parcelas', { query: { tipo: 'receita', de: '2026-01-01', ate: '2026-12-31' } })).corpo.itens[0];
  assert.match(apos.nome, /revisado/);
  // busca em tudo
  assert.ok((await j(store, 'GET', 'busca', { query: { q: 'silva' } })).corpo.lancamentos.length >= 1);
  assert.equal((await j(store, 'GET', 'busca', { query: { q: '1234' } })).corpo.anexos[0].titulo, 'nfse-1234.xml');
  assert.equal((await j(store, 'GET', 'busca', { query: { q: 'rec-0001' } })).corpo.recibos.length, 1);
  assert.equal((await j(store, 'GET', 'busca', { query: { q: 'maria' } })).corpo.clientes[0].titulo, 'Maria Souza');
  assert.equal((await j(store, 'GET', 'busca', { query: { q: 'a' } })).status, 400);
  // excluir anexo apaga o arquivo
  assert.equal((await j(store, 'DELETE', `anexos/${comp.corpo.id}`)).status, 200);
  assert.equal((await j(store, 'GET', `anexos/${comp.corpo.id}/arquivo`)).status, 404);
});
