// Calculadora dos garçons.
// Mesas 1 a 30: compartilhadas entre todos os garçons pelo servidor; cada item lançado fica
// registrado com quem lançou (o painel mostra o fluxo do dia). Calculadora rápida: só neste aparelho.
(function () {
  const { rpc, esc } = window.EP;
  const $ = (id) => document.getElementById(id);
  const TOTAL_MESAS = 30;
  const CHAVE_LOGIN = "ep_garcom_login";
  const CHAVE_RAPIDA = "ep_garcom_rapida";
  const ATUALIZAR_MS = 8000;
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  const lerLS = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch (e) { return padrao; } };
  const gravarLS = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let login = lerLS(CHAVE_LOGIN, null);          // { token, id, nome }
  let rapida = lerLS(CHAVE_RAPIDA, null) || novoPedido();
  let mesas = {};                                  // mesa -> pedido vindo do servidor
  let atual = null;                                // "rapida" | número da mesa | null
  // Sem banco de dados conectado, as mesas funcionam "neste aparelho" (sem login e sem Fluxo do dia).
  const CHAVE_LOCAL = "ep_garcom_mesas_local";
  let modoLocal = false;
  const salvarLocal = () => gravarLS(CHAVE_LOCAL, mesas);

  function novoPedido() { return { itens: [], servico: false, pessoas: 1 }; }
  const pedido = () => (atual === "rapida" ? rapida : mesas[atual] || { mesa: atual, ...novoPedido() });
  const subtotal = (p) => p.itens.reduce((a, i) => a + i.preco * i.qtd, 0);
  const totalPedido = (p) => subtotal(p) * (p.servico ? 1.1 : 1);
  const qtdItens = (p) => p.itens.reduce((a, i) => a + i.qtd, 0);

  let toastTimer;
  function toast(msg, erro) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("erro", !!erro);
    t.classList.add("ver");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("ver"), erro ? 3200 : 1600);
  }

  // Chamadas ao servidor em fila, para os toques rápidos chegarem na ordem certa.
  let fila = Promise.resolve();
  function chamar(fn, args) {
    const r = fila.then(() => rpc(fn, { p_token: login && login.token, ...args }));
    fila = r.catch(() => {});
    return r.catch((e) => {
      if (/Entre de novo|turno expirou|desativado/.test(e.message)) sair(e.message);
      else toast(e.message, true);
      throw e;
    });
  }

  // ---------- Telas ----------
  function mostrar(tela) {
    for (const t of ["login", "mesas", "pedido"]) $(`tela-${t}`).classList.toggle("escondido", t !== tela);
    document.body.classList.remove("ver-comanda");
    $("quem").classList.toggle("escondido", !login);
    if (login) $("quem-nome").textContent = login.nome;
  }
  function marcarModo(m) { document.querySelectorAll("[data-modo]").forEach((b) => b.classList.toggle("ativo", b.dataset.modo === m)); }

  function irMesas() {
    atual = null;
    marcarModo("mesas");
    if (!login && !modoLocal) return irLogin();
    $("titulo").textContent = "Mesas do salão";
    mostrar("mesas");
    renderMesas();
    atualizar();
  }

  document.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => (b.dataset.modo === "rapida" ? abrir("rapida") : irMesas())));
  $("btn-voltar").addEventListener("click", irMesas);

  // ---------- Login ----------
  let pinDe = null, pin = "";
  async function irLogin() {
    $("titulo").textContent = "Entrar";
    mostrar("login");
    $("pin-area").classList.add("escondido");
    try {
      const r = await rpc("garcom_lista");
      if (!r.conectado) {
        modoLocal = true;
        mesas = lerLS(CHAVE_LOCAL, {}) || {};
        $("aviso-local").classList.remove("escondido");
        return irMesas();
      }
      $("garcons-lista").innerHTML = r.garcons.length
          ? r.garcons.map((g) => `<button type="button" class="botao secundario" data-garcom="${g.id}">${esc(g.nome)}</button>`).join("")
          : '<p class="muted">Nenhum garçom cadastrado. O gerente cadastra no painel, aba Garçons.</p>';
    } catch (e) {
      $("garcons-lista").innerHTML = `<p class="erro-msg">${esc(e.message)}</p>`;
    }
  }

  $("garcons-lista").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-garcom]");
    if (!b) return;
    pinDe = { id: Number(b.dataset.garcom), nome: b.textContent };
    pin = "";
    $("pin-nome").textContent = pinDe.nome;
    $("erro-login").textContent = "";
    $("pin-area").classList.remove("escondido");
    renderPin();
  });

  const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Entrar"];
  $("pin-teclado").innerHTML = TECLAS.map((t) => `<button type="button" data-tecla="${t}" class="${t === "Entrar" ? "entrar" : ""}">${t}</button>`).join("");
  function renderPin() { $("pin-pontos").innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? "cheio" : ""}"></span>`).join(""); }

  $("pin-teclado").addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-tecla]");
    if (!t) return;
    const k = t.dataset.tecla;
    if (k === "⌫") pin = pin.slice(0, -1);
    else if (k !== "Entrar" && pin.length < 6) pin += k;
    renderPin();
    if (k !== "Entrar") return;
    if (pin.length < 4) return ($("erro-login").textContent = "Digite seu PIN (4 a 6 números).");
    t.disabled = true;
    $("erro-login").textContent = "";
    try {
      login = await rpc("garcom_entrar", { p_id: pinDe.id, p_pin: pin });
      gravarLS(CHAVE_LOGIN, login);
      toast(`Bom trabalho, ${login.nome}!`);
      irMesas();
    } catch (e) {
      $("erro-login").textContent = e.message;
      pin = "";
      renderPin();
    } finally {
      t.disabled = false;
    }
  });

  function sair(msg) {
    login = null;
    gravarLS(CHAVE_LOGIN, null);
    mesas = {};
    if (msg) toast(msg, true);
    irLogin();
  }
  $("btn-sair").addEventListener("click", () => sair());

  // ---------- Mapa das mesas ----------
  function renderMesas() {
    let html = "";
    for (let n = 1; n <= TOTAL_MESAS; n++) {
      const p = mesas[n];
      html += `<button type="button" class="mesa${p ? " aberta" : ""}${p && p.conta_pedida ? " conta" : ""}" data-mesa="${n}">
        <span class="mesa-num">${n}${p && p.conta_pedida ? " 📤" : ""}</span>
        <span class="mesa-info">${p ? `${brl(p.total)}<small>${qtdItens(p)} ${qtdItens(p) === 1 ? "item" : "itens"}${p.aberto_por ? ` · ${esc(p.aberto_por)}` : ""}</small>` : "livre"}</span>
      </button>`;
    }
    $("mesas").innerHTML = html;
  }
  $("mesas").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-mesa]");
    if (b) abrir(Number(b.dataset.mesa));
  });

  let ultimaSync = null;
  async function atualizar() {
    if (modoLocal) {
      $("sync").textContent = "Mesas salvas neste aparelho.";
      if (atual == null) renderMesas();
      return;
    }
    if (!login || document.hidden || atual === "rapida") return;
    try {
      const r = await chamar("garcom_mesas", {});
      mesas = Object.fromEntries(r.mesas.map((m) => [m.mesa, m]));
      ultimaSync = new Date();
      $("sync").textContent = `Atualizado às ${ultimaSync.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}. As mesas se atualizam sozinhas.`;
      if (atual == null) renderMesas();
      else { renderComanda(); renderCatalogo(); }
    } catch (e) {
      $("sync").textContent = "Sem conexão com o servidor. Tentando de novo…";
    }
  }
  setInterval(atualizar, ATUALIZAR_MS);
  document.addEventListener("visibilitychange", atualizar);

  // ---------- Pedido ----------
  function abrir(qual) {
    if (qual !== "rapida" && !login && !modoLocal) return irLogin();
    atual = qual;
    const nome = qual === "rapida" ? "Calculadora rápida" : `Mesa ${qual}`;
    $("titulo").textContent = nome;
    $("comanda-titulo").textContent = nome;
    $("btn-voltar").textContent = login || modoLocal ? "← Mesas" : "← Entrar";
    marcarModo(qual === "rapida" ? "rapida" : "mesas");
    mostrar("pedido");
    $("busca").value = "";
    renderCatalogo();
    renderComanda();
    window.scrollTo(0, 0);
  }

  // ---------- Catálogo (botões) ----------
  let partes = [];
  let parteAtiva = "lanches";
  const todosItens = () => partes.flatMap((p) => p.grupos.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.titulo, parte: p.id }))));

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
    if (!partes.length || atual == null) return;
    $("partes").innerHTML = partes.map((p) => `<button type="button" data-parte="${p.id}" class="${p.id === parteAtiva ? "ativa" : ""}">${p.icone} ${esc(p.titulo)}</button>`).join("");
    const busca = $("busca").value.trim().toLowerCase();
    if (busca) {
      const achados = todosItens().filter((i) => `${i.nome} ${i.sub || ""} ${i.grupo}`.toLowerCase().includes(busca));
      $("catalogo").innerHTML = achados.length ? `<div class="itens-grade">${achados.map(botaoItem).join("")}</div>` : '<p class="garcom-dica">Nada encontrado.</p>';
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

  // Soma (+1) ou tira (−1) um item do pedido atual.
  async function mudar(item, qtd) {
    if (atual === "rapida") {
      const ja = rapida.itens.find((x) => x.id === item.id);
      if (ja) ja.qtd += qtd;
      else if (qtd > 0) rapida.itens.push({ id: item.id, nome: item.nome, preco: item.preco, qtd: 1 });
      rapida.itens = rapida.itens.filter((x) => x.qtd > 0);
      gravarLS(CHAVE_RAPIDA, rapida);
    } else {
      // Mostra na hora e confirma com o servidor (que registra quem lançou).
      const mesa = atual;
      const p = mesas[mesa] || (mesas[mesa] = { mesa, ...novoPedido(), aberto_por: login ? login.nome : "", aberto_em: new Date().toISOString() });
      const ja = p.itens.find((x) => x.id === item.id);
      if (ja) ja.qtd += qtd; else if (qtd > 0) p.itens.push({ id: item.id, nome: item.nome, preco: item.preco, qtd: 1 });
      p.itens = p.itens.filter((x) => x.qtd > 0);
      p.subtotal = subtotal(p); p.total = totalPedido(p);
      if (modoLocal) {
        if (!p.itens.length) delete mesas[mesa];
        salvarLocal();
      } else try {
        const r = await chamar("garcom_lancar", { p_mesa: mesa, p_item: { id: item.id, nome: item.nome, preco: item.preco, parte: item.parte }, p_qtd: qtd });
        if (r) mesas[mesa] = r; else delete mesas[mesa];
      } catch (e) { atualizar(); }
    }
    if (qtd > 0) toast(`+1 ${item.nome}`);
    renderComanda();
    renderCatalogo();
  }

  $("catalogo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-item]");
    if (!b) return;
    const i = todosItens().find((x) => x.id === b.dataset.item);
    if (i) mudar(i, 1);
  });

  // ---------- Comanda ----------
  function renderComanda() {
    if (atual == null) return;
    const p = pedido();
    $("comanda-aberta").textContent = atual !== "rapida" && p.aberto_em ? `Aberta às ${hora(p.aberto_em)} por ${p.aberto_por || "?"}` : "";
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
    // Garçom envia o pedido; o caixa recebe e libera a mesa. Sem banco (modo local), o garçom fecha a conta.
    $("btn-fechar-mesa").textContent = atual === "rapida" ? "Nova conta" : modoLocal ? "Fechar conta"
      : p.conta_pedida ? "✓ Pedido enviado ao caixa" : "📤 Enviar pedido ao caixa";
  }

  $("comanda-lista").addEventListener("click", (ev) => {
    const mais = ev.target.closest("[data-mais]"), menos = ev.target.closest("[data-menos]");
    const b = mais || menos;
    if (!b) return;
    const i = pedido().itens[Number(b.dataset.mais ?? b.dataset.menos)];
    if (i) mudar(i, mais ? 1 : -1);
  });

  async function ajustar(campos) {
    const p = pedido();
    Object.assign(p, campos);
    if (atual === "rapida") gravarLS(CHAVE_RAPIDA, rapida);
    else if (modoLocal) { if (mesas[atual]) { mesas[atual].total = totalPedido(mesas[atual]); salvarLocal(); } }
    else if (mesas[atual]) {
      try { mesas[atual] = (await chamar("garcom_ajustar", { p_mesa: atual, p_servico: p.servico, p_pessoas: p.pessoas })) || mesas[atual]; } catch (e) {}
    }
    renderComanda();
  }
  $("servico").addEventListener("change", () => ajustar({ servico: $("servico").checked }));
  $("pessoas-mais").addEventListener("click", () => ajustar({ pessoas: Math.min(50, (pedido().pessoas || 1) + 1) }));
  $("pessoas-menos").addEventListener("click", () => ajustar({ pessoas: Math.max(1, (pedido().pessoas || 1) - 1) }));

  $("btn-limpar").addEventListener("click", async () => {
    const p = pedido();
    if (!p.itens.length || !confirm("Tirar todos os itens deste pedido?")) return;
    if (atual === "rapida") { rapida = novoPedido(); gravarLS(CHAVE_RAPIDA, rapida); }
    else for (const i of [...p.itens]) for (let k = 0; k < i.qtd; k++) await mudar(i, -1);
    renderComanda(); renderCatalogo();
    toast("Pedido limpo");
  });

  $("btn-fechar-mesa").addEventListener("click", async () => {
    const p = pedido();
    if (atual === "rapida") {
      if (p.itens.length && !confirm(`Fechar esta conta? Total ${brl(totalPedido(p))}.`)) return;
      rapida = novoPedido(); gravarLS(CHAVE_RAPIDA, rapida);
      renderComanda(); renderCatalogo();
      return toast("Conta fechada");
    }
    if (!p.itens.length) return irMesas();
    const mesa = atual;
    if (!modoLocal) {
      // Com o sistema completo, o garçom envia o pedido e o caixa recebe e libera a mesa.
      try {
        mesas[mesa] = (await chamar("garcom_pedir_conta", { p_mesa: mesa })) || mesas[mesa];
        toast(`Pedido da mesa ${mesa} enviado ao caixa: ${brl(totalPedido(p))}`);
        irMesas();
      } catch (e) {}
      return;
    }
    if (!confirm(`Fechar a mesa ${mesa}? Total ${brl(totalPedido(p))}.`)) return;
    if (modoLocal) {
      delete mesas[mesa];
      salvarLocal();
      toast(`Mesa ${mesa} fechada ✓`);
      return irMesas();
    }
  });

  // No celular a comanda abre por cima; no computador fica ao lado.
  $("barra-total").addEventListener("click", () => document.body.classList.add("ver-comanda"));
  $("btn-fechar-comanda").addEventListener("click", () => document.body.classList.remove("ver-comanda"));

  // ---------- Início ----------
  window.EP_CATALOGO.carregar().then((c) => {
    partes = c.partes;
    renderCatalogo();
  }).catch((e) => { $("catalogo").innerHTML = `<p class="garcom-dica">Não foi possível carregar o cardápio: ${esc(e.message)}</p>`; });
  irMesas();
})();
