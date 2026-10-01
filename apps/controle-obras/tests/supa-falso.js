'use strict';
// Supabase falso, em memória, só para testar a camada de dados do app (esquema v2).
// NÃO simula RLS: isso é testado no Postgres real (supabase/tests). Aqui se testa o cliente.
const clone = (x) => JSON.parse(JSON.stringify(x));

function supaFalso(opts) {
  opts = opts || {};
  const tabelas = {}, canais = [], log = [], uploads = [], opsAplicadas = new Set();
  const rede = { ligada: true, perdeRespostaUmaVez: false };
  const semRede = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
  const tab = (n) => tabelas[n] || (tabelas[n] = new Map());
  const uid = 'u-123';
  Object.keys(opts.seed || {}).forEach((t) => Object.keys(opts.seed[t]).forEach((id) => {
    const s = opts.seed[t][id];
    tab(t).set(id, { id, obra_id: s.obra_id || s.obraId || null, dados: clone(s.dados || s), versao: s.versao || 1, excluido_em: s.excluido_em || null });
  }));
  Object.keys(opts.cruas || {}).forEach((t) => opts.cruas[t].forEach((r) => tab(t).set(String(r.id), clone(r))));
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
      if (!rede.ligada) return semRede();
      log.push({ t, op: q.op, payload: q.payload && clone(q.payload) });
      if (opts.falhaEm && opts.falhaEm === t) return { data: null, error: { code: 'XX', message: 'falha simulada' } };
      if (q.op === 'select') return { data: clone(linhas().slice(q.ini, q.fim + 1)), error: null };
      if (q.op === 'insert') {
        const o = q.payload;
        if (tab(t).has(o.id)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        const r = { id: o.id, obra_id: o.obra_id || null, dados: clone(o.dados), versao: 1, excluido_em: null };
        tab(t).set(o.id, r);
        if (rede.perdeRespostaUmaVez) { rede.perdeRespostaUmaVez = false; return semRede(); }
        return { data: q.retorna ? [{ versao: 1 }] : null, error: null };
      }
      if (q.op === 'update') {
        const alvo = linhas(); alvo.forEach((r) => { Object.assign(r, clone(q.payload)); r.versao += 1; });
        return { data: q.retorna ? alvo.map((r) => ({ versao: r.versao })) : null, error: null };
      }
      if (q.op === 'upsert') {
        const o = q.payload, k = String(o.id || o.user_id), ex = tab(t).get(k);
        tab(t).set(k, Object.assign(ex || {}, clone(o))); return { data: null, error: null };
      }
      return { data: null, error: { message: 'operação não suportada no falso' } };
    }
    return b;
  }

  const cli = {
    from: builder,
    async rpc(nome, args) {
      if (!rede.ligada) return semRede();
      log.push({ t: 'rpc:' + nome, op: 'rpc', payload: clone(args) });
      if (nome === 'campo_ler') return { data: Array.from(tab(args.tab).values()).filter((r) => !r.excluido_em).map(clone), error: null };
      if (nome === 'campo_patch') {
        if (opsAplicadas.has(args.p_op)) return { data: 0, error: null };
        opsAplicadas.add(args.p_op);
        const r = tab(args.tab).get(args.rid); if (!r) return { error: { message: 'Registro não encontrado' } };
        const perm = args.tab === 'compras' ? ['status', 'entrega', 'conf', 'hist'] : ['status', 'apontamentos', 'entrada', 'devolucao'];
        Object.keys(args.patch).filter((k) => perm.indexOf(k) >= 0).forEach((k) => { r.dados[k] = k === 'apontamentos' ? Object.assign({}, r.dados[k] || {}, args.patch[k]) : clone(args.patch[k]); });
        r.versao += 1; return { data: 1, error: null };
      }
      if (nome === 'anexar_item') {
        if (opsAplicadas.has(args.p_op)) return { data: 0, error: null };
        opsAplicadas.add(args.p_op);
        const r = tab(args.tab).get(args.rid); if (!r) return { error: { message: 'Registro não encontrado' } };
        r.dados[args.campo] = (r.dados[args.campo] || []).concat([clone(args.item)]); r.versao += 1; return { data: 1, error: null };
      }
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
    storage: { from: () => ({ upload: async (path, blob, o) => { if (!rede.ligada) return semRede(); uploads.push({ path, size: blob && blob.size, upsert: o && o.upsert }); return { error: null }; } }) }
  };

  return {
    cli, log, tabelas, uid, rede, uploads, opsAplicadas,
    sessao: (v) => { session = v ? { user: { id: uid, email: 'edson@cariati.com', user_metadata: {} } } : null; },
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
