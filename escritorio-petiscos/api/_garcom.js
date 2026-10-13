// Equipe (garçons, caixa e admins), mesas compartilhadas, fechamento de contas e dashboard.
// Banco: Postgres do Supabase, conectado pela Vercel (variável POSTGRES_URL).
// Cada item lançado vira uma linha em ep_lancamento (+1 ou −1), com quem lançou e quando;
// o caixa fecha a conta com a forma de pagamento. O painel lê tudo isso por dia, mesa e pessoa.
import crypto from "node:crypto";
import postgres from "postgres";

const TOTAL_MESAS = 30;
const FUSO = "America/Sao_Paulo";
const TURNO_MS = 16 * 60 * 60 * 1000; // o login vale por um turno
const MAX_FALHAS = 5, BLOQUEIO_MIN = 5;
const PAPEIS = ["garcom", "caixa", "admin"];
const FORMAS = ["dinheiro", "pix", "debito", "credito"];
const PREFIXO_ADMIN = "adm:"; // token de admin usado no lugar da senha mestra do painel

let sql = null;
let migrado = null;

function urlBanco() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || "";
}

export function bancoConectado() {
  return !!urlBanco();
}

async function db(falha) {
  const url = urlBanco();
  if (!url) falha("Banco de dados ainda não conectado. Conecte o Supabase ao projeto na Vercel (Storage → Supabase).");
  if (!sql) {
    const local = /@(localhost|127\.0\.0\.1)|host=\/tmp/.test(url);
    // prepare:false: o pooler do Supabase (porta 6543) não aceita prepared statements.
    // A URL da integração Supabase traz parâmetros extras (sslmode, supa=...) que o Postgres recusa; o SSL vai nas opções.
    sql = postgres(url.split("?")[0], { prepare: false, max: 3, idle_timeout: 20, ssl: local ? false : "require" });
  }
  if (!migrado) migrado = migrar().catch((e) => { migrado = null; throw e; });
  await migrado;
  return sql;
}

async function migrar() {
  await sql.unsafe(`
    create table if not exists ep_garcom (
      id serial primary key,
      nome text not null unique,
      pin_hash text not null,
      ativo boolean not null default true,
      falhas int not null default 0,
      bloqueado_ate timestamptz,
      criado_em timestamptz not null default now()
    );
    alter table ep_garcom add column if not exists papel text not null default 'garcom';
    create table if not exists ep_atendimento (
      id bigserial primary key,
      mesa int not null,
      dia date not null default (now() at time zone '${FUSO}')::date,
      status text not null default 'aberto',
      aberto_em timestamptz not null default now(),
      aberto_por int references ep_garcom(id),
      fechado_em timestamptz,
      fechado_por int references ep_garcom(id),
      servico boolean not null default false,
      pessoas int not null default 1,
      subtotal numeric(10,2),
      total numeric(10,2)
    );
    alter table ep_atendimento add column if not exists conta_pedida boolean not null default false;
    alter table ep_atendimento add column if not exists forma_pagamento text;
    alter table ep_atendimento add column if not exists valor_recebido numeric(10,2);
    alter table ep_atendimento add column if not exists troco numeric(10,2);
    create unique index if not exists ep_atendimento_mesa_aberta on ep_atendimento (mesa) where status = 'aberto';
    create index if not exists ep_atendimento_dia on ep_atendimento (dia);
    create table if not exists ep_lancamento (
      id bigserial primary key,
      atendimento_id bigint not null references ep_atendimento(id) on delete cascade,
      garcom_id int references ep_garcom(id),
      item_id text not null,
      nome text not null,
      preco numeric(10,2) not null,
      qtd int not null,
      em timestamptz not null default now()
    );
    alter table ep_lancamento add column if not exists parte text;
    create index if not exists ep_lancamento_atendimento on ep_lancamento (atendimento_id);
  `);
  // Equipe inicial (nomes e PINs ficam só no arquivo privado da Vercel, fora do GitHub).
  const [{ n }] = await sql`select count(*)::int as n from ep_garcom`;
  if (!n) {
    const privado = await import("./_equipe.js").catch(() => null);
    for (const u of privado?.EQUIPE_INICIAL || []) {
      await sql`insert into ep_garcom (nome, papel, pin_hash) values (${u.nome}, ${u.papel}, ${u.pin_hash}) on conflict (nome) do nothing`;
    }
  }
}

