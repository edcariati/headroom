// Calculadora dos garçons: mesas 1 a 30 e calculadora rápida.
// Os pedidos ficam salvos neste aparelho (localStorage); nada vai para o servidor.
(function () {
  const { esc } = window.EP;
  const $ = (id) => document.getElementById(id);
  const TOTAL_MESAS = 30;
  const CHAVE = "ep_garcom_v1";
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ---------- Estado salvo ----------
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } };
  let estado = ler();
  estado.mesas = estado.mesas || {};
  const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {} };
  const novoPedido = () => ({ itens: [], servico: false, pessoas: 1, aberta_em: new Date().toISOString() });

  let atual = null; // "rapida" ou número da mesa
  const pedido = () => (atual === "rapida" ? (estado.rapida ||= novoPedido()) : (estado.mesas[atual] ||= novoPedido()));
  const subtotal = (p) => p.itens.reduce((a, i) => a + i.preco * i.qtd, 0);
  const totalPedido = (p) => subtotal(p) * (p.servico ? 1.1 : 1);
  const qtdItens = (p) => p.itens.reduce((a, i) => a + i.qtd, 0);
  const aberta = (n) => estado.mesas[n] && estado.mesas[n].itens.length > 0;

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("ver");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("ver"), 1600);
  }

  // ---------- Mapa das mesas ----------
  function renderMesas() {
    let html = "";
    for (let n = 1; n <= TOTAL_MESAS; n++) {
      const p = estado.mesas[n];
      const ab = aberta(n);
      html += `<button type="button" class="mesa${ab ? " aberta" : ""}" data-mesa="${n}">
        <span class="mesa-num">${n}</span>
        <span class="mesa-info">${ab ? `${brl(totalPedido(p))}<small>${qtdItens(p)} ${qtdItens(p) === 1 ? "item" : "itens"}</small>` : "livre"}</span>
      </button>`;
    }
    $("mesas").innerHTML = html;
  }

  $("mesas").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-mesa]");
    if (b) abrir(Number(b.dataset.mesa));
  });

  // ---------- Troca de tela ----------
  function mostrarMesas() {
    atual = null;
    $("tela-pedido").classList.add("escondido");
    $("tela-mesas").classList.remove("escondido");
    $("titulo").textContent = "Mesas do salão";
    marcarModo("mesas");
    renderMesas();
  }

  function abrir(qual) {
    atual = qual;
    $("tela-mesas").classList.add("escondido");
    $("tela-pedido").classList.remove("escondido");
    const nome = qual === "rapida" ? "Calculadora rápida" : `Mesa ${qual}`;
    $("titulo").textContent = nome;
    $("comanda-titulo").textContent = nome;
    $("btn-voltar").textContent = qual === "rapida" ? "← Mesas" : "← Todas as mesas";
    $("btn-fechar-mesa").textContent = qual === "rapida" ? "Nova conta" : "Fechar conta";
    marcarModo(qual === "rapida" ? "rapida" : "mesas");
    $("busca").value = "";
    renderCatalogo();
    renderComanda();
    window.scrollTo(0, 0);
  }

  function marcarModo(m) {
    document.querySelectorAll("[data-modo]").forEach((b) => b.classList.toggle("ativo", b.dataset.modo === m));
  }
  document.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.modo === "rapida") abrir("rapida"); else mostrarMesas();
  }));
  $("btn-voltar").addEventListener("click", mostrarMesas);

  // ---------- Catálogo (botões) ----------
  let partes = [];
  let parteAtiva = "lanches";
  const todosItens = () => partes.flatMap((p) => p.grupos.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.titulo }))));

  function botaoItem(i) {
    const q = (pedido().itens.find((x) => x.id === i.id) || {}).qtd || 0;
    if (i.preco == null) return `<button type="button" class="item-btn sem-preco" disabled><span class="item-nome">${esc(i.nome)}</span><span class="item-preco">sem preço</span></button>`;
    return `<button type="button" class="item-btn${q ? " no-pedido" : ""}" data-item="${esc(i.id)}">
      ${q ? `<span class="item-qtd">${q}</span>` : ""}
      <span class="item-nome">${esc(i.nome)}</span>${i.sub ? `<span class="item-sub">${esc(i.sub)}</span>` : ""}
      <span class="item-preco">${brl(i.preco)}</span>
    </button>`;
  }

  function renderCatalogo() {
    if (!partes.length) return;
    $("partes").innerHTML = partes.map((p) => `<button type="button" data-parte="${p.id}" class="${p.id === parteAtiva ? "ativa" : ""}">${p.icone} ${esc(p.titulo)}</button>`).join("");
    const busca = $("busca").value.trim().toLowerCase();
    if (busca) {
      const achados = todosItens().filter((i) => `${i.nome} ${i.sub || ""} ${i.grupo}`.toLowerCase().includes(busca));
      $("catalogo").innerHTML = achados.length
        ? `<div class="itens-grade">${achados.map(botaoItem).join("")}</div>`
        : '<p class="garcom-dica">Nada encontrado.</p>';
      return;
    }
    const parte = partes.find((p) => p.id === parteAtiva);
    $("catalogo").innerHTML = parte.grupos.length
      ? parte.grupos.map((g) => `<h3 class="grupo-titulo">${esc(g.titulo)}</h3><div class="itens-grade">${g.itens.map(botaoItem).join("")}</div>`).join("")
      : `<p class="garcom-dica">Ainda não há ${esc(parte.titulo.toLowerCase())} cadastrados. O dono cadastra no painel, aba Cardápio.</p>`;
  }

  $("partes").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-parte]");
    if (!b) return;
    parteAtiva = b.dataset.parte;
    $("busca").value = "";
    renderCatalogo();
  });
  $("busca").addEventListener("input", renderCatalogo);

  $("catalogo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-item]");
    if (!b) return;
    const i = todosItens().find((x) => x.id === b.dataset.item);
    if (!i) return;
    const p = pedido();
    const ja = p.itens.find((x) => x.id === i.id);
    if (ja) ja.qtd++;
    else p.itens.push({ id: i.id, nome: i.nome, preco: i.preco, qtd: 1 });
    gravar();
    renderCatalogo();
    renderComanda();
    toast(`+1 ${i.nome}`);
  });

  // ---------- Comanda ----------
  function renderComanda() {
    const p = pedido();
    $("comanda-lista").innerHTML = p.itens.length
      ? p.itens.map((i, k) => `<div class="comanda-item">
          <div class="comanda-nome">${esc(i.nome)}<small>${brl(i.preco)} cada</small></div>
          <span class="contador"><button type="button" data-menos="${k}" aria-label="Tirar um">−</button><b>${i.qtd}</b><button type="button" data-mais="${k}" aria-label="Mais um">+</button></span>
          <b class="comanda-valor">${brl(i.preco * i.qtd)}</b>
        </div>`).join("")
      : '<p class="garcom-dica">Nenhum item ainda. Toque nos botões do cardápio para somar.</p>';
    const sub = subtotal(p), tot = totalPedido(p);
    $("subtotal").textContent = brl(sub);
    $("servico").checked = !!p.servico;
    $("valor-servico").textContent = brl(p.servico ? sub * 0.1 : 0);
    $("total").textContent = brl(tot);
    $("pessoas").textContent = p.pessoas || 1;
    $("por-pessoa").textContent = `${brl(tot / (p.pessoas || 1))} cada`;
    const q = qtdItens(p);
    $("barra-qtd").textContent = `${q} ${q === 1 ? "item" : "itens"}`;
    $("barra-valor").textContent = brl(tot);
  }

  $("comanda-lista").addEventListener("click", (ev) => {
    const p = pedido();
    const mais = ev.target.closest("[data-mais]"), menos = ev.target.closest("[data-menos]");
    if (mais) p.itens[Number(mais.dataset.mais)].qtd++;
    else if (menos) {
      const k = Number(menos.dataset.menos);
      if (--p.itens[k].qtd <= 0) p.itens.splice(k, 1);
    } else return;
    gravar();
    renderComanda();
    renderCatalogo();
  });

  $("servico").addEventListener("change", () => { pedido().servico = $("servico").checked; gravar(); renderComanda(); });
  $("pessoas-mais").addEventListener("click", () => { const p = pedido(); p.pessoas = Math.min(50, (p.pessoas || 1) + 1); gravar(); renderComanda(); });
  $("pessoas-menos").addEventListener("click", () => { const p = pedido(); p.pessoas = Math.max(1, (p.pessoas || 1) - 1); gravar(); renderComanda(); });

  function zerar(msg) {
    if (atual === "rapida") estado.rapida = novoPedido();
    else delete estado.mesas[atual];
    gravar();
    renderComanda();
    renderCatalogo();
    toast(msg);
  }
  $("btn-limpar").addEventListener("click", () => {
    if (!pedido().itens.length) return;
    if (confirm("Apagar todos os itens deste pedido?")) zerar("Pedido limpo");
  });
  $("btn-fechar-mesa").addEventListener("click", () => {
    const p = pedido();
    if (!p.itens.length) return atual === "rapida" ? null : mostrarMesas();
    const nome = atual === "rapida" ? "esta conta" : `a mesa ${atual}`;
    if (!confirm(`Fechar ${nome}? Total ${brl(totalPedido(p))}. Os itens serão apagados.`)) return;
    const mesa = atual;
    zerar(atual === "rapida" ? "Conta fechada" : `Mesa ${mesa} fechada`);
    if (mesa !== "rapida") mostrarMesas();
  });

  // No celular a comanda abre por cima; no computador fica ao lado.
  $("barra-total").addEventListener("click", () => document.body.classList.add("ver-comanda"));
  $("btn-fechar-comanda").addEventListener("click", () => document.body.classList.remove("ver-comanda"));

  // ---------- Início ----------
  renderMesas();
  window.EP_CATALOGO.carregar().then((c) => {
    partes = c.partes;
    if (atual != null) renderCatalogo();
  }).catch((e) => { $("catalogo").innerHTML = `<p class="garcom-dica">Não foi possível carregar o cardápio: ${esc(e.message)}</p>`; });
})();
