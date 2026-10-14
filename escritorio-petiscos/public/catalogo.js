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

  // Até 3 tentativas (rede do salão pode oscilar) antes de usar a reserva.
  const tentar = (fn, n = 3) => fn().catch((e) => (n > 1 ? new Promise((r) => setTimeout(r, 800)).then(() => tentar(fn, n - 1)) : Promise.reject(e)));

  async function carregar() {
    const { rpc } = window.EP;
    const [lanches, extra] = await Promise.all([
      // Se a API falhar, usa a reserva do cardapio-dados.js: o garçom nunca fica sem cardápio.
      tentar(() => rpc("listar_lanches")).catch(() => C.lanches.map(([id, nome, codinome, descricao, preco]) => ({ id, nome, codinome, descricao, preco }))),
      tentar(() => rpc("listar_cardapio_extra")).catch(() => ({})),
    ]);
    const extras = leve("Extras");
    // Sem resposta da API (ou lista vazia), usa a lista de valores guardada no site.
    const reserva = (lista) => lista.map(([categoria, nome, preco, descricao = ""]) => ({ categoria, nome, preco, descricao }));
    const bebidas = extra.bebidas && extra.bebidas.length ? extra.bebidas : reserva(C.extrasIniciais.bebidas);
    const doces = extra.doces && extra.doces.length ? extra.doces : reserva(C.extrasIniciais.doces);
    const ehCafe = (b) => slug(b.categoria || "") === "cafes";
    // Um grupo "Cafés" só: os fixos da casa (Café normal) + os editados no painel, sem repetir nome.
    const cafes = () => {
      const fixos = leve("Cafés");
      const doPainel = porCategoria(bebidas.filter(ehCafe), "bebida").flatMap((g) => g.itens);
      const itens = fixos.itens.map(([n, v, d]) => item(n, v, { desc: d }));
      // Os cafés coado e com leite já vêm do cardápio oficial; não repetir os antigos do painel.
      const jaTem = new Set(["cafe-coado", "cafe-normal", "cafe-com-leite", ...itens.map((x) => slug(x.nome))]);
      for (const i of doPainel) if (!jaTem.has(slug(i.nome))) itens.push(i);
      return { titulo: "Cafés", sub: fixos.sub, itens };
    };
    return {
      lanches,
      partes: [
        // Café e Bom Dia: tudo de café da manhã fica só aqui (não se repete nas outras partes).
        {
          id: "cafe", titulo: "Café e Bom Dia", icone: "☕",
          grupos: [
            cafes(),
            ...["Pães especiais", "Omeletes", "Lanches naturais"].map((t) => ({ titulo: t, sub: leve(t).sub, itens: leve(t).itens.map(([n, v, d]) => item(n, v, { desc: d })) })),
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
        { id: "doces", titulo: "Doces", icone: "🍮", grupos: porCategoria(doces, "doce") },
      ],
    };
  }

  window.EP_CATALOGO = { carregar };
})();