// ---------- Senha (PIN) e token ----------
const hashPin = (pin, sal = crypto.randomBytes(16).toString("hex")) =>
  `${sal}:${crypto.scryptSync(String(pin), sal, 32).toString("hex")}`;
function pinConfere(pin, guardado) {
  const [sal, h] = String(guardado).split(":");
  const a = Buffer.from(hashPin(pin, sal).split(":")[1], "hex"), b = Buffer.from(h || "", "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const chave = () => crypto.createHash("sha256").update(`garcom:${process.env.ADMIN_SENHA || ""}`).digest();
const assinar = (dados) => crypto.createHmac("sha256", chave()).update(dados).digest("base64url");

function criarToken(u) {
  const dados = Buffer.from(JSON.stringify({ g: u.id, p: u.papel, exp: Date.now() + TURNO_MS })).toString("base64url");
  return `${dados}.${assinar(dados)}`;
}

function lerToken(token) {
  const [dados, sig] = String(token || "").split(".");
  const esperado = dados ? assinar(dados) : "";
  if (!sig || sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  try { return JSON.parse(Buffer.from(dados, "base64url").toString()); } catch (e) { return null; }
}

// Confere o token e o papel (garcom, caixa, admin). Admin e caixa podem fazer o que o garçom faz.
async function usuarioDoToken(token, falha, papeis = PAPEIS) {
  const t = lerToken(token);
  if (!t) falha("Entre de novo com seu nome e PIN.");
  if (!t.exp || t.exp < Date.now()) falha("Seu turno expirou. Entre de novo com seu nome e PIN.");
  const s = await db(falha);
  const [u] = await s`select id, nome, papel from ep_garcom where id = ${t.g} and ativo`;
  if (!u) falha("Acesso desativado. Fale com o gerente.");
  if (!papeis.includes(u.papel)) falha("Seu acesso não permite esta função.");
  return { s, u };
}

// Usado pelo rpc.js: o painel aceita a senha mestra ou o token de um admin cadastrado.
export async function adminPorToken(senha) {
  if (!String(senha || "").startsWith(PREFIXO_ADMIN) || !bancoConectado()) return false;
  const t = lerToken(String(senha).slice(PREFIXO_ADMIN.length));
  if (!t || !t.exp || t.exp < Date.now() || t.p !== "admin") return false;
  const [u] = await (await db((m) => { throw new Error(m); }))`select id from ep_garcom where id = ${t.g} and ativo and papel = 'admin'`;
  return !!u;
}

// ---------- Mesas ----------
const n2 = (v) => Math.round(Number(v) * 100) / 100;

async function mesasAbertas(s, mesa = null) {
  const atend = await s`
    select a.id, a.mesa, a.aberto_em, a.servico, a.pessoas, a.conta_pedida, g.nome as aberto_por
    from ep_atendimento a left join ep_garcom g on g.id = a.aberto_por
    where a.status = 'aberto' ${mesa != null ? s`and a.mesa = ${mesa}` : s``}
    order by a.mesa`;
  if (!atend.length) return [];
  const itens = await s`
    select atendimento_id, item_id, nome, preco, sum(qtd)::int as qtd
    from ep_lancamento where atendimento_id in ${s(atend.map((a) => a.id))}
    group by atendimento_id, item_id, nome, preco having sum(qtd) > 0
    order by min(em)`;
  // Mesa cujos itens foram todos tirados volta a aparecer como livre.
  return atend.map((a) => {
    const lista = itens.filter((i) => i.atendimento_id === a.id).map((i) => ({ id: i.item_id, nome: i.nome, preco: Number(i.preco), qtd: i.qtd }));
    const subtotal = n2(lista.reduce((t, i) => t + i.preco * i.qtd, 0));
    return {
      mesa: a.mesa, atendimento: Number(a.id), aberto_em: a.aberto_em, aberto_por: a.aberto_por, conta_pedida: a.conta_pedida,
      servico: a.servico, pessoas: a.pessoas, itens: lista, subtotal, total: n2(subtotal * (a.servico ? 1.1 : 1)),
    };
  }).filter((m) => m.itens.length);
}

function validarMesa(m, falha) {
  const n = Number(m);
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_MESAS) falha("Mesa inválida.");
  return n;
}

// Fecha a conta de uma mesa registrando a forma de pagamento (caixa ou admin).
async function fecharConta(s, falha, usuarioId, mesa, forma, recebido) {
  if (!FORMAS.includes(forma)) falha("Escolha a forma de pagamento.");
  const [m] = await mesasAbertas(s, mesa);
  if (!m) falha("Essa mesa não tem conta aberta.");
  let valorRecebido = null, troco = null;
  if (forma === "dinheiro" && recebido != null && String(recebido).trim() !== "") {
    valorRecebido = n2(Number(String(recebido).replace(",", ".")));
    if (!isFinite(valorRecebido) || valorRecebido < m.total) falha("O valor recebido é menor que o total.");
    troco = n2(valorRecebido - m.total);
  }
  await s`update ep_atendimento set status = 'fechado', fechado_em = now(), fechado_por = ${usuarioId},
    subtotal = ${m.subtotal}, total = ${m.total}, forma_pagamento = ${forma}, valor_recebido = ${valorRecebido}, troco = ${troco}
    where id = ${m.atendimento} and status = 'aberto'`;
  return { ...m, forma_pagamento: forma, valor_recebido: valorRecebido, troco };
}

// ---------- Fluxo do dia ----------
async function fluxoDoDia(s, dia) {
  const atend = await s`
    select a.*, ga.nome as aberto_por_nome, gf.nome as fechado_por_nome
    from ep_atendimento a
    left join ep_garcom ga on ga.id = a.aberto_por
    left join ep_garcom gf on gf.id = a.fechado_por
    where a.dia = ${dia} and a.status <> 'cancelado'
    order by a.aberto_em`;
  const lanc = atend.length ? await s`
    select l.id, l.atendimento_id, l.item_id, l.nome, l.preco, l.qtd, l.em, l.parte, g.nome as garcom
    from ep_lancamento l left join ep_garcom g on g.id = l.garcom_id
    where l.atendimento_id in ${s(atend.map((a) => a.id))}
    order by l.em` : [];
  return {
    dia,
    atendimentos: atend.map((a) => {
      const meus = lanc.filter((l) => l.atendimento_id === a.id);
      const itens = new Map();
      for (const l of meus) {
        const k = `${l.item_id}|${l.preco}`;
        const it = itens.get(k) || { nome: l.nome, preco: Number(l.preco), parte: l.parte, qtd: 0, por: {} };
        it.qtd += l.qtd;
        it.por[l.garcom || "?"] = (it.por[l.garcom || "?"] || 0) + l.qtd;
        itens.set(k, it);
      }
      const lista = [...itens.values()].filter((i) => i.qtd > 0);
      const subtotal = n2(lista.reduce((t, i) => t + i.preco * i.qtd, 0));
      return {
        id: Number(a.id), mesa: a.mesa, status: a.status, conta_pedida: a.conta_pedida,
        aberto_em: a.aberto_em, aberto_por: a.aberto_por_nome, fechado_em: a.fechado_em, fechado_por: a.fechado_por_nome,
        servico: a.servico, pessoas: a.pessoas,
        forma_pagamento: a.forma_pagamento, valor_recebido: a.valor_recebido != null ? Number(a.valor_recebido) : null, troco: a.troco != null ? Number(a.troco) : null,
        subtotal: a.subtotal != null ? Number(a.subtotal) : subtotal,
        total: a.total != null ? Number(a.total) : n2(subtotal * (a.servico ? 1.1 : 1)),
        itens: lista,
        garcons: [...new Set(meus.map((l) => l.garcom).filter(Boolean))],
      };
    }).filter((a) => a.status === "fechado" || a.itens.length),
    lancamentos: lanc.map((l) => ({ atendimento: Number(l.atendimento_id), mesa: atend.find((a) => a.id === l.atendimento_id).mesa, garcom: l.garcom, nome: l.nome, parte: l.parte, preco: Number(l.preco), qtd: l.qtd, em: l.em })),
  };
}

// Resumo do caixa de um dia: total por forma de pagamento e contas fechadas.
async function resumoCaixa(s, dia) {
  const contas = await s`
    select a.mesa, a.total::float as total, a.forma_pagamento, a.valor_recebido::float as valor_recebido, a.troco::float as troco,
      a.aberto_em, a.fechado_em, g.nome as fechado_por
    from ep_atendimento a left join ep_garcom g on g.id = a.fechado_por
    where a.dia = ${dia} and a.status = 'fechado' order by a.fechado_em desc`;
  const porForma = Object.fromEntries(FORMAS.map((f) => [f, 0]));
  for (const c of contas) if (c.forma_pagamento in porForma) porForma[c.forma_pagamento] = n2(porForma[c.forma_pagamento] + c.total);
  return { dia, contas, porForma, total: n2(contas.reduce((t, c) => t + c.total, 0)) };
}

const hojeSql = (s) => s`select (now() at time zone ${FUSO})::date::text as hoje`;
const papelValido = (p) => (PAPEIS.includes(p) ? p : "garcom");
const listaEquipe = (s) => s`select id, nome, papel, ativo, criado_em from ep_garcom order by ativo desc, papel, nome`;

// ---------- Funções expostas pela API ----------
export function funcoesGarcom({ falha, checarSenha }) {
  return {
    // Nomes para a tela de login (só nomes; o PIN é conferido no servidor).
    async garcom_lista({ p_papel } = {}) {
      if (!bancoConectado()) return { conectado: false, garcons: [] };
      const s = await db(falha);
      const papeis = p_papel === "caixa" ? ["caixa"] : ["garcom"];
      return { conectado: true, garcons: await s`select id, nome, papel from ep_garcom where ativo and papel in ${s(papeis)} order by papel = 'garcom' desc, nome` };
    },

    async garcom_entrar({ p_id, p_pin }) {
      const s = await db(falha);
      const [g] = await s`select * from ep_garcom where id = ${Number(p_id) || 0} and ativo`;
      if (!g) falha("Usuário não encontrado.");
      if (g.bloqueado_ate && new Date(g.bloqueado_ate) > new Date()) falha(`Muitas tentativas. Espere ${BLOQUEIO_MIN} minutos ou peça ao gerente para trocar a senha.`);
      if (!pinConfere(String(p_pin || ""), g.pin_hash)) {
        const falhas = g.falhas + 1;
        await s`update ep_garcom set falhas = ${falhas >= MAX_FALHAS ? 0 : falhas},
          bloqueado_ate = ${falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MIN * 60000) : null} where id = ${g.id}`;
        await new Promise((r) => setTimeout(r, 1000));
        falha("Senha incorreta.");
      }
      await s`update ep_garcom set falhas = 0, bloqueado_ate = null where id = ${g.id}`;
      return { token: criarToken(g), id: g.id, nome: g.nome, papel: g.papel };
    },

    async garcom_mesas({ p_token }) {
      const { s, u } = await usuarioDoToken(p_token, falha);
      return { garcom: u.nome, papel: u.papel, mesas: await mesasAbertas(s) };
    },

    async garcom_lancar({ p_token, p_mesa, p_item, p_qtd }) {
      const { s, u } = await usuarioDoToken(p_token, falha);
      const mesa = validarMesa(p_mesa, falha);
      const qtd = Number(p_qtd) === -1 ? -1 : 1;
      const item = {
        id: String(p_item?.id || "").slice(0, 120), nome: String(p_item?.nome || "").trim().slice(0, 120),
        preco: n2(Number(p_item?.preco)), parte: String(p_item?.parte || "").slice(0, 20) || null,
      };
      if (!item.id || !item.nome || !isFinite(item.preco) || item.preco < 0 || item.preco > 9999) falha("Item inválido.");
      await s.begin(async (t) => {
        let [a] = await t`select id from ep_atendimento where mesa = ${mesa} and status = 'aberto' for update`;
        if (!a) {
          if (qtd < 0) return;
          [a] = await t`insert into ep_atendimento (mesa, aberto_por) values (${mesa}, ${u.id})
            on conflict (mesa) where status = 'aberto' do update set mesa = excluded.mesa returning id`;
        }
        if (qtd < 0) {
          const [{ q }] = await t`select coalesce(sum(qtd), 0)::int as q from ep_lancamento where atendimento_id = ${a.id} and item_id = ${item.id} and preco = ${item.preco}`;
          if (q <= 0) return;
        }
        await t`insert into ep_lancamento (atendimento_id, garcom_id, item_id, nome, preco, qtd, parte)
          values (${a.id}, ${u.id}, ${item.id}, ${item.nome}, ${item.preco}, ${qtd}, ${item.parte})`;
        // Item novo depois de pedir a conta: a mesa volta a ficar em atendimento.
        if (qtd > 0) await t`update ep_atendimento set conta_pedida = false where id = ${a.id}`;
      });
      return (await mesasAbertas(s, mesa))[0] || null;
    },

    async garcom_ajustar({ p_token, p_mesa, p_servico, p_pessoas }) {
      const { s } = await usuarioDoToken(p_token, falha);
      const mesa = validarMesa(p_mesa, falha);
      const pessoas = Math.min(50, Math.max(1, Math.round(Number(p_pessoas) || 1)));
      await s`update ep_atendimento set servico = ${!!p_servico}, pessoas = ${pessoas} where mesa = ${mesa} and status = 'aberto'`;
      return (await mesasAbertas(s, mesa))[0] || null;
    },

    // O garçom pede a conta; quem fecha e recebe é o caixa.
    async garcom_pedir_conta({ p_token, p_mesa }) {
      const { s } = await usuarioDoToken(p_token, falha);
      const mesa = validarMesa(p_mesa, falha);
      await s`update ep_atendimento set conta_pedida = true where mesa = ${mesa} and status = 'aberto'`;
      return (await mesasAbertas(s, mesa))[0] || null;
    },

    // ----- Caixa -----
    async caixa_mesas({ p_token }) {
      const { s, u } = await usuarioDoToken(p_token, falha, ["caixa", "admin"]);
      const [{ hoje }] = await hojeSql(s);
      return { usuario: u.nome, papel: u.papel, mesas: await mesasAbertas(s), resumo: await resumoCaixa(s, hoje) };
    },

    async caixa_fechar({ p_token, p_mesa, p_forma, p_recebido }) {
      const { s, u } = await usuarioDoToken(p_token, falha, ["caixa", "admin"]);
      return fecharConta(s, falha, u.id, validarMesa(p_mesa, falha), p_forma, p_recebido);
    },

    // ----- Painel (admin) -----
    async admin_entrar({ p_nome, p_senha }) {
      const s = await db(falha);
      const [g] = await s`select * from ep_garcom where lower(nome) = lower(${String(p_nome || "").trim()}) and ativo and papel = 'admin'`;
      if (!g || (g.bloqueado_ate && new Date(g.bloqueado_ate) > new Date()) || !pinConfere(String(p_senha || ""), g.pin_hash)) {
        if (g) {
          const falhas = g.falhas + 1;
          await s`update ep_garcom set falhas = ${falhas >= MAX_FALHAS ? 0 : falhas},
            bloqueado_ate = ${falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MIN * 60000) : null} where id = ${g.id}`;
        }
        await new Promise((r) => setTimeout(r, 1000));
        falha("Usuário ou senha incorretos.");
      }
      await s`update ep_garcom set falhas = 0, bloqueado_ate = null where id = ${g.id}`;
      return { token: PREFIXO_ADMIN + criarToken(g), nome: g.nome };
    },

    async admin_garcons({ p_senha }) {
      await checarSenha(p_senha);
      if (!bancoConectado()) return { conectado: false, garcons: [] };
      const s = await db(falha);
      return { conectado: true, garcons: await listaEquipe(s) };
    },

    async admin_garcom_salvar({ p_senha, p_id, p_nome, p_pin, p_ativo, p_papel }) {
      await checarSenha(p_senha);
      const s = await db(falha);
      const nome = String(p_nome || "").trim().slice(0, 40);
      const pin = String(p_pin || "").trim();
      const papel = papelValido(p_papel);
      if (pin && papel !== "admin" && !/^\d{4,6}$/.test(pin)) falha("O PIN de garçom e caixa precisa ter de 4 a 6 números.");
      if (pin && papel === "admin" && pin.length < 6) falha("A senha de admin precisa ter pelo menos 6 caracteres.");
      try {
        if (p_id) {
          if (!nome) falha("Informe o nome.");
          await s`update ep_garcom set nome = ${nome}, ativo = ${p_ativo !== false}, papel = ${papel},
            ${pin ? s`pin_hash = ${hashPin(pin)}, falhas = 0, bloqueado_ate = null,` : s``} criado_em = criado_em where id = ${Number(p_id)}`;
        } else {
          if (!nome || !pin) falha("Informe o nome e a senha.");
          await s`insert into ep_garcom (nome, papel, pin_hash) values (${nome}, ${papel}, ${hashPin(pin)})`;
        }
      } catch (e) {
        if (e.code === "23505") falha("Já existe alguém com esse nome.");
        throw e;
      }
      return listaEquipe(s);
    },

    async admin_fluxo({ p_senha, p_dia }) {
      await checarSenha(p_senha);
      if (!bancoConectado()) return { conectado: false };
      const s = await db(falha);
      const [{ hoje }] = await hojeSql(s);
      const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(p_dia || "")) ? p_dia : hoje;
      const dias = await s`select dia::text, count(*)::int as atendimentos, coalesce(sum(total), 0)::float as total
        from ep_atendimento where status = 'fechado' group by dia order by dia desc limit 31`;
      return { conectado: true, hoje, dias, caixa: await resumoCaixa(s, dia), ...(await fluxoDoDia(s, dia)) };
    },

    // Mesas abertas agora (pedidos ao vivo) e fechamento pelo painel.
    async admin_mesas({ p_senha }) {
      await checarSenha(p_senha);
      if (!bancoConectado()) return { conectado: false, mesas: [] };
      return { conectado: true, mesas: await mesasAbertas(await db(falha)) };
    },

    async admin_fechar({ p_senha, p_mesa, p_forma, p_recebido }) {
      await checarSenha(p_senha);
      const s = await db(falha);
      return fecharConta(s, falha, null, validarMesa(p_mesa, falha), p_forma, p_recebido);
    },

    // Dashboard: evolução por dia, por hora, pratos mais pedidos, partes do cardápio, formas de pagamento e equipe.
    async admin_dashboard({ p_senha, p_dias }) {
      await checarSenha(p_senha);
      if (!bancoConectado()) return { conectado: false };
      const s = await db(falha);
      const dias = [7, 30, 90].includes(Number(p_dias)) ? Number(p_dias) : 30;
      const [{ hoje }] = await hojeSql(s);
      const [porDia, porHora, top, porParte, porForma, porGarcom, abertas, resumoHoje, resumoOntem] = await Promise.all([
        s`select dia::text, count(*)::int as atendimentos, coalesce(sum(total), 0)::float as total
          from ep_atendimento where status = 'fechado' and dia > ${hoje}::date - ${dias}::int group by dia order by dia`,
        s`select extract(hour from (l.em at time zone ${FUSO}))::int as hora, sum(l.qtd)::int as itens, sum(l.qtd * l.preco)::float as valor
          from ep_lancamento l join ep_atendimento a on a.id = l.atendimento_id
          where a.dia = ${hoje} and a.status <> 'cancelado' group by 1 order by 1`,
        s`select l.nome, coalesce(max(l.parte), '') as parte, sum(l.qtd)::int as qtd, sum(l.qtd * l.preco)::float as valor
          from ep_lancamento l join ep_atendimento a on a.id = l.atendimento_id
          where a.dia > ${hoje}::date - ${dias}::int and a.status <> 'cancelado' group by l.nome having sum(l.qtd) > 0 order by 3 desc, 4 desc limit 15`,
        s`select coalesce(l.parte, 'outros') as parte, sum(l.qtd)::int as qtd, sum(l.qtd * l.preco)::float as valor
          from ep_lancamento l join ep_atendimento a on a.id = l.atendimento_id
          where a.dia > ${hoje}::date - ${dias}::int and a.status <> 'cancelado' group by 1 order by 3 desc`,
        s`select coalesce(forma_pagamento, 'sem registro') as forma, count(*)::int as contas, sum(total)::float as total
          from ep_atendimento where status = 'fechado' and dia > ${hoje}::date - ${dias}::int group by 1 order by 3 desc`,
        s`select g.nome, count(distinct l.atendimento_id)::int as mesas, sum(case when l.qtd > 0 then l.qtd else 0 end)::int as itens,
            sum(l.qtd * l.preco)::float as valor
          from ep_lancamento l join ep_garcom g on g.id = l.garcom_id join ep_atendimento a on a.id = l.atendimento_id
          where a.dia > ${hoje}::date - ${dias}::int and a.status <> 'cancelado' group by g.nome order by 4 desc`,
        mesasAbertas(s),
        s`select count(*)::int as contas, coalesce(sum(total), 0)::float as total,
            coalesce(avg(extract(epoch from (fechado_em - aberto_em)) / 60), 0)::float as minutos
          from ep_atendimento where status = 'fechado' and dia = ${hoje}`,
        s`select count(*)::int as contas, coalesce(sum(total), 0)::float as total
          from ep_atendimento where status = 'fechado' and dia = ${hoje}::date - 1`,
      ]);
      return { conectado: true, hoje, dias, porDia, porHora, top, porParte, porForma, porGarcom, abertas, hojeResumo: resumoHoje[0], ontemResumo: resumoOntem[0] };
    },
  };
}
