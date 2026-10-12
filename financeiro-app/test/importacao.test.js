import test from 'node:test';
import assert from 'node:assert/strict';
import { criarDados, resumo, listarParcelas } from '../api/_lib/finance.js';
import { montarImportacao } from '../api/_lib/importacao.js';
import { registrosCategoriasReceita, registrosDoPlano, registrosPlano2 } from '../api/_lib/plano.js';

const base = { 'Status parcela': 'Pago', 'Conta bancária': 'Sicoob', Juros: 0, 'Notas fiscais': null, 'Centro de custo': null, Projeto: 'CA250102 Fulano', Fornecedor: null };
const linhas = [
  { ...base, Tipo: 'Pagamento', Nome: 'Projeto X', ID: 'L1', 'ID Parcela': 'P1', Cliente: 'Ana Souza', 'Categoria financeira': 'Projetos Arquitetônico', 'Data de competência': '07/01/2025',
    Parcela: 'Projeto X 1/2', 'Valor parcela': 500, 'Vencimento parcela': '07/01/2025', 'Data de pagamento parcela': '08/01/2025' },
  { ...base, Tipo: 'Pagamento', Nome: 'Projeto X', ID: 'L1', 'ID Parcela': 'P2', Cliente: 'Ana Souza', 'Categoria financeira': 'Projetos Arquitetônico', 'Data de competência': '07/01/2025',
    Parcela: 'Projeto X 2/2', 'Valor parcela': 500, 'Vencimento parcela': '07/03/2027', 'Data de pagamento parcela': null, 'Status parcela': 'Aguardando', 'Conta bancária': null },
  { ...base, Tipo: 'Despesa', Nome: 'Combustível', ID: 'L2', 'ID Parcela': 'P3', Fornecedor: 'Posto', Cliente: null, 'Categoria financeira': 'Combustíveis', Projeto: '-', 'Data de competência': '02/01/2026',
    Parcela: 'Combustível 1/1', 'Valor parcela': -120.5, 'Vencimento parcela': '02/01/2026', 'Data de pagamento parcela': '02/01/2026', 'Conta bancária': null },
];

test('importa parcelas pagas e previstas e não duplica ao repetir', () => {
  const pl = registrosDoPlano();
  const d = criarDados({ categorias: [...pl.categorias, ...registrosPlano2()], centros: pl.centros });
  const r = montarImportacao(d, [...linhas, linhas[0]]); // linha repetida entre planilhas
  assert.equal(r.resumo.parcelas_unicas, 3);
  assert.equal(r.resumo.lancamentos_novos, 2);
  assert.equal(r.resumo.parcelas_pagas, 2);
  assert.equal(r.resumo.parcelas_abertas, 1);
  assert.deepEqual(r.resumo.totais.despesa, { pago: 12050, aberto: 0 });
  for (const col of Object.keys(r.novos)) for (const x of r.novos[col]) { d[col].push(x); d.mapa[col].set(x.id, x); }
  const p = listarParcelas(d, { tipo: 'receita', de: '2000-01-01', ate: '2030-12-31' }, '2026-10-09').itens;
  assert.deepEqual(p.map((x) => [x.status, x.valor_cents]), [['pago', 50000], ['a_vencer', 50000]]);
  assert.equal(p[0].categoria_nome, 'Projeto arquitetônico');
  assert.equal(p[0].contrato_codigo, 'CA250102');
  assert.equal(listarParcelas(d, { tipo: 'despesa', de: '2000-01-01', ate: '2030-12-31' }, '2026-10-09').itens[0].categoria_nome, 'Automóvel › Combustível');
  const de = resumo(d, { de: '2025-01-01', ate: '2027-12-31' }, '2026-10-09');
  assert.ok(de);
  assert.deepEqual(r.novos.contas.map((c) => c.nome), ['Banco base antigo']);
  assert.equal(r.novos.lancamentos[0].parcelas[0].pagamentos[0].banco_origem, 'Sicoob');
  assert.equal(montarImportacao(d, linhas).resumo.lancamentos_existentes, 2); // segunda rodada não cria nada
});

test('cadastro de clientes completa quem já tem lançamento e cria os demais', () => {
  const pl = registrosDoPlano();
  const d = criarDados({ categorias: [...pl.categorias, ...registrosPlano2(), ...registrosCategoriasReceita()], centros: pl.centros });
  const clientes = [
    { 'Código': 351, Nome: 'Ana  Souza', Tipo: 'pf', 'CPF/CNPJ': '04182691814', Telefone: '(15) 99722-7598', CEP: '18272548', Rua: 'Rua A', 'Número': ' 72 ', Cidade: 'Tatuí', Estado: 'SP', Email: 'ana@x.com' },
    { 'Código': 352, Nome: 'Empresa Z', Tipo: 'pj', 'Razão Social': 'Z Ltda', 'CPF/CNPJ': '12345678000199', Estado: null },
    { 'Código': 353, Nome: 'Sem Doc', Tipo: 'pf', 'CPF/CNPJ': '123' },
  ];
  const r = montarImportacao(d, linhas, { clientes });
  assert.equal(r.resumo.clientes_novos, 3);
  const ana = r.novos.pessoas.filter((p) => p.nome === 'Ana  Souza' || p.nome === 'Ana Souza');
  assert.equal(ana.length, 1); // cliente da planilha e do lançamento são a mesma pessoa
  assert.deepEqual([ana[0].codigo, ana[0].documento, ana[0].telefone, ana[0].numero, ana[0].estado], ['351', '04182691814', '15997227598', '72', 'SP']);
  assert.equal(r.novos.pessoas.find((p) => p.nome === 'Empresa Z').natureza, 'juridica');
  assert.equal(r.novos.pessoas.find((p) => p.nome === 'Sem Doc').documento, null);
  assert.ok(r.avisos.some((a) => a.includes('Sem Doc')));
  // receita usa a categoria do plano importado quando existe uma com o mesmo nome
  assert.equal(r.novos.lancamentos.find((l) => l.nome === 'Projeto X').categoria_id, 'rc3_9');
});

test('data de corte deixa de fora as parcelas anteriores', () => {
  const pl = registrosDoPlano();
  const d = criarDados({ categorias: [...pl.categorias, ...registrosPlano2()], centros: pl.centros });
  const r = montarImportacao(d, linhas, { desde: '2026-01-01' });
  assert.equal(r.resumo.parcelas_antes_do_corte, 1);
  assert.equal(r.resumo.lancamentos_novos, 2);
  assert.equal(r.novos.lancamentos.find((l) => l.nome === 'Projeto X').parcelas.length, 1);
  const r2 = montarImportacao(d, linhas, { desde: '2027-01-01' });
  assert.equal(r2.resumo.lancamentos_novos, 1);
  assert.equal(r2.novos.contratos.length, 1);
});
