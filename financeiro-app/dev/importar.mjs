// Uso: node dev/importar.mjs <linhas.json> [pasta-de-dados] [--clientes clientes.json] [--aplicar]
// Sem --aplicar apenas simula. O arquivo de linhas (dados reais) nunca vai para o Git.
import fs from 'node:fs/promises';
import { StoreArquivo } from '../api/_lib/store-arquivo.js';
import { carregarDados } from '../api/_lib/dados.js';
import { gravarImportacao, montarImportacao } from '../api/_lib/importacao.js';

const args = process.argv.slice(2);
const iCli = args.indexOf('--clientes');
const arqClientes = iCli >= 0 ? args.splice(iCli, 2)[1] : null;
const [arquivo, pasta = '.dados-dev'] = args.filter((a) => !a.startsWith('--'));
const linhas = JSON.parse(await fs.readFile(arquivo, 'utf8'));
const store = new StoreArquivo(pasta);
const d = await carregarDados(store);
const clientes = arqClientes ? JSON.parse(await fs.readFile(arqClientes, 'utf8')) : [];
const r = montarImportacao(d, linhas, { clientes });
console.log(JSON.stringify({ resumo: r.resumo, avisos: r.avisos.slice(0, 20) }, null, 1));
if (process.argv.includes('--aplicar')) { await gravarImportacao(store, r.novos); console.log('Gravado em', pasta); }
