// Comunicação com o Supabase + definições da ficha, usadas pelo site e pelo painel.
(function () {
  const cfg = window.CONFIG;

  async function rpc(fn, args) {
    let res;
    try {
      res = await fetch("/api/rpc?fn=" + encodeURIComponent(fn), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
      });
    } catch (e) {
      throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    }
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { /* resposta não-JSON */ }
    if (!res.ok) throw new Error((body && body.message) || "Erro " + res.status + ". Tente de novo.");
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

  window.EP = { rpc, OPCOES, NOTAS, rotulo, num, reais, esc, cfg };
})();
