'use strict';
// Supabase falso, em memória, só para testar a camada de dados do app (esquema v2).
// NÃO simula RLS: isso é testado no Postgres real (supabase/tests). Aqui se testa o cliente.
const clone = (x) => JSON.parse(JSON.stringify(x));

function supaFalso(opts) {
  opts = opts || {};
  const tabelas = {}, canais = [], log = [];
  const tab = (n) => tabelas[n] || (tabelas[n] = new Map());
  const uid = 'u-123';
  Object.keys(opts.seed || {}).forEach((t) => Object.keys(opts.seed[t]).forEach((id) => {
    const s = opts.seed[t][id];
    tab(t).set(id, { id, obra_id: s.obra_id || s.obraId || null, dados: clone(s.dados || s), versao: s.versao || 1, excluido_em: s.excluido_em || null });
  }));
  if (opts.perfil !== null) tab('perfis').set(uid, { user_id: uid, nome: 'Edson', papel: 'dono', ativo: true, ...(opts.perfil || {}) });
  let session = opts.session === false ? null : { user: { id: uid, email: 'edson@cariati.com', user_metadata: {} } };

  function builder(t) {
    const q = { op: 'select', filtros: [], payload: null, ini: 0, fim: 9999, retorna: false };
    const b = {
      select() { q.retorna = true; return b; },
      insert(o) { q.op = 'insert'; q.payload = o; return b; },
      update(o) { q.op = 'update'; q.payload = o; return b; },
      upsert(o) { q.op = 'upsert'; q.payload = o; return b; },
      eq(k, v) { q.filtros.push((r) => r[k] === v); return b; },
      is(k, v) { q.filtros.push((r) => (r[k] == null) === (v === null)); return b; },
      in(k, arr) { q.filtros.push((r) => arr.indexOf(r[k]) >= 0); return b; },
      order() { return b; }, limit() { return b; },
      range(a, z) { q.ini = a; q.fim = z; return b; },
      then(ok, ko) { return Promise.resolve().then(exec).then(ok, ko); }
    };
    function linhas() { return Array.from(tab(t).values()).filter((r) => q.filtros.every((f) => f(r))); }
    function exec() {
      log.push({ t, op: q.op, payload: q.payload && clone(q.payload) });
      if (opts.falhaEm && opts.falhaEm === t) return { data: null, error: { code: 'XX', message: 'falha simulada' } };
      if (q.op === 'select') return { data: clone(linhas().slice(q.ini, q.fim + 1)), error: null };
      if (q.op === 'insert') {
        const o = q.payload;
        if (tab(t).has(o.id)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        const r = { id: o.id, obra_id: o.obra_id || null, dados: clone(o.dados), versao: 1, excluido_em: null };
        tab(t).set(o.id, r); return { data: q.retorna ? [{ versao: 1 }] : null, error: null };
      }
      if (q.op === 'update') {
        const alvo = linhas(); alvo.forEach((r) => { Object.assign(r, clone(q.payload)); r.versao += 1; });
        return { data: q.retorna ? alvo.map((r) => ({ versao: r.versao })) : null, error: null };
      }
      return { data: null, error: { message: 'operação não suportada no falso' } };
    }
    return b;
  }

  const cli = {
    from: builder,
    async rpc(nome, args) {
      log.push({ t: 'rpc:' + nome, op: 'rpc', payload: clone(args) });
      if (nome === 'excluir_registro') {
        const r = tab(args.tab).get(args.rid); if (!r) return { error: { message: 'Registro não encontrado' } };
        r.excluido_em = new Date().toISOString(); r.versao += 1; return { data: null, error: null };
      }
      return { error: { message: 'rpc desconhecida' } };
    },
    channel(nome) {
      const c = { nome, ons: [], on(tipo, filtro, cb) { c.ons.push({ filtro, cb }); return c; }, subscribe() { canais.push(c); return c; } };
      return c;
    },
    removeChannel(c) { const i = canais.indexOf(c); if (i >= 0) canais.splice(i, 1); },
    auth: {
      async getSession() { return { data: { session } }; },
      async signInWithPassword() { session = { user: { id: uid, email: 'edson@cariati.com', user_metadata: {} } }; return { data: { session }, error: null }; },
      async signOut() { session = null; return {}; },
      async resetPasswordForEmail() { return { error: null }; }
    },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) }
  };

  return {
    cli, log, tabelas, uid,
    linhas: (t) => Array.from(tab(t).values()).map(clone),
    // simula uma mudança vinda de outra pessoa (Realtime)
    emite(t, linha) {
      canais.forEach((c) => c.ons.forEach((o) => { if (o.filtro.table === t) o.cb({ eventType: 'UPDATE', new: clone(linha) }); }));
    },
    // simula outra pessoa gravando direto no banco (muda a versão sem avisar este cliente)
    outraPessoaGrava(t, id, dados) { const r = tab(t).get(id); r.dados = clone(dados); r.versao += 1; },
    canais: () => canais.length
  };
}
module.exports = { supaFalso };
