(function () {
  const { rpc, OPCOES, NOTAS, num, esc, configurado, cfg } = window.EP;
  const TOTAL = cfg.TOTAL_LANCHES;
  const CHAVE_TOKEN = "ep_degustacao_token";
  const $ = (id) => document.getElementById(id);

  // Estrutura da ficha: [título, [perguntas]]; pergunta = ["opcao"|"nota"|"preco"|"texto", campo, enunciado]
  const SECOES = [
    ["Tempo de espera", [
      ["opcao", "espera", "Quanto tempo demorou?"],
      ["nota", "nota_espera", "Nota para o tempo de espera"],
    ]],
    ["Como chegou", [
      ["opcao", "chegou", "O lanche chegou…"],
      ["nota", "nota_temperatura", "Temperatura"],
      ["nota", "nota_aparencia", "Aparência"],
      ["nota", "nota_montagem", "Montagem"],
    ]],
    ["Sabor e ingredientes", [
      ["nota", "nota_sabor", "Sabor geral"],
      ["nota", "nota_carne", "Carne"],
      ["nota", "nota_pao", "Pão"],
      ["nota", "nota_molho", "Molho"],
      ["nota", "nota_ingredientes", "Ingredientes"],
    ]],
    ["Tamanho", [
      ["opcao", "tamanho_percepcao", "O tamanho é…"],
      ["nota", "nota_tamanho", "Nota para o tamanho"],
      ["nota", "nota_facilidade", "Facilidade de comer"],
    ]],
    ["Preço", [
      ["preco", "preco", "Quanto você pagaria por este lanche?"],
    ]],
    ["Voltaria?", [
      ["nota", "nota_pediria", "Pediria de novo"],
      ["nota", "nota_indicaria", "Indicaria para um amigo"],
    ]],
    ["Comentários", [
      ["texto", "gostou", "O que mais gostou? (opcional)"],
      ["texto", "mudaria", "O que mudaria? (opcional)"],
    ]],
  ];
  const OBRIGATORIOS = SECOES.flatMap((s) => s[1]).filter((p) => p[0] !== "texto").map((p) => p[1]);

  const estado = { token: null, nome: "", lanches: [], avaliacoes: {}, atual: null, ficha: {} };

  function tela(id) {
    ["tela-inicio", "tela-lista", "tela-ficha", "carregando"].forEach((t) => $(t).classList.toggle("escondido", t !== id));
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(msg, erro) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("erro", !!erro);
    t.classList.add("ver");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("ver"), 2800);
  }

  const lerToken = () => { try { return localStorage.getItem(CHAVE_TOKEN); } catch (e) { return null; } };
  const gravarToken = (t) => { try { t ? localStorage.setItem(CHAVE_TOKEN, t) : localStorage.removeItem(CHAVE_TOKEN); } catch (e) {} };

  // ---------- Início ----------
  async function iniciar() {
    if (!configurado()) {
      $("carregando").innerHTML = "⚙️ Site ainda não configurado.<br>Preencha <code>config.js</code> com os dados do Supabase.";
      return;
    }
    try {
      estado.lanches = await rpc("listar_lanches");
    } catch (e) {
      $("carregando").textContent = e.message;
      return;
    }
    const token = lerToken();
    if (token) {
      try {
        const me = await rpc("minhas_avaliacoes", { p_token: token });
        if (me) {
          estado.token = token;
          carregarMinhas(me);
          $("continuar-nome").textContent = me.nome;
          $("continuar").classList.remove("escondido");
          $("form-inicio").classList.add("escondido");
        } else gravarToken(null);
      } catch (e) { /* segue para o cadastro */ }
    }
    tela("tela-inicio");
  }

  function carregarMinhas(me) {
    estado.nome = me.nome;
    estado.avaliacoes = {};
    (me.avaliacoes || []).forEach((a) => (estado.avaliacoes[a.lanche_id] = a));
  }

  $("form-inicio").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nome = $("nome").value.trim();
    const idadeTxt = $("idade").value.trim();
    const idade = idadeTxt ? parseInt(idadeTxt, 10) : null;
    $("erro-inicio").textContent = "";
    if (!nome) { $("erro-inicio").textContent = "Digite seu nome para começar."; $("nome").focus(); return; }
    if (idade != null && (isNaN(idade) || idade < 1 || idade > 120)) { $("erro-inicio").textContent = "Idade inválida."; return; }
    const btn = $("btn-comecar");
    btn.disabled = true;
    try {
      const r = await rpc("registrar_avaliador", { p_nome: nome, p_idade: idade });
      estado.token = r.token;
      estado.nome = r.nome;
      estado.avaliacoes = {};
      gravarToken(r.token);
      mostrarLista();
    } catch (e) {
      $("erro-inicio").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("btn-continuar").addEventListener("click", mostrarLista);
  const trocar = () => {
    if (estado.token && !confirm("Sair e começar como outra pessoa? As avaliações já salvas continuam guardadas.")) return;
    gravarToken(null);
    Object.assign(estado, { token: null, nome: "", avaliacoes: {} });
    $("continuar").classList.add("escondido");
    $("form-inicio").classList.remove("escondido");
    $("nome").value = "";
    $("idade").value = "";
    tela("tela-inicio");
  };
  $("btn-trocar").addEventListener("click", trocar);
  $("btn-sair").addEventListener("click", trocar);

  // ---------- Lista ----------
  function nomeLanche(id) {
    const l = estado.lanches.find((x) => x.id === id);
    return l ? l.nome : "Lanche " + id;
  }

  function mostrarLista() {
    $("ola-nome").textContent = estado.nome;
    const feitos = Object.keys(estado.avaliacoes).length;
    $("progresso-txt").textContent = `${feitos} de ${TOTAL} avaliados`;
    $("progresso-barra").style.width = (100 * feitos) / TOTAL + "%";
    $("progresso-trilho").setAttribute("aria-valuenow", feitos);
    $("dica").textContent = feitos === TOTAL
      ? "🎉 Você avaliou todos os lanches! Muito obrigado. Toque em um lanche se quiser corrigir."
      : "Toque no número do lanche que você está provando. Já avaliou? Toque de novo para corrigir.";

    const grade = $("grade");
    grade.innerHTML = "";
    for (let i = 1; i <= TOTAL; i++) {
      const a = estado.avaliacoes[i];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lanche" + (a ? " feito" : "");
      b.innerHTML = `${a ? `<span class="selo">✓ ${num(a.nota_final)}</span>` : ""}<span class="n">${i}</span><span class="nm">${esc(nomeLanche(i))}</span>`;
      b.setAttribute("aria-label", `Lanche ${i}, ${nomeLanche(i)}${a ? ", avaliado com nota " + num(a.nota_final) : ", não avaliado"}`);
      b.addEventListener("click", () => abrirFicha(i));
      grade.appendChild(b);
    }
    tela("tela-lista");
  }

  // ---------- Ficha ----------
  function montarFicha() {
    const f = $("form-ficha");
    f.innerHTML = SECOES.map(([titulo, perguntas], si) => `
      <div class="cartao secao">
        <h3><span class="num">${si + 1}</span>${titulo}</h3>
        ${perguntas.map(([tipo, campo, enunciado]) => {
          let corpo = "";
          if (tipo === "nota") {
            corpo = `<div class="escala" data-campo="${campo}" role="radiogroup" aria-label="${esc(enunciado)}">
              ${Array.from({ length: 11 }, (_, n) => `<button type="button" data-valor="${n}" role="radio" aria-label="${n}">${n}</button>`).join("")}
            </div><div class="escala-legenda"><span>Péssimo</span><span>Excelente</span></div>`;
          } else if (tipo === "opcao") {
            corpo = `<div class="opcoes" data-campo="${campo}" role="radiogroup" aria-label="${esc(enunciado)}">
              ${OPCOES[campo].map(([v, r]) => `<button type="button" data-valor="${v}" role="radio">${r}</button>`).join("")}
            </div>`;
          } else if (tipo === "preco") {
            corpo = `<div class="preco"><span>R$</span><input type="text" inputmode="decimal" data-campo="preco" placeholder="0,00" autocomplete="off" /></div>`;
          } else {
            corpo = `<textarea data-campo="${campo}" maxlength="1000"></textarea>`;
          }
          const valor = tipo === "nota" ? `<span class="valor" data-valor-de="${campo}"></span>` : "";
          return `<div class="pergunta" data-pergunta="${campo}"><div class="enunciado"><span>${enunciado}${tipo === "texto" ? "" : " *"}</span>${valor}</div>${corpo}</div>`;
        }).join("")}
      </div>`).join("");

    f.querySelectorAll(".escala, .opcoes").forEach((grupo) => {
      grupo.addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (!b) return;
        const campo = grupo.dataset.campo;
        const v = grupo.classList.contains("escala") ? Number(b.dataset.valor) : b.dataset.valor;
        estado.ficha[campo] = v;
        pintarGrupo(grupo, v);
        grupo.closest(".pergunta").classList.remove("falta");
        atualizarNota();
      });
    });
    f.querySelector('[data-campo="preco"]').addEventListener("input", (ev) => {
      estado.ficha.preco = ev.target.value;
      ev.target.closest(".pergunta").classList.remove("falta");
    });
    f.querySelectorAll("textarea").forEach((t) => t.addEventListener("input", () => (estado.ficha[t.dataset.campo] = t.value)));
  }

  function pintarGrupo(grupo, v) {
    grupo.querySelectorAll("button").forEach((b) => {
      const sel = String(b.dataset.valor) === String(v);
      b.classList.toggle("sel", sel);
      b.setAttribute("aria-checked", sel);
    });
    const alvo = document.querySelector(`[data-valor-de="${grupo.dataset.campo}"]`);
    if (alvo) alvo.textContent = v == null ? "" : v;
  }

  function atualizarNota() {
    const notas = NOTAS.map(([c]) => estado.ficha[c]).filter((v) => typeof v === "number");
    $("nota-cont").textContent = `${notas.length} de ${NOTAS.length} notas`;
    $("nota-final").textContent = notas.length ? num(notas.reduce((a, b) => a + b, 0) / notas.length) : "–";
  }

  function abrirFicha(id) {
    estado.atual = id;
    const existente = estado.avaliacoes[id];
    estado.ficha = {};
    if (existente) {
      OBRIGATORIOS.concat(["gostou", "mudaria"]).forEach((c) => (estado.ficha[c] = existente[c]));
      estado.ficha.preco = existente.preco != null ? Number(existente.preco).toFixed(2).replace(".", ",") : "";
    }
    $("ficha-titulo").innerHTML = `Lanche ${id}<small>${esc(nomeLanche(id))}${existente ? " · corrigindo avaliação" : ""}</small>`;
    const f = $("form-ficha");
    f.querySelectorAll(".pergunta").forEach((p) => p.classList.remove("falta"));
    f.querySelectorAll(".escala, .opcoes").forEach((g) => pintarGrupo(g, estado.ficha[g.dataset.campo]));
    f.querySelector('[data-campo="preco"]').value = estado.ficha.preco || "";
    f.querySelectorAll("textarea").forEach((t) => (t.value = estado.ficha[t.dataset.campo] || ""));
    $("btn-salvar").textContent = existente ? "Salvar correção" : "Salvar avaliação";
    atualizarNota();
    tela("tela-ficha");
  }

  function lerPreco(txt) {
    if (txt == null) return NaN;
    let s = String(txt).replace(/[R$\s]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return s === "" ? NaN : Number(s);
  }

  $("btn-salvar").addEventListener("click", async () => {
    const faltando = [];
    OBRIGATORIOS.forEach((c) => {
      const v = estado.ficha[c];
      const ok = c === "preco" ? !isNaN(lerPreco(v)) && lerPreco(v) >= 0 : v != null && v !== "";
      document.querySelector(`[data-pergunta="${c}"]`).classList.toggle("falta", !ok);
      if (!ok) faltando.push(c);
    });
    if (faltando.length) {
      toast(`Faltam ${faltando.length} ${faltando.length === 1 ? "resposta" : "respostas"} (marcadas em vermelho)`, true);
      document.querySelector(`[data-pergunta="${faltando[0]}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const dados = { ...estado.ficha, preco: lerPreco(estado.ficha.preco) };
    const btn = $("btn-salvar");
    btn.disabled = true;
    try {
      await rpc("salvar_avaliacao", { p_token: estado.token, p_lanche: estado.atual, p_dados: dados });
      const me = await rpc("minhas_avaliacoes", { p_token: estado.token });
      carregarMinhas(me);
      toast(`Lanche ${estado.atual} salvo! ✓`);
      mostrarLista();
    } catch (e) {
      toast("Não foi possível salvar: " + e.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  $("btn-voltar").addEventListener("click", () => {
    const mexeu = Object.keys(estado.ficha).length && !estado.avaliacoes[estado.atual];
    if (mexeu && !confirm("Sair sem salvar esta ficha?")) return;
    mostrarLista();
  });

  montarFicha();
  iniciar();
})();
