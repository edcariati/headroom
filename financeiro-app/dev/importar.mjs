// Uso: node dev/importar.mjs <linhas.json> [pasta-de-dados] [--aplicar]
// Sem --aplicar apenas simula. O arquivo de linhas (dados reais) nunca vai para o Git.
import fs from 'node:fs/promises';
import { StoreArquivo } from '../api/_lib/store-arquivo.js';
import { carregarDados } from '../api/_lib/dados.js';
import { gravarImportacao, montarImportacao } from '../api/_lib/importacao.js';

const [arquivo, pasta = '.dados-dev'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const linhas = JSON.parse(await fs.readFile(arquivo, 'utf8'));
const store = new StoreArquivo(pasta);
const d = await carregarDados(store);
const r = montarImportacao(d, linhas);
console.log(JSON.stringify({ resumo: r.resumo, avisos: r.avisos.slice(0, 20) }, null, 1));
if (process.argv.includes('--aplicar')) { await gravarImportacao(store, r.novos); console.log('Gravado em', pasta); }
