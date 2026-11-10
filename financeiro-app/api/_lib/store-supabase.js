// Armazenamento no Supabase (Postgres). Mesma interface do Blob; fala com o banco pelas funções fin_* (veja supabase/schema.sql),
// que exigem o segredo do aplicativo. Usa só fetch: não precisa de biblioteca.
export class StoreSupabase {
  constructor({ url, chave, segredo, fetchFn = globalThis.fetch }) {
    if (!url || !chave || !segredo) throw new Error('Supabase sem configuração (SUPABASE_URL, SUPABASE_ANON_KEY, FINANCEIRO_KV_SEGREDO).');
    this.base = `${String(url).replace(/\/+$/, '')}/rest/v1/rpc/`;
    this.chave = chave; this.segredo = segredo; this.fetch = fetchFn;
  }
  async rpc(nome, args = {}) {
    const cabecalhos = { apikey: this.chave, 'Content-Type': 'application/json' };
    if (String(this.chave).startsWith('eyJ')) cabecalhos.Authorization = `Bearer ${this.chave}`; // chave antiga (JWT)
    for (let tentativa = 1; ; tentativa++) {
      let r;
      try { r = await this.fetch(this.base + nome, { method: 'POST', headers: cabecalhos, body: JSON.stringify({ p_segredo: this.segredo, ...args }) }); }
      catch (e) { if (tentativa >= 4) throw e; await new Promise((ok) => setTimeout(ok, 200 * tentativa * tentativa)); continue; }
      if (r.ok) { const t = await r.text(); return t ? JSON.parse(t) : null; }
      if ((r.status >= 500 || r.status === 429) && tentativa < 4) { await new Promise((ok) => setTimeout(ok, 200 * tentativa * tentativa)); continue; }
      throw new Error(`Supabase ${nome}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
  }
  async listar(prefixo) { return (await this.rpc('fin_listar', { p_prefixo: prefixo })).map((x) => ({ caminho: x.caminho, etag: x.etag })); }
  async ler(caminho) { return (await this.rpc('fin_ler', { p_caminho: caminho })) ?? null; }
  // Vários de uma vez (uma ida ao banco por lote), para a primeira leitura de uma instância nova.
  async lerMuitos(caminhos) {
    const out = new Map();
    for (let i = 0; i < caminhos.length; i += 150) {
      for (const x of await this.rpc('fin_ler_muitos', { p_caminhos: caminhos.slice(i, i + 150) })) out.set(x.caminho, x.dados);
    }
    return out;
  }
  async gravar(caminho, obj) { return this.rpc('fin_gravar', { p_caminho: caminho, p_dados: obj }); }
  async gravarMuitos(pares) {
    for (let i = 0; i < pares.length; i += 60) await this.rpc('fin_gravar_muitos', { p_itens: pares.slice(i, i + 60).map(([caminho, dados]) => ({ caminho, dados })) });
  }
  async excluir(caminho) { await this.rpc('fin_excluir', { p_caminho: caminho }); }
}
