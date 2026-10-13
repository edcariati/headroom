// Caixa: vê todas as mesas abertas, recebe (dinheiro com troco, Pix, débito, crédito) e fecha a conta.
// Mostra também o fechamento do dia por forma de pagamento.
(function () {
  const { rpc, esc } = window.EP;
  const $ = (id) => document.getElementById(id);
  const CHAVE_LOGIN = "ep_caixa_login";
  const ATUALIZAR_MS = 8000;
  const FORMAS = [["dinheiro", "💵 Dinheiro"], ["pix", "⚡ Pix"], ["debito", "💳 Débito"], ["credito", "💳 Crédito"]];
  const NOME_FORMA = Object.fromEntries(FORMAS);
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const gravarLS = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let login = lerLS(CHAVE_LOGIN);
  let dados = { mesas: [], resumo: null };
  let selecionada = null, forma = null;

  let toastTimer;
  function toast(msg, erro) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("erro", !!erro);
    t.classList.add("ver");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("ver"), erro ? 3200 : 2000);
  }

  async function chamar(fn, args) {
    try { return await rpc(fn, { p_token: login && login.token, ...args }); }
    catch (e) {
      if (/Entre de novo|turno expirou|desativado|não permite/.test(e.message)) sair(e.message);
      else toast(e.message, true);
      throw e;
    }
  }

  // ---------- Telas ----------
  function mostrar(tela) {
    for (const t of ["login", "contas", "fechamento"]) $(`tela-${t}`).classList.toggle("escondido", t !== tela);
    $("quem").classList.toggle("escondido", !login);
    $("modos").classList.toggle("escondido", !login);
    if (login) $("quem-nome").textContent = login.nome;
    document.querySelectorAll("[data-tela]").forEach((b) => b.classList.toggle("ativo", b.dataset.tela === tela));
  }
  document.querySelectorAll("[data-tela]").forEach((b) => b.addEventListener("click", () => {
    mostrar(b.dataset.tela);
    if (b.dataset.tela === "fechamento") renderFechamento();
  }));

  // ---------- Login (nome + senha numérica) ----------
  let pinDe = null, pin = "";
  async function irLogin() {
    mostrar("login");
    $("pin-area").classList.add("escondido");
    try {
      const r = await rpc("garcom_lista", { p_papel: "caixa" });
      $("usuarios-lista").innerHTML = !r.conectado
        ? '<p class="muted">O caixa precisa do banco de dados conectado. O gerente conecta o Supabase na Vercel (Storage → Supabase).</p>'
        : r.garcons.length
          ? r.garcons.map((g) => `<button type="button" class="botao secundario" data-usuario="${g.id}">${esc(g.nome)}</button>`).join("")
          : '<p class="muted">Nenhum usuário de caixa cadastrado. O gerente cadastra no painel, aba Equipe.</p>';
    } catch (e) { $("usuarios-lista").innerHTML = `<p class="erro-msg">${esc(e.message)}</p>`; }
  }
  $("usuarios-lista").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-usuario]");
    if (!b) return;
    pinDe = { id: Number(b.dataset.usuario), nome: b.textContent };
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
    if (pin.length < 4) return ($("erro-login").textContent = "Digite a senha (4 a 6 números).");
    t.disabled = true;
    try {
      const r = await rpc("garcom_entrar", { p_id: pinDe.id, p_pin: pin });
      if (r.papel === "garcom") throw new Error("Este acesso é de garçom. Use a página das mesas.");
      login = r;
      gravarLS(CHAVE_LOGIN, login);
      iniciar();
    } catch (e) {
      $("erro-login").textContent = e.message;
      pin = "";
      renderPin();
    } finally { t.disabled = false; }
  });
  function sair(msg) {
    login = null;
    gravarLS(CHAVE_LOGIN, null);
    if (msg) toast(msg, true);
    irLogin();
  }
  $("btn-sair").addEventListener("click", () => sair());

  // ---------- Contas abertas ----------
  async function atualizar() {
    if (!login || document.hidden) return;
    try {
      dados = await chamar("caixa_mesas", {});
      $("sync").textContent = `${dados.mesas.length} ${dados.mesas.length === 1 ? "mesa aberta" : "mesas abertas"} · atualizado às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
      renderMesas();
      if (selecionada != null) renderConta();
      if (!$("tela-fechamento").classList.contains("escondido")) renderFechamento();
    } catch (e) { $("sync").textContent = "Sem conexão com o servidor. Tentando de novo…"; }
  }

  function renderMesas() {
    const ms = dados.mesas.slice().sort((a, b) => (b.conta_pedida - a.conta_pedida) || a.mesa - b.mesa);
    $("caixa-mesas").innerHTML = ms.length ? ms.map((m) => `
      <button type="button" class="caixa-mesa${m.conta_pedida ? " conta" : ""}${m.mesa === selecionada ? " sel" : ""}" data-mesa="${m.mesa}">
        <span class="cm-num">Mesa ${m.mesa}</span>
        <span class="cm-total">${brl(m.total)}</span>
        <span class="cm-info">${m.itens.reduce((t, i) => t + i.qtd, 0)} itens · desde ${hora(m.aberto_em)} · ${esc(m.aberto_por || "")}</span>
        ${m.conta_pedida ? '<span class="cm-selo">🧾 Conta pedida</span>' : ""}
      </button>`).join("") : '<div class="cartao vazio">Nenhuma mesa aberta agora.</div>';
  }
  $("caixa-mesas").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-mesa]");
    if (!b) return;
    selecionada = Number(b.dataset.mesa);
    forma = null;
    renderMesas();
    renderConta();
    if (window.innerWidth < 900) $("conta").scrollIntoView({ behavior: "smooth" });
  });

  function renderConta() {
    const m = dados.mesas.find((x) => x.mesa === selecionada);
    if (!m) { selecionada = null; $("conta").innerHTML = '<p class="garcom-dica">Toque numa mesa para ver a conta e receber.</p>'; return; }
    const recebidoAntes = $("recebido") ? $("recebido").value : "";
    $("conta").innerHTML = `
      <div class="comanda-cab"><div><h2>Mesa ${m.mesa}</h2><p class="comanda-aberta">Aberta às ${hora(m.aberto_em)} por ${esc(m.aberto_por || "?")}${m.conta_pedida ? " · conta pedida" : ""}</p></div></div>
      <div class="caixa-itens">${m.itens.map((i) => `<div class="comanda-item"><div class="comanda-nome">${i.qtd}× ${esc(i.nome)}<small>${brl(i.preco)} cada</small></div><span></span><b class="comanda-valor">${brl(i.preco * i.qtd)}</b></div>`).join("")}</div>
      <div class="comanda-contas">
        <div class="conta-linha"><span>Subtotal</span><b>${brl(m.subtotal)}</b></div>
        <label class="conta-linha servico"><span><input type="checkbox" id="c-servico" ${m.servico ? "checked" : ""} /> Serviço 10%</span><b>${brl(m.servico ? m.subtotal * 0.1 : 0)}</b></label>
        <div class="conta-linha total"><span>Total</span><b>${brl(m.total)}</b></div>
        <div class="conta-linha dividir"><span>Dividir por</span>
          <span class="contador"><button type="button" id="c-menos" aria-label="Menos pessoas">−</button><b>${m.pessoas}</b><button type="button" id="c-mais" aria-label="Mais pessoas">+</button></span>
          <b>${brl(m.total / m.pessoas)} cada</b></div>
      </div>
      <p class="rotulo-desc" style="margin:14px 0 6px">Forma de pagamento</p>
      <div class="formas">${FORMAS.map(([f, n]) => `<button type="button" class="forma${forma === f ? " ativa" : ""}" data-forma="${f}">${n}</button>`).join("")}</div>
      <div id="troco-area" class="${forma === "dinheiro" ? "" : "escondido"}">
        <label class="conta-linha" style="margin-top:10px"><span>Valor recebido (R$)</span><input type="text" inputmode="decimal" id="recebido" placeholder="0,00" value="${esc(recebidoAntes)}" style="max-width:130px;margin:0" /></label>
        <div class="conta-linha"><span>Troco</span><b id="troco">—</b></div>
      </div>
      <button type="button" class="botao cheio" id="btn-receber" style="margin-top:14px" ${forma ? "" : "disabled"}>Receber e fechar a conta</button>`;
    calcTroco(m);
  }

  function calcTroco(m) {
    const r = $("recebido");
    if (!r) return;
    const v = Number(r.value.replace(",", "."));
    $("troco").textContent = r.value && isFinite(v) ? (v >= m.total ? brl(v - m.total) : "falta " + brl(m.total - v)) : "—";
  }

  $("conta").addEventListener("input", (ev) => { if (ev.target.id === "recebido") calcTroco(dados.mesas.find((x) => x.mesa === selecionada)); });
  $("conta").addEventListener("change", async (ev) => {
    if (ev.target.id !== "c-servico") return;
    const m = dados.mesas.find((x) => x.mesa === selecionada);
    await ajustar({ p_servico: ev.target.checked, p_pessoas: m.pessoas });
  });
  $("conta").addEventListener("click", async (ev) => {
    const m = dados.mesas.find((x) => x.mesa === selecionada);
    if (!m) return;
    const f = ev.target.closest("[data-forma]");
    if (f) { forma = f.dataset.forma; renderConta(); if (forma === "dinheiro") $("recebido").focus(); return; }
    if (ev.target.id === "c-mais") return ajustar({ p_servico: m.servico, p_pessoas: Math.min(50, m.pessoas + 1) });
    if (ev.target.id === "c-menos") return ajustar({ p_servico: m.servico, p_pessoas: Math.max(1, m.pessoas - 1) });
    if (ev.target.id === "btn-receber") {
      if (!forma) return;
      const recebido = forma === "dinheiro" ? $("recebido").value : null;
      if (!confirm(`Receber ${brl(m.total)} da mesa ${m.mesa} em ${NOME_FORMA[forma].slice(2).trim()}?`)) return;
      ev.target.disabled = true;
      try {
        const r = await chamar("caixa_fechar", { p_mesa: m.mesa, p_forma: forma, p_recebido: recebido });
        toast(`Mesa ${m.mesa} fechada ✓${r.troco ? ` · troco ${brl(r.troco)}` : ""}`);
        selecionada = null; forma = null;
        await atualizar();
        renderConta();
      } catch (e) { ev.target.disabled = false; }
    }
  });

  async function ajustar(args) {
    try {
      const m = await chamar("garcom_ajustar", { p_mesa: selecionada, ...args });
      if (m) dados.mesas = dados.mesas.map((x) => (x.mesa === m.mesa ? m : x));
      renderMesas(); renderConta();
    } catch (e) {}
  }

  // ---------- Fechamento do dia ----------
  function renderFechamento() {
    const r = dados.resumo;
    if (!r) return;
    $("fech-kpis").innerHTML = FORMAS.map(([f, n]) => `<div class="kpi"><div class="r">${n}</div><div class="v" style="font-size:24px">${brl(r.porForma[f])}</div></div>`).join("") +
      `<div class="kpi destaque-kpi"><div class="r">Total do dia</div><div class="v" style="font-size:24px">${brl(r.total)}</div><div class="muted">${r.contas.length} contas</div></div>`;
    $("fech-lista").innerHTML = r.contas.length ? `<table>
      <thead><tr><th>Hora</th><th class="num">Mesa</th><th>Pagamento</th><th class="num">Total</th><th class="num">Recebido</th><th class="num">Troco</th><th>Fechada por</th></tr></thead>
      <tbody>${r.contas.map((c) => `<tr><td>${hora(c.fechado_em)}</td><td class="num">${c.mesa}</td><td>${esc(NOME_FORMA[c.forma_pagamento] || "—")}</td><td class="num">${brl(c.total)}</td><td class="num">${c.valor_recebido != null ? brl(c.valor_recebido) : "—"}</td><td class="num">${c.troco != null ? brl(c.troco) : "—"}</td><td>${esc(c.fechado_por || "painel")}</td></tr>`).join("")}</tbody>
    </table>` : '<p class="muted">Nenhuma conta fechada hoje ainda.</p>';
  }
  $("btn-imprimir").addEventListener("click", () => window.print());

  // ---------- Início ----------
  function iniciar() {
    mostrar("contas");
    atualizar();
  }
  setInterval(atualizar, ATUALIZAR_MS);
  document.addEventListener("visibilitychange", atualizar);
  if (login) iniciar(); else irLogin();
})();
