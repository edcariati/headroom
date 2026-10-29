// Leitura e gravação dos registros. Lê só o que mudou (compara o etag da listagem) e devolve cópias isoladas.
import { criarDados } from './finance.js';
import { MARCADOR, MARCADOR_PLANO2, MARCADOR_SERVICOS, MARCADOR_RECEITAS, MARCADOR_CATALOGO, registrosCategoriasReceita, registrosCatalogo, registrosDeServicos, registrosDoPlano, registrosPlano2 } from './plano.js';

const PREFIXO = 'dados/';
const caches = new WeakMap(); // store -> Map(caminho -> { etag, obj })
const cacheDe = (store) => { if (!caches.has(store)) caches.set(store, new Map()); return caches.get(store); };
const caminhoDe = (colecao, id) => `${PREFIXO}${colecao}/${id}.json`;

async function emLotes(itens, tamanho, fn) {
  for (let i = 0; i < itens.length; i += tamanho) await Promise.all(itens.slice(i, i + tamanho).map(fn));
}

export async function gravar(store, colecao, obj) {
  const caminho = caminhoDe(colecao, obj.id);
  const etag = await store.gravar(caminho, obj);
  cacheDe(store).set(caminho, { etag, obj: structuredClone(obj) });
}
export async function excluir(store, colecao, id) {
  const caminho = caminhoDe(colecao, id);
  await store.excluir(caminho);
  cacheDe(store).delete(caminho);
}

// Cadastros iniciais, criados uma única vez (cada lote tem o seu marcador). Grava só o que falta, aos poucos, e uma
// semeadura por vez em cada instância: muitas gravações juntas no Blob podem ser recusadas e derrubariam o aplicativo.
const SEMENTES = () => {
  const { categorias, centros } = registrosDoPlano();
  return [
    { marcador: MARCADOR, itens: [...categorias.map((c) => ['categorias', c]), ...centros.map((c) => ['centros', c])] },
    { marcador: MARCADOR_PLANO2, itens: registrosPlano2().map((c) => ['categorias', c]) },
    { marcador: MARCADOR_SERVICOS, itens: registrosDeServicos().map((x) => ['servicos', x]) },
    { marcador: MARCADOR_RECEITAS, itens: registrosCategoriasReceita().map((c) => ['categorias', c]) },
    { marcador: MARCADOR_CATALOGO, itens: registrosCatalogo().map((x) => ['servicos', x]) },
  ];
};
const semeando = new WeakMap(); // store -> promessa em andamento
async function semearPendentes(store, existentes) {
  for (const { marcador, itens } of SEMENTES()) {
    if (existentes.has(marcador)) continue;
    const faltam = itens.filter(([colecao, obj]) => !existentes.has(caminhoDe(colecao, obj.id)));
    await emLotes(faltam, 6, ([colecao, obj]) => gravar(store, colecao, obj));
    await store.gravar(marcador, { criado_em: new Date().toISOString() });
  }
}
async function garantirSementes(store, lista) {
  const existentes = new Set(lista.map((x) => x.caminho));
  if (SEMENTES().every((x) => existentes.has(x.marcador))) return false;
  if (!semeando.has(store)) {
    const p = semearPendentes(store, existentes).catch((e) => console.error('semeadura incompleta (tenta de novo na próxima chamada)', e)).finally(() => semeando.delete(store));
    semeando.set(store, p);
  }
  await semeando.get(store);
  return true;
}

export async function carregarDados(store) {
  const cache = cacheDe(store);
  let lista = await store.listar(PREFIXO);
  if (await garantirSementes(store, lista)) lista = await store.listar(PREFIXO);
  const vivos = new Set(lista.map((x) => x.caminho));
  for (const k of [...cache.keys()]) if (!vivos.has(k)) cache.delete(k);
  await emLotes(lista.filter((x) => cache.get(x.caminho)?.etag !== x.etag), 24, async (x) => {
    const obj = await store.ler(x.caminho);
    if (obj) cache.set(x.caminho, { etag: x.etag, obj }); else cache.delete(x.caminho);
  });
  const colecoes = {};
  for (const [caminho, { obj }] of cache) {
    const col = caminho.split('/')[1];
    if (col !== 'meta') (colecoes[col] ||= []).push(structuredClone(obj));
  }
  return criarDados(colecoes);
}
