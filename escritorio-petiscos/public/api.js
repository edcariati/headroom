// Comunicação com o Supabase + definições da ficha, usadas pelo site e pelo painel.
(function () {
  const cfg = window.CONFIG;

  async function rpc(fn, args) {
    const key = cfg.SUPABASE_ANON_KEY;
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key; // chave anon legada (JWT)
    let res;
    try {
      res = await fetch(cfg.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers,
        body: JSON.stringify(args || {}),
      });
    } catch (e) {
      throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    }
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error((body && body.message) || "Erro " + res.status);
    return body;
  }

  const OPCOES = {
    espera: [
      ["ate10", "Até 10 min"],
      ["10a20", "10 a 20 min"],
      ["mais20", "Mais de 20 min"],
    ],
    chegou: [
      ["quente", "Quente"],
      ["morno", "Morno"],
      ["frio", "Frio"],
    ],
    tamanho_percepcao: [
      ["pequeno", "Pequeno"],
      ["na_medida", "Na medida"],
      ["grande", "Grande demais"],
    ],
  };

  const NOTAS = [
    ["nota_espera", "Tempo de espera"],
    ["nota_temperatura", "Temperatura"],
    ["nota_aparencia", "Aparência"],
    ["nota_montagem", "Montagem"],
    ["nota_sabor", "Sabor geral"],
    ["nota_carne", "Carne"],
    ["nota_pao", "Pão"],
    ["nota_molho", "Molho"],
    ["nota_ingredientes", "Ingredientes"],
    ["nota_tamanho", "Tamanho"],
    ["nota_facilidade", "Facilidade de comer"],
    ["nota_pediria", "Pediria de novo"],
    ["nota_indicaria", "Indicaria para um amigo"],
  ];

  const rotulo = (campo, valor) => {
    const o = (OPCOES[campo] || []).find((x) => x[0] === valor);
    return o ? o[1] : valor || "";
  };

  const num = (v, casas = 1) =>
    v == null || isNaN(v) ? "–" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const reais = (v) =>
    v == null || isNaN(v) ? "–" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const configurado = () => !/SEU-PROJETO|COLE-AQUI/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);

  window.EP = { rpc, OPCOES, NOTAS, rotulo, num, reais, esc, configurado, cfg };
})();
