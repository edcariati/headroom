(function () {
  const { rpc, OPCOES, NOTAS, rotulo, num, reais, esc, configurado, cfg } = window.EP;
  const TOTAL = cfg.TOTAL_LANCHES;
  const $ = (id) => document.getElementById(id);
  const CHAVE_SENHA = "ep_painel_senha";

  // Paleta validada (contraste e daltonismo) sobre o fundo claro dos cartões.
  const CORES = ["#C2410C", "#B7862A", "#2F6FA3"];
  const FUNDO = "#fffaf2";
  const TINTA = "#6b4a33";

  let senha = null;
  let dados = null; // { lanches, avaliadores, avaliacoes }
  const graficos = {};

  if (window.Chart) {
    Chart.defaults.font.family = '"Roboto Slab", Georgia, serif';
    Chart.defaults.color = TINTA;
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

  const media = (arr) => (arr.length ? arr.reduce((a, b) => a + Number(b), 0) / arr.length : null);
  const nomeLanche = (id) => (dados.lanches.find((l) => l.id === id) || {}).nome || "Lanche " + id;
  const nomeAvaliador = (id) => (dados.avaliadores.find((a) => a.id === id) || {}).nome || "?";

  // ---------- Login ----------
  async function carregar(s) {
    dados = await rpc("admin_dados", { p_senha: s });
    senha = s;
    try { sessionStorage.setItem(CHAVE_SENHA, s); } catch (e) {}
  }

  $("login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = $("btn-entrar");
    btn.disabled = true;
    $("erro-login").textContent = "";
    try {
      await carregar($("senha").value);
      abrirApp();
    } catch (e) {
      $("erro-login").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });

  function abrirApp() {
    $("login").classList.add("escondido");
    $("app").classList.remove("escondido");
    renderTudo();
  }

  $("btn-atualizar").addEventListener("click", async () => {
    try {
      await carregar(senha);
      renderTudo();
      toast("Dados atualizados");
    } catch (e) { toast(e.message, true); }
  });

  // ---------- Abas ----------
  $("abas").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-aba]");
    if (!b) return;
    document.querySelectorAll("#abas button[data-aba]").forEach((x) => x.classList.toggle("ativa", x === b));
    document.querySelectorAll("[data-painel]").forEach((p) => p.classList.toggle("escondido", p.dataset.painel !== b.dataset.aba));
    if (b.dataset.aba === "lanches") renderLanche();
  });

  function renderTudo() {
    renderResumo();
    renderSelect();
    renderLanche();
    renderAvaliadores();
    renderNomes();
    renderLink();
  }

  // ---------- Gráficos ----------
  function kpis(el, itens) {
    $(el).innerHTML = itens.map(([r, v, extra]) => `<div class="kpi"><div class="r">${r}</div><div class="v">${v}${extra ? ` <small>${extra}</small>` : ""}</div></div>`).join("");
  }

  function pizza(canvasId, campo, avaliacoes) {
    if (graficos[canvasId]) graficos[canvasId].destroy();
    const canvas = $(canvasId);
    const box = canvas.parentElement;
    box.querySelector(".vazio")?.remove();
    const cont = OPCOES[campo].map(([v]) => avaliacoes.filter((a) => a[campo] === v).length);
    const total = cont.reduce((a, b) => a + b, 0);
    canvas.classList.toggle("escondido", !total);
    if (!total || !window.Chart) {
      box.insertAdjacentHTML("beforeend", `<p class="vazio">${total ? "Gráfico indisponível (sem internet?)" : "Sem avaliações ainda."}</p>`);
      return;
    }
    graficos[canvasId] = new Chart(canvas, {
      type: "pie",
      data: {
        labels: OPCOES[campo].map(([, r], i) => `${r}: ${cont[i]} (${Math.round((100 * cont[i]) / total)}%)`),
        datasets: [{ data: cont, backgroundColor: CORES, borderColor: FUNDO, borderWidth: 2, hoverOffset: 6 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 14, padding: 12, font: { size: 13 } } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}` } },
        },
      },
    });
  }

  function statsLanche(id) {
    const av = dados.avaliacoes.filter((a) => a.lanche_id === id);
    return {
      id,
      av,
      n: av.length,
      nota: media(av.map((a) => a.nota_final)),
      preco: media(av.map((a) => a.preco)),
    };
  }

  function renderResumo() {
    const av = dados.avaliacoes;
    const comAval = new Set(av.map((a) => a.avaliador_id)).size;
    kpis("kpis", [
      ["Avaliações", av.length],
      ["Avaliadores", dados.avaliadores.length, comAval !== dados.avaliadores.length ? `(${comAval} já avaliaram)` : ""],
      ["Média geral", num(media(av.map((a) => a.nota_final))), "/ 10"],
      ["Preço médio", reais(media(av.map((a) => a.preco)))],
    ]);

    const stats = Array.from({ length: TOTAL }, (_, i) => statsLanche(i + 1));
    const ranking = stats.filter((s) => s.n).sort((a, b) => b.nota - a.nota);
    const semAval = stats.filter((s) => !s.n).map((s) => s.id);

    if (graficos.ranking) graficos.ranking.destroy();
    const box = $("ranking-box");
    box.querySelector(".vazio")?.remove();
    box.style.height = Math.max(ranking.length, 1) * 30 + 50 + "px";
    const estreito = window.innerWidth < 600;
    const curto = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
    if (ranking.length && window.Chart) {
      graficos.ranking = new Chart($("g-ranking"), {
        type: "bar",
        data: {
          labels: ranking.map((s, i) => estreito ? `${i + 1}º ${curto(nomeLanche(s.id), 13)} ${num(s.nota)}` : `${i + 1}º · ${s.id}. ${nomeLanche(s.id)}  (${num(s.nota)})`),
          datasets: [{ data: ranking.map((s) => s.nota), backgroundColor: CORES[0], borderRadius: 4, borderSkipped: "start", barPercentage: 0.72, categoryPercentage: 1 }],
        },
        options: {
          indexAxis: "y",
          maintainAspectRatio: false,
          scales: {
            x: { min: 0, max: 10, ticks: { stepSize: estreito ? 2 : 1, maxRotation: 0 }, grid: { color: "#efe2cf" } },
            y: { grid: { display: false }, ticks: { font: { size: estreito ? 12 : 13 }, color: "#2b1a10", autoSkip: false } },
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => { const s = ranking[c.dataIndex]; return ` Nota ${num(s.nota, 2)} · ${s.n} avaliação(ões) · pagariam ${reais(s.preco)}`; } } },
          },
          onClick: (_, els) => { if (els.length) irParaLanche(ranking[els[0].index].id); },
        },
      });
    }
    if (!ranking.length || !window.Chart) box.insertAdjacentHTML("beforeend", `<p class="vazio">${ranking.length ? "Gráfico indisponível (sem internet?)" : "Sem avaliações ainda."}</p>`);
    $("sem-aval").textContent = semAval.length && ranking.length ? `Ainda sem avaliação: ${semAval.map((id) => id + ". " + nomeLanche(id)).join(" · ")}` : "";

    pizza("g-chegou", "chegou", av);
    pizza("g-espera", "espera", av);
    pizza("g-tamanho", "tamanho_percepcao", av);
  }

  // ---------- Por lanche ----------
  function renderSelect() {
    const sel = $("sel-lanche");
    const atual = sel.value || "1";
    sel.innerHTML = Array.from({ length: TOTAL }, (_, i) => {
      const s = statsLanche(i + 1);
      return `<option value="${i + 1}">${i + 1}. ${esc(nomeLanche(i + 1))} — ${s.n ? num(s.nota) + " (" + s.n + " aval.)" : "sem avaliações"}</option>`;
    }).join("");
    sel.value = atual;
  }
  $("sel-lanche").addEventListener("change", renderLanche);

  function irParaLanche(id) {
    $("sel-lanche").value = String(id);
    document.querySelector('#abas button[data-aba="lanches"]').click();
  }

  function renderLanche() {
    if (!dados) return;
    const s = statsLanche(Number($("sel-lanche").value || 1));
    const precos = s.av.map((a) => Number(a.preco));
    kpis("kpis-lanche", [
      ["Avaliações", s.n],
      ["Nota final média", num(s.nota), "/ 10"],
      ["Pagariam, em média", reais(s.preco)],
      ["Faixa de preço", precos.length ? `${reais(Math.min(...precos))}` : "–", precos.length ? `a ${reais(Math.max(...precos))}` : ""],
    ]);
    $("criterios").innerHTML = s.n
      ? NOTAS.map(([c, r]) => {
          const m = media(s.av.map((a) => a[c]));
          return `<div class="criterio"><span>${r}</span><div class="trilho"><div style="width:${m * 10}%"></div></div><span class="v">${num(m)}</span></div>`;
        }).join("")
      : '<p class="vazio">Sem avaliações ainda.</p>';

    const coms = s.av.filter((a) => a.gostou || a.mudaria);
    $("comentarios").innerHTML = coms.length
      ? coms.map((a) => `<div class="comentario"><div class="quem">${esc(nomeAvaliador(a.avaliador_id))} · nota ${num(a.nota_final)}</div>
          ${a.gostou ? `<p><span class="tag">Gostou:</span> ${esc(a.gostou)}</p>` : ""}
          ${a.mudaria ? `<p><span class="tag">Mudaria:</span> ${esc(a.mudaria)}</p>` : ""}</div>`).join("")
      : '<p class="vazio">Nenhum comentário.</p>';

    pizza("gl-chegou", "chegou", s.av);
    pizza("gl-espera", "espera", s.av);
    pizza("gl-tamanho", "tamanho_percepcao", s.av);
  }

  // ---------- Avaliadores ----------
  function renderAvaliadores() {
    const linhas = dados.avaliadores
      .map((p) => {
        const av = dados.avaliacoes.filter((a) => a.avaliador_id === p.id);
        return { ...p, n: av.length, media: media(av.map((a) => a.nota_final)) };
      })
      .sort((a, b) => b.n - a.n || new Date(a.criado_em) - new Date(b.criado_em));
    $("tab-avaliadores").innerHTML = `
      <thead><tr><th>Nome</th><th class="num">Idade</th><th>Início</th><th class="num">Avaliados</th><th class="num">Média dada</th><th></th></tr></thead>
      <tbody>${linhas.length ? linhas.map((p) => `<tr>
        <td>${esc(p.nome)}</td>
        <td class="num">${p.idade ?? "–"}</td>
        <td>${new Date(p.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
        <td class="num">${p.n} / ${TOTAL}</td>
        <td class="num">${num(p.media)}</td>
        <td class="num"><button class="link" data-excluir="${p.id}" style="color:var(--erro)">excluir</button></td>
      </tr>`).join("") : '<tr><td colspan="6" class="vazio">Ninguém ainda.</td></tr>'}</tbody>`;
  }

  $("tab-avaliadores").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-excluir]");
    if (!b) return;
    const nome = nomeAvaliador(b.dataset.excluir);
    if (!confirm(`Excluir ${nome} e todas as avaliações dessa pessoa? Não dá para desfazer.`)) return;
    try {
      await rpc("admin_excluir_avaliador", { p_senha: senha, p_id: b.dataset.excluir });
      await carregar(senha);
      renderTudo();
      toast(`${nome} excluído`);
    } catch (e) { toast(e.message, true); }
  });

  // ---------- Exportação ----------
  function linhasAvaliacoes() {
    return dados.avaliacoes
      .slice()
      .sort((a, b) => nomeAvaliador(a.avaliador_id).localeCompare(nomeAvaliador(b.avaliador_id)) || a.lanche_id - b.lanche_id)
      .map((a) => {
        const p = dados.avaliadores.find((x) => x.id === a.avaliador_id) || {};
        const r = {
          "Avaliador": p.nome,
          "Idade": p.idade ?? "",
          "Nº lanche": a.lanche_id,
          "Lanche": nomeLanche(a.lanche_id),
          "Tempo de espera": rotulo("espera", a.espera),
          "Chegou": rotulo("chegou", a.chegou),
          "Percepção de tamanho": rotulo("tamanho_percepcao", a.tamanho_percepcao),
        };
        NOTAS.forEach(([c, rot]) => (r["Nota " + rot.toLowerCase()] = Number(a[c])));
        r["Pagaria (R$)"] = Number(a.preco);
        r["Nota final"] = Number(a.nota_final);
        r["O que mais gostou"] = a.gostou || "";
        r["O que mudaria"] = a.mudaria || "";
        r["Data"] = new Date(a.atualizado_em).toLocaleString("pt-BR");
        return r;
      });
  }

  function linhasResumo() {
    return Array.from({ length: TOTAL }, (_, i) => {
      const s = statsLanche(i + 1);
      const r = { "Nº": s.id, "Lanche": nomeLanche(s.id), "Avaliações": s.n, "Nota final média": s.nota == null ? "" : +s.nota.toFixed(2), "Preço médio (R$)": s.preco == null ? "" : +s.preco.toFixed(2) };
      NOTAS.forEach(([c, rot]) => { const m = media(s.av.map((a) => a[c])); r[rot] = m == null ? "" : +m.toFixed(2); });
      OPCOES.chegou.concat(OPCOES.espera, OPCOES.tamanho_percepcao).forEach(([v, rot]) => {
        const campo = Object.keys(OPCOES).find((k) => OPCOES[k].some((o) => o[0] === v));
        r[rot] = s.av.filter((a) => a[campo] === v).length;
      });
      return r;
    });
  }

  function linhasAvaliadores() {
    return dados.avaliadores.map((p) => {
      const av = dados.avaliacoes.filter((a) => a.avaliador_id === p.id);
      const m = media(av.map((a) => a.nota_final));
      return { "Nome": p.nome, "Idade": p.idade ?? "", "Início": new Date(p.criado_em).toLocaleString("pt-BR"), "Lanches avaliados": av.length, "Média dada": m == null ? "" : +m.toFixed(2) };
    });
  }

  const nomeArquivo = (ext) => `degustacao-escritorio-${new Date().toISOString().slice(0, 10)}.${ext}`;

  function baixar(blob, nome) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  $("btn-csv").addEventListener("click", () => {
    const linhas = linhasAvaliacoes();
    if (!linhas.length) return toast("Ainda não há avaliações", true);
    const cab = Object.keys(linhas[0]);
    const cel = (v) => {
      const s = typeof v === "number" ? String(v).replace(".", ",") : String(v ?? "");
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cab.map(cel).join(";")].concat(linhas.map((l) => cab.map((c) => cel(l[c])).join(";"))).join("\r\n");
    baixar(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), nomeArquivo("csv"));
  });

  $("btn-xlsx").addEventListener("click", () => {
    if (!window.XLSX) return toast("Não foi possível carregar o gerador de Excel. Use o CSV.", true);
    const wb = XLSX.utils.book_new();
    const aba = (linhas, nome) => {
      const ws = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ "": "Sem dados" }]);
      if (linhas.length) ws["!cols"] = Object.keys(linhas[0]).map((k) => ({ wch: Math.min(40, Math.max(10, k.length + 2)) }));
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    aba(linhasResumo(), "Resumo por lanche");
    aba(linhasAvaliacoes(), "Avaliações");
    aba(linhasAvaliadores(), "Avaliadores");
    XLSX.writeFile(wb, nomeArquivo("xlsx"));
  });

  // ---------- Renomear ----------
  function renderNomes() {
    $("lista-nomes").innerHTML = dados.lanches
      .map((l) => `<label><b>${l.id}</b><input type="text" maxlength="60" data-id="${l.id}" value="${esc(l.nome)}" /></label>`)
      .join("");
  }

  $("form-nomes").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nomes = {};
    document.querySelectorAll("#lista-nomes input").forEach((i) => { if (i.value.trim()) nomes[i.dataset.id] = i.value.trim(); });
    const btn = $("btn-nomes");
    btn.disabled = true;
    try {
      await rpc("admin_renomear", { p_senha: senha, p_nomes: nomes });
      await carregar(senha);
      renderTudo();
      toast("Nomes salvos ✓");
    } catch (e) {
      $("erro-nomes").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Link ----------
  function renderLink() {
    const url = new URL("./", location.href).href;
    $("link-publico").textContent = url;
    const msg = `Oi! Me ajuda a escolher os lanches do Escritório Petiscos & Cia? Prove e dê sua nota por aqui: ${url}`;
    $("btn-whats").href = "https://wa.me/?text=" + encodeURIComponent(msg);
  }
  $("btn-copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("link-publico").textContent); toast("Link copiado ✓"); }
    catch (e) { toast("Selecione e copie o link manualmente", true); }
  });

  // ---------- Início ----------
  (async function () {
    if (!configurado()) {
      $("erro-login").textContent = "Site ainda não configurado: preencha config.js com os dados do Supabase.";
      return;
    }
    let salva = null;
    try { salva = sessionStorage.getItem(CHAVE_SENHA); } catch (e) {}
    if (salva) {
      try { await carregar(salva); abrirApp(); } catch (e) { try { sessionStorage.removeItem(CHAVE_SENHA); } catch (_) {} }
    }
  })();
})();
