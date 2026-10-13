// Catálogo único da casa: junta os lanches (API), o cardápio fixo (cardapio-dados.js) e as
// bebidas/doces editados no painel. Usado pelo cardápio e pela calculadora dos garçons,
// para que nome e preço sejam sempre os mesmos nos dois lugares.
(function () {
  const C = window.CARDAPIO_CASA;
  const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const item = (nome, preco, extra = {}) => ({ id: extra.id || slug(nome), nome, preco, ...extra });
  const leve = (titulo) => C.leves.find((g) => g.titulo === titulo);

  // Agrupa bebidas/doces pela categoria, na ordem em que aparecem.
  function porCategoria(itens, prefixo) {
    const grupos = [];
    itens.forEach((b) => {
      let g = grupos.find((x) => x.titulo === b.categoria);
      if (!g) grupos.push((g = { titulo: b.categoria, itens: [] }));
      g.itens.push(item(b.nome, b.preco ?? null, { id: `${prefixo}-${slug(b.categoria)}-${slug(b.nome)}`, desc: b.descricao || "" }));
    });
    return grupos;
  }

  async function carregar() {
    const { rpc } = window.EP;
    const [lanches, extra] = await Promise.all([
      rpc("listar_lanches"),
      rpc("listar_cardapio_extra").catch(() => ({ bebidas: [], doces: [] })),
    ]);
    const extras = leve("Extras");
    const bebidas = extra.bebidas || [];
    const ehCafe = (b) => slug(b.categoria || "") === "cafes";
    return {
      lanches,
      partes: [
        // Café e Bom Dia: tudo de café da manhã fica só aqui (não se repete nas outras partes).
        {
          id: "cafe", titulo: "Café e Bom Dia", icone: "☕",
          grupos: [
            ...porCategoria(bebidas.filter(ehCafe), "bebida"),
            ...["Omeletes", "Pães especiais", "Lanches naturais"].map((t) => ({ titulo: t, sub: leve(t).sub, itens: leve(t).itens.map(([n, v, d]) => item(n, v, { desc: d })) })),
            { titulo: "Extras", sub: extras.sub, itens: extras.itens.map(([n, v]) => item(n, v, { id: `extra-${slug(n)}` })) },
          ],
        },
        {
          id: "lanches", titulo: "Lanches", icone: "🍔",
          grupos: [
            { titulo: "Vida de Escritório", itens: lanches.map((l) => item(`${l.id}. ${l.codinome || l.nome}`, l.preco ?? null, { id: `lanche-${l.id}`, sub: l.nome, desc: l.descricao || "", lanche: l })) },
          ],
        },
        {
          id: "pratos", titulo: "Pratos quentes", icone: "🍽",
          grupos: [
            ...C.executivos.grupos.map((g) => ({ titulo: `Executivo · ${g.titulo}`, icone: g.icone, obs: g.obs, itens: g.itens.map(([n, v]) => item(n, v)) })),
            ...C.especiais.map((d) => ({ titulo: `${d.dia} · ${d.tema}`, dia: d, itens: d.itens.map(([n, v]) => item(n, v)) })),
            ...C.chapa.itens.map((p) => ({ titulo: p.nome, chapa: p, itens: p.opcoes.map(([o, v]) => item(`${p.nome} · ${o}`, v, { opcao: o })) })),
          ],
        },
        { id: "bebidas", titulo: "Bebidas", icone: "🥤", grupos: porCategoria(bebidas.filter((b) => !ehCafe(b)), "bebida") },
        { id: "doces", titulo: "Doces", icone: "🍮", grupos: porCategoria(extra.doces || [], "doce") },
      ],
    };
  }

  window.EP_CATALOGO = { carregar };
})();
