// API da degustação (Vercel Function) — dados guardados no Vercel Blob (privado).
//
// Estrutura no Blob:
//   p/{id}.json              avaliador { id, segredo, nome, idade, criado_em }
//   av/{id}/{lanche}.json    avaliação de um lanche por um avaliador
//   cfg/lanches.json         nomes dos lanches { "1": "X-Burguer", ... }
//
// O avaliador recebe o token "{id}.{segredo}" e só ele pode gravar as próprias notas.
// O painel exige a senha da variável de ambiente ADMIN_SENHA.

import { put, get, list, del } from "@vercel/blob";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";

const TOTAL = 20;
const OPCOES = {
  espera: ["ate10", "10a20", "mais20"],
  chegou: ["quente", "morno", "frio"],
  tamanho_percepcao: ["pequeno", "na_medida", "grande"],
};
const NOTAS = [
  "nota_espera", "nota_temperatura", "nota_aparencia", "nota_montagem", "nota_sabor",
  "nota_carne", "nota_pao", "nota_molho", "nota_ingredientes", "nota_tamanho",
  "nota_facilidade", "nota_pediria", "nota_indicaria",
];

class ErroUsuario extends Error {}
const falha = (msg) => { throw new ErroUsuario(msg); };

// ---------- Blob ----------
async function lerJson(pathname) {
  const r = await get(pathname, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

function gravarJson(pathname, dados) {
  return put(pathname, JSON.stringify(dados), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function listarTudo(prefix) {
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function lerVarios(pathnames) {
  const out = [];
  for (let i = 0; i < pathnames.length; i += 25) {
    const lote = await Promise.all(pathnames.slice(i, i + 25).map(lerJson));
    out.push(...lote.filter(Boolean));
  }
  return out;
}

// ---------- Utilidades ----------
const iguais = (a, b) => {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
};
const idValido = (id) => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function nomesLanches() {
  const cfg = (await lerJson("cfg/lanches.json")) || {};
  return Array.from({ length: TOTAL }, (_, i) => ({ id: i + 1, nome: cfg[i + 1] || `Lanche ${i + 1}` }));
}

async function avaliadorPorToken(token) {
  const [id, segredo] = String(token || "").split(".");
  if (!idValido(id) || !segredo) return null;
  const p = await lerJson(`p/${id}.json`);
  if (!p || !iguais(p.segredo, segredo)) return null;
  return p;
}

async function avaliacoesDe(id) {
  const blobs = await listarTudo(`av/${id}/`);
  const av = await lerVarios(blobs.map((b) => b.pathname));
  return av.sort((a, b) => a.lanche_id - b.lanche_id);
}

async function checarSenha(senha) {
  const certa = process.env.ADMIN_SENHA;
  if (!certa) falha("Senha do painel ainda não foi definida");
  if (!senha || !iguais(senha, certa)) {
    await esperar(1000); // atrasa tentativas de adivinhar a senha
    falha("Senha incorreta");
  }
}

// ---------- Funções ----------
const FUNCOES = {
  async listar_lanches() {
    return nomesLanches();
  },

  async registrar_avaliador({ p_nome, p_idade }) {
    const nome = String(p_nome ?? "").trim().slice(0, 80);
    if (!nome) falha("Informe o nome");
    let idade = null;
    if (p_idade !== null && p_idade !== undefined && p_idade !== "") {
      idade = Number(p_idade);
      if (!Number.isInteger(idade) || idade < 1 || idade > 120) falha("Idade inválida");
    }
    const p = { id: randomUUID(), segredo: randomUUID(), nome, idade, criado_em: new Date().toISOString() };
    await gravarJson(`p/${p.id}.json`, p);
    return { token: `${p.id}.${p.segredo}`, nome, idade };
  },

  async minhas_avaliacoes({ p_token }) {
    const p = await avaliadorPorToken(p_token);
    if (!p) return null;
    const avaliacoes = (await avaliacoesDe(p.id)).map(({ avaliador_id, ...resto }) => resto);
    return { nome: p.nome, idade: p.idade, avaliacoes };
  },

  async salvar_avaliacao({ p_token, p_lanche, p_dados }) {
    const p = await avaliadorPorToken(p_token);
    if (!p) falha("Avaliador não encontrado");
    const lanche = Number(p_lanche);
    if (!Number.isInteger(lanche) || lanche < 1 || lanche > TOTAL) falha("Lanche inválido");
    const d = p_dados || {};

    const reg = { avaliador_id: p.id, lanche_id: lanche };
    for (const [campo, validos] of Object.entries(OPCOES)) {
      if (!validos.includes(d[campo])) falha(`Resposta obrigatória: ${campo}`);
      reg[campo] = d[campo];
    }
    let soma = 0;
    for (const c of NOTAS) {
      const v = Number(d[c]);
      if (d[c] === null || d[c] === undefined || d[c] === "" || !Number.isInteger(v) || v < 0 || v > 10) {
        falha(`Nota obrigatória (0 a 10): ${c}`);
      }
      reg[c] = v;
      soma += v;
    }
    const preco = Number(d.preco);
    if (d.preco === null || d.preco === undefined || d.preco === "" || !isFinite(preco) || preco < 0 || preco > 9999) {
      falha("Informe quanto pagaria (R$)");
    }
    reg.preco = Math.round(preco * 100) / 100;
    for (const c of ["gostou", "mudaria"]) {
      const t = String(d[c] ?? "").trim();
      if (t.length > 1000) falha("Comentário muito longo (máx. 1000 caracteres)");
      reg[c] = t || null;
    }
    reg.nota_final = Math.round((soma / NOTAS.length) * 100) / 100;

    const caminho = `av/${p.id}/${lanche}.json`;
    const agora = new Date().toISOString();
    const anterior = await lerJson(caminho);
    reg.criado_em = anterior?.criado_em || agora;
    reg.atualizado_em = agora;
    await gravarJson(caminho, reg);
    return { lanche_id: lanche, nota_final: reg.nota_final };
  },

  async admin_dados({ p_senha }) {
    await checarSenha(p_senha);
    const [lanches, perfis, avBlobs] = await Promise.all([nomesLanches(), listarTudo("p/"), listarTudo("av/")]);
    const [avaliadores, avaliacoes] = await Promise.all([
      lerVarios(perfis.map((b) => b.pathname)),
      lerVarios(avBlobs.map((b) => b.pathname)),
    ]);
    const vivos = new Set(avaliadores.map((a) => a.id));
    return {
      lanches,
      avaliadores: avaliadores
        .map(({ id, nome, idade, criado_em }) => ({ id, nome, idade, criado_em }))
        .sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
      avaliacoes: avaliacoes
        .filter((a) => vivos.has(a.avaliador_id))
        .sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    };
  },

  async admin_renomear({ p_senha, p_nomes }) {
    await checarSenha(p_senha);
    const cfg = (await lerJson("cfg/lanches.json")) || {};
    for (const [k, v] of Object.entries(p_nomes || {})) {
      const n = Number(k);
      const nome = String(v ?? "").trim().slice(0, 60);
      if (Number.isInteger(n) && n >= 1 && n <= TOTAL && nome) cfg[n] = nome;
    }
    await gravarJson("cfg/lanches.json", cfg);
    return null;
  },

  async admin_excluir_avaliador({ p_senha, p_id }) {
    await checarSenha(p_senha);
    if (!idValido(p_id)) falha("Avaliador inválido");
    const blobs = await listarTudo(`av/${p_id}/`);
    const urls = blobs.map((b) => b.url);
    const perfil = await listarTudo(`p/${p_id}.json`);
    urls.push(...perfil.map((b) => b.url));
    if (urls.length) await del(urls);
    return null;
  },
};

// ---------- Handler HTTP ----------
async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  let txt = "";
  for await (const parte of req) txt += parte;
  return txt ? JSON.parse(txt) : {};
}

function responder(res, status, dados) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(dados));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { message: "Use POST" });
  const fn = new URL(req.url, "http://x").searchParams.get("fn");
  const f = Object.prototype.hasOwnProperty.call(FUNCOES, fn) ? FUNCOES[fn] : null;
  if (!f) return responder(res, 404, { message: "Função desconhecida" });
  try {
    const args = await lerCorpo(req);
    responder(res, 200, await f(args || {}));
  } catch (e) {
    if (e instanceof ErroUsuario) return responder(res, 400, { message: e.message });
    console.error(fn, e);
    responder(res, 500, { message: "Erro no servidor. Tente de novo em instantes." });
  }
}
