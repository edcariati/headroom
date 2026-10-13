(function () {
  const { rpc, OPCOES, NOTAS, rotulo, num, reais, esc, cfg } = window.EP;
  const TOTAL = cfg.TOTAL_LANCHES;
  const $ = (id) => document.getElementById(id);
  const CHAVE_SENHA = "ep_painel_senha";

  // Paleta validada (contraste e daltonismo) sobre o fundo claro dos cartões.
  const CORES = ["#C2410C", "#B7862A", "#2F6FA3"];
  const FUNDO = "#fffaf2";
  const TINTA = "#6b4a33";

  // /admin = administração do salão (link interno): sem as abas da degustação, abre no Dashboard.
  const MODO_SISTEMA = /^\/admin\/?$/.test(location.pathname);
  if (MODO_SISTEMA) {
    document.body.classList.add("modo-sistema");
    document.title = "Administração · Escritório Petiscos & Cia";
    $("painel-sub").textContent = "Administração do salão";
  }

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
  const infoLanche = (id) => dados.lanches.find((l) => l.id === id) || { id, nome: "Lanche " + id, codinome: "", descricao: "" };
  const nomeLanche = (id) => { const l = infoLanche(id); return l.codinome ? `${l.codinome} · ${l.nome}` : l.nome; };
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
      const usuario = $("usuario").value.trim();
      // Admin cadastrado: troca nome + senha por um token, usado no lugar da senha principal.
      const chave = usuario ? (await rpc("admin_entrar", { p_nome: usuario, p_senha: $("senha").value })).token : $("senha").value;
      await carregar(chave);
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
    if (MODO_SISTEMA) document.querySelector('#abas button[data-aba="dashboard"]').click();
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
    if (b.dataset.aba === "cozinha") { renderCozinha(); carregarProcesso(); }
    if (b.dataset.aba === "compras") renderCompras();
    if (b.dataset.aba === "nomes") renderExtras();
    if (b.dataset.aba === "fluxo") renderFluxo();
    if (b.dataset.aba === "dashboard") renderDashboard();
    if (b.dataset.aba === "garcons") renderGarcons();
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

    renderMapa(stats);
    renderDistribuicao();
    renderPrecos(stats);
  }

  // ---------- Comparativo entre os lanches ----------
  // Escala sequencial laranja (clara → escura) para o mapa de notas.
  const RAMPA = ["#fdf0e3", "#f5b27a", "#e8761e", "#c2410c", "#7c2d12"];
  function corNota(v) {
    const t = Math.max(0, Math.min(1, v / 10)) * (RAMPA.length - 1);
    const i = Math.min(RAMPA.length - 2, Math.floor(t));
    const f = t - i;
    const a = RAMPA[i].match(/\w\w/g).map((h) => parseInt(h, 16));
    const b = RAMPA[i + 1].match(/\w\w/g).map((h) => parseInt(h, 16));
    const rgb = a.map((x, k) => Math.round(x + (b[k] - x) * f));
    const lum = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return { fundo: `rgb(${rgb.join(",")})`, texto: L < 0.2 ? "#fff" : "#2b1a10" };
  }

  function renderMapa(stats) {
    const CURTOS = { nota_espera: "Espera", nota_temperatura: "Temp.", nota_aparencia: "Aparên&shy;cia", nota_montagem: "Monta&shy;gem",
      nota_sabor: "Sabor", nota_carne: "Carne", nota_pao: "Pão", nota_molho: "Molho", nota_ingredientes: "Ingre&shy;dientes",
      nota_tamanho: "Tama&shy;nho", nota_facilidade: "Facili&shy;dade", nota_pediria: "Pediria de novo", nota_indicaria: "Indica&shy;ria" };
    const colunas = NOTAS.map(([c, r]) => [c, r, CURTOS[c]]).concat([["nota_final", "Nota final", "<b>Nota final</b>"]]);
    const linhas = stats.slice().sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || a.id - b.id);
    $("mapa-notas").innerHTML = `
      <thead><tr><th>Lanche</th><th class="num">Aval.</th>${colunas.map(([, r, curto]) => `<th title="${r}">${curto}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map((st) => `<tr>
        <td><button class="nome-lanche" data-lanche="${st.id}">${st.id}. ${esc(nomeLanche(st.id))}</button></td>
        <td class="num">${st.n}</td>
        ${colunas.map(([c, r]) => {
          if (!st.n) return `<td class="celula sem">–</td>`;
          const m = media(st.av.map((a) => a[c]));
          const cor = corNota(m);
          return `<td class="celula${c === "nota_final" ? " final" : ""}" style="background:${cor.fundo};color:${cor.texto}" title="${esc(nomeLanche(st.id))} · ${r}: ${num(m, 2)}">${num(m)}</td>`;
        }).join("")}
      </tr>`).join("")}</tbody>`;
  }
  $("mapa-notas").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-lanche]");
    if (b) irParaLanche(Number(b.dataset.lanche));
  });

  let campoDist = "espera";
  const DESC_DIST = {
    espera: "Quanto tempo cada lanche demorou para chegar, em % das avaliações.",
    chegou: "Como cada lanche chegou à mesa (quente, morno ou frio), em % das avaliações.",
    tamanho_percepcao: "Como os avaliadores acharam o tamanho de cada lanche, em % das avaliações.",
  };
  $("seg-dist").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-campo]");
    if (!b) return;
    campoDist = b.dataset.campo;
    document.querySelectorAll("#seg-dist button").forEach((x) => x.classList.toggle("ativa", x === b));
    renderDistribuicao();
  });

  function renderDistribuicao() {
    if (graficos.dist) graficos.dist.destroy();
    const box = $("dist-box");
    box.querySelector(".vazio")?.remove();
    $("dist-desc").textContent = DESC_DIST[campoDist];
    const stats = Array.from({ length: TOTAL }, (_, i) => statsLanche(i + 1)).filter((s) => s.n);
    box.style.height = Math.max(stats.length, 1) * 30 + 80 + "px";
    if (!stats.length || !window.Chart) {
      box.insertAdjacentHTML("beforeend", `<p class="vazio">${stats.length ? "Gráfico indisponível (sem internet?)" : "Sem avaliações ainda."}</p>`);
      return;
    }
    const estreito = window.innerWidth < 600;
    const curto = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
    const contagem = (s, v) => s.av.filter((a) => a[campoDist] === v).length;
    graficos.dist = new Chart($("g-dist"), {
      type: "bar",
      data: {
        labels: stats.map((s) => `${s.id}. ${estreito ? curto(nomeLanche(s.id), 14) : nomeLanche(s.id)}`),
        datasets: OPCOES[campoDist].map(([v, r], i) => ({
          label: r,
          data: stats.map((s) => (100 * contagem(s, v)) / s.n),
          contagens: stats.map((s) => contagem(s, v)),
          backgroundColor: CORES[i],
          borderColor: FUNDO,
          borderWidth: { right: 2 },
          barPercentage: 0.78,
          categoryPercentage: 1,
        })),
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, min: 0, max: 100, ticks: { callback: (v) => v + "%", stepSize: estreito ? 25 : 10 }, grid: { color: "#efe2cf" } },
          y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, color: "#2b1a10", font: { size: estreito ? 12 : 13 } } },
        },
        plugins: {
          legend: { position: "top", align: "start", labels: { boxWidth: 14, padding: 14, font: { size: 13 } } },
          tooltip: {
            mode: "index",
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${c.dataset.contagens[c.dataIndex]} (${Math.round(c.raw)}%)`,
            },
          },
        },
        onClick: (_, els) => { if (els.length) irParaLanche(stats[els[0].index].id); },
      },
    });
  }

  function renderPrecos(stats) {
    if (graficos.preco) graficos.preco.destroy();
    const box = $("preco-box");
    box.querySelector(".vazio")?.remove();
    const lista = stats.filter((s) => s.n).sort((a, b) => b.preco - a.preco);
    box.style.height = Math.max(lista.length, 1) * 30 + 50 + "px";
    if (!lista.length || !window.Chart) {
      box.insertAdjacentHTML("beforeend", `<p class="vazio">${lista.length ? "Gráfico indisponível (sem internet?)" : "Sem avaliações ainda."}</p>`);
      return;
    }
    const estreito = window.innerWidth < 600;
    const curto = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
    graficos.preco = new Chart($("g-preco"), {
      type: "bar",
      data: {
        labels: lista.map((s) => `${s.id}. ${estreito ? curto(nomeLanche(s.id), 12) : nomeLanche(s.id)}  ${reais(s.preco)}`),
        datasets: [{ data: lista.map((s) => s.preco), backgroundColor: CORES[0], borderRadius: 4, borderSkipped: "start", barPercentage: 0.72, categoryPercentage: 1 }],
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, ticks: { callback: (v) => "R$ " + v, maxRotation: 0 }, grid: { color: "#efe2cf" } },
          y: { grid: { display: false }, ticks: { autoSkip: false, color: "#2b1a10", font: { size: estreito ? 12 : 13 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => { const s = lista[c.dataIndex]; const ps = s.av.map((a) => Number(a.preco)); return ` Média ${reais(s.preco)} · de ${reais(Math.min(...ps))} a ${reais(Math.max(...ps))} · ${s.n} aval.`; } } },
        },
        onClick: (_, els) => { if (els.length) irParaLanche(lista[els[0].index].id); },
      },
    });
  }

  $("btn-imprimir").addEventListener("click", () => window.print());

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
    const info = infoLanche(s.id);
    $("desc-lanche").innerHTML = `<div class="rotulo-desc">${esc(info.codinome)} · ${esc(info.nome)}</div><p>${esc(info.descricao || "")}</p>`;
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
          "Codinome": infoLanche(a.lanche_id).codinome,
          "Lanche": infoLanche(a.lanche_id).nome,
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
      const r = { "Nº": s.id, "Codinome": infoLanche(s.id).codinome, "Lanche": infoLanche(s.id).nome, "Ingredientes": infoLanche(s.id).descricao, "Avaliações": s.n, "Nota final média": s.nota == null ? "" : +s.nota.toFixed(2), "Preço médio (R$)": s.preco == null ? "" : +s.preco.toFixed(2) };
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

  // ---------- Renomear / cardápio ----------
  function renderNomes() {
    $("lista-nomes").innerHTML = dados.lanches
      .map((l) => `<fieldset class="editar-lanche" data-id="${l.id}">
        <legend>${l.id}</legend>
        <label>Codinome<input type="text" maxlength="40" data-campo="codinome" value="${esc(l.codinome)}" /></label>
        <label>Nome<input type="text" maxlength="60" data-campo="nome" value="${esc(l.nome)}" /></label>
        <label>Preço (R$)<input type="text" inputmode="decimal" maxlength="10" data-campo="preco" value="${l.preco != null ? Number(l.preco).toFixed(2).replace(".", ",") : ""}" /></label>
        <label class="largo">Ingredientes<textarea maxlength="300" data-campo="descricao">${esc(l.descricao)}</textarea></label>
      </fieldset>`)
      .join("");
  }

  $("form-nomes").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nomes = {};
    document.querySelectorAll("#lista-nomes .editar-lanche").forEach((f) => {
      const item = {};
      f.querySelectorAll("[data-campo]").forEach((i) => { if (i.value.trim()) item[i.dataset.campo] = i.value.trim(); });
      nomes[f.dataset.id] = item;
    });
    const btn = $("btn-nomes");
    btn.disabled = true;
    $("erro-nomes").textContent = "";
    try {
      await rpc("admin_renomear", { p_senha: senha, p_nomes: nomes });
      await carregar(senha);
      renderTudo();
      toast("Cardápio salvo ✓");
    } catch (e) {
      $("erro-nomes").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Bebidas e doces do cardápio ----------
  // Sugestões só para facilitar o preenchimento: nada vai ao cardápio antes de o dono salvar.
  const SUGESTOES_EXTRA = {
    bebidas: [
      ["Refrigerantes", "Coca-Cola lata 350 ml"], ["Refrigerantes", "Guaraná lata 350 ml"], ["Refrigerantes", "Refrigerante 600 ml"], ["Refrigerantes", "Refrigerante 2 litros"],
      ["Sucos", "Suco natural de laranja"], ["Sucos", "Suco natural de limão"], ["Sucos", "Suco de polpa", "Pergunte os sabores do dia."],
      ["Águas", "Água mineral sem gás 500 ml"], ["Águas", "Água mineral com gás 500 ml"], ["Águas", "Água de coco"],
      ["Cafés", "Café coado"], ["Cafés", "Café expresso"], ["Cafés", "Café com leite"],
      ["Cervejas", "Cerveja lata 350 ml"], ["Cervejas", "Cerveja long neck"],
    ],
    doces: [
      ["Sobremesas", "Pudim de leite"], ["Sobremesas", "Mousse de maracujá"], ["Sobremesas", "Pavê"],
      ["Doces", "Brigadeiro"], ["Doces", "Bolo do dia", "Pergunte o sabor."], ["Sorvetes", "Sorvete (1 bola)"],
    ],
  };
  const NOME_SECAO = { bebidas: "bebida", doces: "doce" };
  const extraCarregado = {};

  const linhaExtra = (b = {}) => `<div class="bebida-linha">
      <input type="text" maxlength="40" data-b="categoria" placeholder="Categoria" value="${esc(b.categoria || "")}" aria-label="Categoria" />
      <input type="text" maxlength="60" data-b="nome" placeholder="Nome" value="${esc(b.nome || "")}" aria-label="Nome" />
      <input type="text" inputmode="decimal" maxlength="10" data-b="preco" placeholder="Preço" value="${b.preco != null ? Number(b.preco).toFixed(2).replace(".", ",") : ""}" aria-label="Preço (R$)" />
      <input type="text" maxlength="120" data-b="descricao" placeholder="Descrição (opcional)" value="${esc(b.descricao || "")}" aria-label="Descrição" />
      <button type="button" class="link" data-remover title="Remover">✕</button>
    </div>`;

  async function renderExtras() {
    if (extraCarregado.ok) return;
    let cfg = { bebidas: [], doces: [] };
    try { cfg = await rpc("listar_cardapio_extra"); } catch (e) { $("erro-bebidas").textContent = e.message; }
    for (const secao of ["bebidas", "doces"]) {
      let itens = cfg[secao] || [];
      if (!itens.length) {
        itens = SUGESTOES_EXTRA[secao].map(([categoria, nome, descricao]) => ({ categoria, nome, descricao: descricao || "" }));
        $(`${secao}-aviso`).innerHTML = "<b>Lista sugerida, ainda não publicada.</b> Confira os itens, preencha os preços, apague o que não vende e clique em Salvar. Só então ela aparece no cardápio e na calculadora dos garçons.";
      }
      $(`lista-${secao}`).innerHTML = itens.map(linhaExtra).join("");
    }
    extraCarregado.ok = true;
  }

  for (const secao of ["bebidas", "doces"]) {
    $(`lista-${secao}`).addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-remover]");
      if (b) b.closest(".bebida-linha").remove();
    });
    $(`btn-add-${secao}`).addEventListener("click", () => {
      const ultima = [...document.querySelectorAll(`#lista-${secao} [data-b=categoria]`)].pop();
      $(`lista-${secao}`).insertAdjacentHTML("beforeend", linhaExtra({ categoria: ultima ? ultima.value : "" }));
      [...document.querySelectorAll(`#lista-${secao} [data-b=nome]`)].pop().focus();
    });
    $(`form-${secao}`).addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const itens = [...document.querySelectorAll(`#lista-${secao} .bebida-linha`)].map((l) => {
        const o = {};
        l.querySelectorAll("[data-b]").forEach((i) => { o[i.dataset.b] = i.value.trim(); });
        return o;
      });
      const btn = $(`btn-${secao}`);
      btn.disabled = true;
      $(`erro-${secao}`).textContent = "";
      try {
        const salvos = await rpc("admin_cardapio_extra_salvar", { p_senha: senha, p_secao: secao, p_itens: itens });
        $(`lista-${secao}`).innerHTML = salvos.map(linhaExtra).join("");
        $(`${secao}-aviso`).textContent = `${salvos.length} ${NOME_SECAO[secao]}(s) no cardápio. Linha sem nome é ignorada.`;
        toast("Salvo ✓");
      } catch (e) {
        $(`erro-${secao}`).textContent = e.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- Fluxo do dia (mesas lançadas pelos garçons) ----------
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
  const diaBR = (d) => d.split("-").reverse().join("/");
  const AVISO_BANCO = `<div class="cartao"><h3>Banco de dados ainda não conectado</h3>
    <p>O fluxo do dia e o login dos garçons usam um banco de dados (Supabase, gratuito). Para ativar:</p>
    <ol class="lista-padrao"><li>Na Vercel, abra o projeto <b>escritorio-petiscos</b> → <b>Storage</b>.</li>
    <li>Clique em <b>Create Database</b> → <b>Supabase</b> e conecte ao projeto (ambientes Production e Preview).</li>
    <li>Pronto: as tabelas são criadas sozinhas no primeiro acesso. Depois cadastre os garçons na aba Garçons.</li></ol></div>`;
  let fluxo = null, fluxoTimer = null;

  async function renderFluxo(dia) {
    const box = $("fluxo-conteudo");
    clearInterval(fluxoTimer);
    try {
      fluxo = await rpc("admin_fluxo", { p_senha: senha, p_dia: dia || $("fluxo-dia").value || null });
    } catch (e) { box.innerHTML = `<div class="cartao erro-msg">${esc(e.message)}</div>`; return; }
    if (!fluxo.conectado) { box.innerHTML = AVISO_BANCO; return; }
    $("fluxo-dia").value = fluxo.dia;
    const ehHoje = fluxo.dia === fluxo.hoje;
    if (ehHoje) fluxoTimer = setInterval(() => { if (!document.hidden && !$("fluxo-conteudo").closest(".escondido")) renderFluxo(fluxo.dia); }, 30000);

    const at = fluxo.atendimentos, lanc = fluxo.lancamentos;
    const fechados = at.filter((a) => a.status === "fechado"), abertos = at.filter((a) => a.status === "aberto");
    const fat = fechados.reduce((t, a) => t + a.total, 0);
    const itensVendidos = at.reduce((t, a) => t + a.itens.reduce((u, i) => u + i.qtd, 0), 0);

    // Por garçom: mesas em que lançou, lançamentos, retiradas e valor líquido lançado.
    const porG = {};
    const g = (nome) => (porG[nome] ||= { nome, mesas: new Set(), abriu: 0, fechou: 0, lancou: 0, tirou: 0, valor: 0 });
    for (const l of lanc) {
      const x = g(l.garcom || "?");
      x.mesas.add(l.atendimento);
      if (l.qtd > 0) x.lancou += l.qtd; else x.tirou -= l.qtd;
      x.valor += l.preco * l.qtd;
    }
    for (const a of at) { if (a.aberto_por) g(a.aberto_por).abriu++; if (a.fechado_por) g(a.fechado_por).fechou++; }
    const garcons = Object.values(porG).sort((a, b) => b.valor - a.valor);

    // Itens mais pedidos do dia.
    const rank = {};
    for (const a of at) for (const i of a.itens) { const r = (rank[i.nome] ||= { nome: i.nome, qtd: 0, valor: 0 }); r.qtd += i.qtd; r.valor += i.qtd * i.preco; }
    const top = Object.values(rank).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

    // Atendimentos agrupados por mesa.
    const mesasDia = [...new Set(at.map((a) => a.mesa))].sort((a, b) => a - b);
    const cartaoAtend = (a) => `<details class="atend${a.status === "aberto" ? " aberto" : ""}">
        <summary><b>Mesa ${a.mesa}</b> · ${hhmm(a.aberto_em)} → ${a.fechado_em ? hhmm(a.fechado_em) : "<em>aberta</em>"} · ${esc(a.garcons.join(", ") || a.aberto_por || "")}<span class="atend-total">${brl(a.total)}</span></summary>
        <p class="muted">Aberta por <b>${esc(a.aberto_por || "?")}</b>${a.fechado_em ? ` · fechada por <b>${esc(a.fechado_por || "painel")}</b>` : ""}${a.forma_pagamento ? ` · pago em <b>${esc(NOME_FORMA[a.forma_pagamento] || a.forma_pagamento)}</b>` : ""}${a.troco ? ` (troco ${brl(a.troco)})` : ""} · ${a.pessoas} ${a.pessoas === 1 ? "pessoa" : "pessoas"}${a.servico ? " · com serviço 10%" : ""}</p>
        <div class="tabela-wrap"><table>
          <thead><tr><th class="num">Qtd</th><th>Item</th><th>Lançado por</th><th class="num">Valor</th></tr></thead>
          <tbody>${a.itens.map((i) => `<tr><td class="num">${i.qtd}</td><td>${esc(i.nome)}</td><td>${Object.entries(i.por).map(([n, q]) => `${esc(n)} ${q > 0 ? "+" + q : q}`).join(" · ")}</td><td class="num">${brl(i.qtd * i.preco)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="3">Subtotal${a.servico ? " + serviço" : ""}</td><td class="num"><b>${brl(a.total)}</b></td></tr></tfoot>
        </table></div>
      </details>`;

    $("fluxo-conteudo").innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="r">Atendimentos fechados</div><div class="v">${fechados.length}</div></div>
        <div class="kpi"><div class="r">Mesas abertas agora</div><div class="v">${ehHoje ? abertos.length : "—"}</div></div>
        <div class="kpi"><div class="r">Faturado (fechados)</div><div class="v" style="font-size:26px">${brl(fat)}</div></div>
        <div class="kpi"><div class="r">Ticket médio</div><div class="v" style="font-size:26px">${brl(fechados.length ? fat / fechados.length : 0)}</div></div>
        <div class="kpi"><div class="r">Itens vendidos</div><div class="v">${itensVendidos}</div></div>
      </div>
      ${at.length ? "" : `<div class="cartao vazio">Nenhum atendimento em ${diaBR(fluxo.dia)}.</div>`}
      ${fluxo.caixa && fluxo.caixa.contas.length ? `<div class="cartao"><h3>Fechamento do caixa</h3><div class="kpis">${Object.entries(NOME_FORMA).map(([f, n]) => `<div class="kpi"><div class="r">${n}</div><div class="v" style="font-size:22px">${brl(fluxo.caixa.porForma[f])}</div></div>`).join("")}</div></div>` : ""}
      ${garcons.length ? `<div class="cartao"><h3>Por garçom</h3><div class="tabela-wrap"><table>
        <thead><tr><th>Garçom</th><th class="num">Mesas atendidas</th><th class="num">Abriu</th><th class="num">Fechou</th><th class="num">Itens lançados</th><th class="num">Itens tirados</th><th class="num">Valor lançado</th></tr></thead>
        <tbody>${garcons.map((x) => `<tr><td><b>${esc(x.nome)}</b></td><td class="num">${x.mesas.size}</td><td class="num">${x.abriu}</td><td class="num">${x.fechou}</td><td class="num">${x.lancou}</td><td class="num">${x.tirou}</td><td class="num">${brl(x.valor)}</td></tr>`).join("")}</tbody>
      </table></div></div>` : ""}
      ${mesasDia.length ? `<div class="cartao"><h3>Por mesa</h3><p class="muted">Toque no atendimento para ver os itens e quem lançou cada um.</p>
        ${mesasDia.map((m) => `<div class="mesa-dia">${at.filter((a) => a.mesa === m).map(cartaoAtend).join("")}</div>`).join("")}
      </div>` : ""}
      ${top.length ? `<div class="cartao"><h3>Mais pedidos do dia</h3><div class="tabela-wrap"><table>
        <thead><tr><th class="num">#</th><th>Item</th><th class="num">Qtd</th><th class="num">Valor</th></tr></thead>
        <tbody>${top.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.nome)}</td><td class="num">${r.qtd}</td><td class="num">${brl(r.valor)}</td></tr>`).join("")}</tbody>
      </table></div></div>` : ""}
      ${lanc.length ? `<div class="cartao"><h3>Linha do tempo</h3><p class="muted">Cada toque dos garçons, do mais recente para o mais antigo.</p><div class="tabela-wrap linha-tempo"><table>
        <thead><tr><th>Hora</th><th class="num">Mesa</th><th>Garçom</th><th>Item</th><th class="num"></th></tr></thead>
        <tbody>${lanc.slice().reverse().map((l) => `<tr><td>${hhmm(l.em)}</td><td class="num">${l.mesa}</td><td>${esc(l.garcom || "?")}</td><td>${esc(l.nome)}</td><td class="num ${l.qtd < 0 ? "tirou" : "lancou"}">${l.qtd > 0 ? "+1" : "−1"}</td></tr>`).join("")}</tbody>
      </table></div></div>` : ""}
      ${fluxo.dias.length ? `<div class="cartao"><h3>Últimos dias</h3><div class="dias-lista">${fluxo.dias.map((d) => `<button type="button" class="dia-btn${d.dia === fluxo.dia ? " ativo" : ""}" data-dia="${d.dia}"><b>${diaBR(d.dia)}</b><span>${d.atendimentos} atend. · ${brl(d.total)}</span></button>`).join("")}</div></div>` : ""}`;
  }

  $("fluxo-dia").addEventListener("change", () => renderFluxo($("fluxo-dia").value));
  $("btn-fluxo-hoje").addEventListener("click", () => { $("fluxo-dia").value = ""; renderFluxo(); });
  $("fluxo-conteudo").addEventListener("click", (ev) => { const b = ev.target.closest("[data-dia]"); if (b) renderFluxo(b.dataset.dia); });
  $("btn-fluxo-xlsx").addEventListener("click", () => {
    if (!fluxo || !fluxo.conectado) return toast("Nada para exportar", true);
    if (!window.XLSX) return toast("Não foi possível carregar o gerador de Excel.", true);
    const wb = XLSX.utils.book_new();
    const aba = (linhas, nome) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ "": "Sem dados" }]), nome);
    aba(fluxo.atendimentos.map((a) => ({ Mesa: a.mesa, Status: a.status, Abertura: hhmm(a.aberto_em), "Aberta por": a.aberto_por, Fechamento: hhmm(a.fechado_em), "Fechada por": a.fechado_por || "", Garçons: a.garcons.join(", "), Pessoas: a.pessoas, Serviço: a.servico ? "sim" : "não", Subtotal: a.subtotal, Total: a.total })), "Atendimentos");
    aba(fluxo.atendimentos.flatMap((a) => a.itens.map((i) => ({ Mesa: a.mesa, Abertura: hhmm(a.aberto_em), Item: i.nome, Qtd: i.qtd, Preço: i.preco, Valor: Math.round(i.qtd * i.preco * 100) / 100, "Lançado por": Object.entries(i.por).map(([n, q]) => `${n} ${q}`).join(", ") }))), "Itens");
    aba(fluxo.lancamentos.map((l) => ({ Hora: hhmm(l.em), Mesa: l.mesa, Garçom: l.garcom, Item: l.nome, Qtd: l.qtd, Preço: l.preco })), "Lançamentos");
    XLSX.writeFile(wb, `fluxo-${fluxo.dia}.xlsx`);
  });

  // ---------- Dashboard (só admin) ----------
  const NOME_FORMA = { dinheiro: "💵 Dinheiro", pix: "⚡ Pix", debito: "💳 Débito", credito: "💳 Crédito" };
  const NOME_PARTE = { lanches: "Lanches", pratos: "Pratos quentes", bebidas: "Bebidas", doces: "Doces", outros: "Outros" };
  const CORES_DASH = ["#e8761e", "#7a3e1d", "#c9962a", "#3f8a46", "#6b55a3", "#b42318", "#2f6f9f", "#8a5a34"];
  let dash = null, dashDias = 30, dashTimer = null;

  function grafico(id, cfg) {
    if (graficos[id]) graficos[id].destroy();
    const c = $(id);
    if (!c || !window.Chart) return;
    graficos[id] = new Chart(c, cfg);
  }

  async function renderDashboard() {
    const box = $("dash-conteudo");
    clearInterval(dashTimer);
    try { dash = await rpc("admin_dashboard", { p_senha: senha, p_dias: dashDias }); }
    catch (e) { box.innerHTML = `<div class="cartao erro-msg">${esc(e.message)}</div>`; return; }
    if (!dash.conectado) { box.innerHTML = AVISO_BANCO; return; }
    dashTimer = setInterval(() => { if (!document.hidden && !$("dash-conteudo").closest(".escondido")) renderDashboard(); }, 30000);
    const h = dash.hojeResumo, o = dash.ontemResumo;
    const varia = o.total ? Math.round(((h.total - o.total) / o.total) * 100) : null;
    const totPeriodo = dash.porDia.reduce((t, d) => t + d.total, 0), contasPeriodo = dash.porDia.reduce((t, d) => t + d.atendimentos, 0);
    const abertasTotal = dash.abertas.reduce((t, m) => t + m.total, 0);

    box.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="r">Faturado hoje</div><div class="v" style="font-size:26px">${brl(h.total)}</div><div class="muted">${varia == null ? "ontem sem vendas" : `${varia >= 0 ? "▲" : "▼"} ${Math.abs(varia)}% vs ontem (${brl(o.total)})`}</div></div>
        <div class="kpi"><div class="r">Contas hoje</div><div class="v">${h.contas}</div><div class="muted">ticket médio ${brl(h.contas ? h.total / h.contas : 0)}</div></div>
        <div class="kpi"><div class="r">Tempo médio de mesa</div><div class="v">${Math.round(h.minutos)}<small> min</small></div></div>
        <div class="kpi"><div class="r">No salão agora</div><div class="v">${dash.abertas.length}<small> mesas</small></div><div class="muted">${brl(abertasTotal)} em aberto</div></div>
        <div class="kpi"><div class="r">Últimos ${dash.dias} dias</div><div class="v" style="font-size:26px">${brl(totPeriodo)}</div><div class="muted">${contasPeriodo} contas · ticket ${brl(contasPeriodo ? totPeriodo / contasPeriodo : 0)}</div></div>
      </div>

      <div class="cartao">
        <h3>Agora no salão</h3>
        ${dash.abertas.length ? `<div class="dash-mesas">${dash.abertas.map((m) => `
          <details class="atend aberto${m.conta_pedida ? " conta" : ""}">
            <summary><b>Mesa ${m.mesa}</b> · desde ${hhmm(m.aberto_em)} · ${esc(m.aberto_por || "")}${m.conta_pedida ? " · 🧾 conta pedida" : ""}<span class="atend-total">${brl(m.total)}</span></summary>
            <ul class="lista-padrao">${m.itens.map((i) => `<li>${i.qtd}× ${esc(i.nome)} — ${brl(i.qtd * i.preco)}</li>`).join("")}</ul>
            <div class="fechar-painel" data-mesa="${m.mesa}">
              <select data-f="forma" aria-label="Forma de pagamento">${Object.entries(NOME_FORMA).map(([f, n]) => `<option value="${f}">${n}</option>`).join("")}</select>
              <input type="text" inputmode="decimal" data-f="recebido" placeholder="Recebido (dinheiro)" aria-label="Valor recebido" />
              <button type="button" class="botao pequeno" data-fechar-mesa="${m.mesa}">Fechar conta (${brl(m.total)})</button>
            </div>
          </details>`).join("")}</div>` : '<p class="muted">Nenhuma mesa aberta agora.</p>'}
      </div>

      <div class="dash-grade">
        <div class="cartao"><h3>Faturamento por dia</h3><div class="grafico-caixa"><canvas id="g-dia"></canvas></div></div>
        <div class="cartao"><h3>Pedidos por hora (hoje)</h3><div class="grafico-caixa"><canvas id="g-hora"></canvas></div></div>
        <div class="cartao"><h3>Pratos e itens mais pedidos</h3><div class="grafico-caixa alto"><canvas id="g-top"></canvas></div></div>
        <div class="cartao"><h3>Vendas por parte do cardápio</h3><div class="grafico-caixa"><canvas id="g-parte"></canvas></div></div>
        <div class="cartao"><h3>Formas de pagamento</h3><div class="grafico-caixa"><canvas id="g-forma"></canvas></div></div>
        <div class="cartao"><h3>Equipe no período</h3>${dash.porGarcom.length ? `<div class="tabela-wrap"><table>
          <thead><tr><th>Quem lançou</th><th class="num">Mesas</th><th class="num">Itens</th><th class="num">Valor</th></tr></thead>
          <tbody>${dash.porGarcom.map((g) => `<tr><td><b>${esc(g.nome)}</b></td><td class="num">${g.mesas}</td><td class="num">${g.itens}</td><td class="num">${brl(g.valor)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Sem lançamentos no período.</p>'}</div>
      </div>
      ${!dash.porDia.length && !dash.top.length ? '<div class="cartao vazio">Ainda não há vendas registradas. Assim que os garçons lançarem e o caixa fechar contas, os gráficos aparecem aqui.</div>' : ""}`;

    const eixoReais = { ticks: { callback: (v) => "R$ " + v } };
    grafico("g-dia", { type: "bar", data: { labels: dash.porDia.map((d) => diaBR(d.dia).slice(0, 5)), datasets: [{ label: "Faturado", data: dash.porDia.map((d) => d.total), backgroundColor: "#e8761e", borderRadius: 6 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => brl(c.raw) } } }, scales: { y: eixoReais } } });
    const h0 = Math.min(6, ...dash.porHora.map((x) => x.hora)), horas = Array.from({ length: 24 }, (_, i) => i).filter((i) => i >= h0);
    grafico("g-hora", { type: "bar", data: { labels: horas.map((i) => `${i}h`), datasets: [{ label: "Itens", data: horas.map((i) => (dash.porHora.find((x) => x.hora === i) || {}).itens || 0), backgroundColor: "#7a3e1d", borderRadius: 6 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    grafico("g-top", { type: "bar", data: { labels: dash.top.map((t) => t.nome), datasets: [{ label: "Quantidade", data: dash.top.map((t) => t.qtd), backgroundColor: dash.top.map((t) => CORES_DASH[Object.keys(NOME_PARTE).indexOf(t.parte || "outros")] || CORES_DASH[7]), borderRadius: 6 }] }, options: { indexAxis: "y", maintainAspectRatio: false, scales: { y: { ticks: { autoSkip: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw} un · ${brl(dash.top[c.dataIndex].valor)}` } } } } });
    grafico("g-parte", { type: "doughnut", data: { labels: dash.porParte.map((p) => NOME_PARTE[p.parte] || p.parte), datasets: [{ data: dash.porParte.map((p) => p.valor), backgroundColor: dash.porParte.map((p) => CORES_DASH[Object.keys(NOME_PARTE).indexOf(p.parte)] || CORES_DASH[7]) }] }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (c) => `${c.label}: ${brl(c.raw)}` } } } } });
    grafico("g-forma", { type: "doughnut", data: { labels: dash.porForma.map((f) => NOME_FORMA[f.forma] || f.forma), datasets: [{ data: dash.porForma.map((f) => f.total), backgroundColor: CORES_DASH }] }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (c) => `${c.label}: ${brl(c.raw)}` } } } } });
  }

  $("dash-periodo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dias]");
    if (!b) return;
    dashDias = Number(b.dataset.dias);
    $("dash-periodo").querySelectorAll("button").forEach((x) => x.classList.toggle("ativa", x === b));
    renderDashboard();
  });
  $("dash-conteudo").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-fechar-mesa]");
    if (!b) return;
    const box = b.closest(".fechar-painel");
    const forma = box.querySelector('[data-f="forma"]').value, recebido = box.querySelector('[data-f="recebido"]').value;
    if (!confirm(`Fechar a conta da mesa ${b.dataset.fecharMesa} em ${NOME_FORMA[forma].slice(2).trim()}?`)) return;
    b.disabled = true;
    try {
      const r = await rpc("admin_fechar", { p_senha: senha, p_mesa: Number(b.dataset.fecharMesa), p_forma: forma, p_recebido: recebido });
      toast(`Mesa ${r.mesa} fechada ✓${r.troco ? ` · troco ${brl(r.troco)}` : ""}`);
      renderDashboard();
    } catch (e) { toast(e.message, true); b.disabled = false; }
  });

  // ---------- Garçons (cadastro e PIN) ----------
  function listaGarcons(lista) {
    $("lista-garcons").innerHTML = lista.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Nome</th><th>Função</th><th>Nova senha</th><th>Ativo</th><th></th></tr></thead>
      <tbody>${lista.map((x) => `<tr data-g="${x.id}">
        <td><input type="text" maxlength="40" data-gc="nome" value="${esc(x.nome)}" aria-label="Nome" /></td>
        <td><select data-gc="papel" aria-label="Função">${[["garcom", "Garçom"], ["caixa", "Caixa"], ["admin", "Admin"]].map(([v, n]) => `<option value="${v}" ${x.papel === v ? "selected" : ""}>${n}</option>`).join("")}</select></td>
        <td><input type="text" maxlength="30" data-gc="pin" placeholder="manter a atual" aria-label="Nova senha" autocomplete="off" /></td>
        <td><input type="checkbox" data-gc="ativo" ${x.ativo ? "checked" : ""} aria-label="Ativo" /></td>
        <td><button class="botao pequeno secundario" type="button" data-salvar-g>Salvar</button></td>
      </tr>`).join("")}</tbody></table></div>` : '<p class="muted">Nenhum garçom cadastrado ainda.</p>';
  }

  async function renderGarcons() {
    $("erro-garcons").textContent = "";
    try {
      const r = await rpc("admin_garcons", { p_senha: senha });
      if (!r.conectado) { $("lista-garcons").innerHTML = AVISO_BANCO; $("form-garcom-novo").classList.add("escondido"); return; }
      $("form-garcom-novo").classList.remove("escondido");
      listaGarcons(r.garcons);
    } catch (e) { $("erro-garcons").textContent = e.message; }
  }

  async function salvarGarcom(dados) {
    $("erro-garcons").textContent = "";
    try {
      listaGarcons(await rpc("admin_garcom_salvar", { p_senha: senha, ...dados }));
      toast("Garçom salvo ✓");
      return true;
    } catch (e) { $("erro-garcons").textContent = e.message; return false; }
  }
  $("form-garcom-novo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (await salvarGarcom({ p_nome: $("novo-garcom-nome").value, p_pin: $("novo-garcom-pin").value, p_papel: $("novo-garcom-papel").value })) {
      $("novo-garcom-nome").value = ""; $("novo-garcom-pin").value = "";
    }
  });
  $("lista-garcons").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-salvar-g]");
    if (!b) return;
    const tr = b.closest("tr");
    const v = (k) => tr.querySelector(`[data-gc="${k}"]`);
    salvarGarcom({ p_id: Number(tr.dataset.g), p_nome: v("nome").value, p_pin: v("pin").value, p_ativo: v("ativo").checked, p_papel: v("papel").value });
  });

  // ---------- Cozinha: processo completo (dados privados vindos da API) ----------
  const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let cozinha = null, compras = null;
  const TIPO = { p: "pao", c: "carne", m: "molho", v: "verde", k: "croc" };

  async function renderCozinha() {
    const box = $("cozinha-conteudo");
    try {
      if (!cozinha) cozinha = await rpc("admin_cozinha", { p_senha: senha });
    } catch (e) { box.innerHTML = `<div class="cartao erro-msg">${esc(e.message)}</div>`; return; }
    if (!cozinha) { box.innerHTML = '<div class="cartao vazio">Processo de cozinha não encontrado no servidor.</div>'; return; }
    const z = cozinha;
    const marcados = ler("ep_checklist", {});
    const check = (grupo, itens) => itens.map((t, i) => {
      const id = `${grupo}-${i}`;
      return `<label class="check-item"><input type="checkbox" data-check="${id}" ${marcados[id] ? "checked" : ""}/> <span>${esc(t)}</span></label>`;
    }).join("");
    const pilhas = dados.lanches.map((l) => {
      const m = z.montagem[l.id];
      if (!m) return "";
      const camadas = m.camadas.slice().reverse().map(([t, rot], i, arr) =>
        `<div class="camada ${TIPO[t]}${i === 0 ? " tampa" : ""}${i === arr.length - 1 ? " base" : ""}">${esc(rot)}</div>`).join("");
      return `<div class="pilha-lanche">
        <div class="pilha-nome">${l.id}. ${esc(l.codinome || l.nome)}</div>
        <div class="pilha-sub">${esc(l.nome)}</div>
        <div class="pilha">${camadas}</div>
        <p class="pilha-chapa"><b>Chapa:</b> ${esc(m.chapa)}</p>
      </div>`;
    }).join("");

    box.innerHTML = `
      <div class="cartao">
        <h3>Quem faz o quê</h3>
        <div class="duas-colunas">
          <div class="papel"><div class="papel-nome">👨‍🍳 Chapeiro</div><p>${esc(z.divisao.chapeiro)}</p></div>
          <div class="papel"><div class="papel-nome">🧑‍🍳 Ajudante</div><p>${esc(z.divisao.ajudante)}</p></div>
        </div>
        <div class="fluxo">
          <span class="passo">Preparo antecipado</span><span class="seta">→</span>
          <span class="passo chapeiro">Tostar o pão</span><span class="seta">→</span>
          <span class="passo chapeiro">Carne + queijo</span><span class="seta">→</span>
          <span class="passo">Montar de baixo para cima</span><span class="seta">→</span>
          <span class="passo destaque">Embrulhar e numerar (1 a 13)</span>
        </div>
        <h3 style="margin-top:18px">Padrões para todos os lanches</h3>
        <ol class="lista-padrao">${z.padroes.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      </div>

      <div class="cartao">
        <h3>Linha do tempo do preparo</h3>
        <p class="muted">A cebola caramelizada e os hambúrgueres saem na véspera; o resto, no dia.</p>
        <div class="momentos">${z.momentos.map((mo, i) => `
          <div class="momento${i === 0 ? " destaque" : ""}">
            <div class="momento-nome">${esc(mo.nome)}</div>
            <div class="momento-sub">${esc(mo.sub)}</div>
            <ul>${mo.itens.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          </div>`).join("")}
        </div>
      </div>

      <div class="cartao">
        <h3>Preparo antecipado, passo a passo</h3>
        <div class="tabela-wrap"><table>
          <thead><tr><th class="num">#</th><th>Preparo</th><th>Como fazer</th><th>Quando</th><th>Guardar</th></tr></thead>
          <tbody>${z.preparo.map((r, i) => `<tr><td class="num">${i + 1}</td><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>

      <div class="cartao">
        <h3>Montagem dos 13 lanches</h3>
        <p class="muted">Cada pilha mostra o lanche de cima (tampa) para baixo (base). Monte de baixo para cima.</p>
        <div class="legenda-camadas">
          <span><i class="camada pao"></i>Pão</span><span><i class="camada carne"></i>Carne e queijo</span>
          <span><i class="camada molho"></i>Molho e doce</span><span><i class="camada verde"></i>Verdura e fruta</span>
          <span><i class="camada croc"></i>Crocante</span>
        </div>
        <div class="pilhas">${pilhas}</div>
      </div>

      <div class="cartao">
        <h3>Padrão de porções</h3>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Ingrediente</th><th>Porção por lanche</th><th>Lanches</th></tr></thead>
          <tbody>${z.porcoes.map((r) => `<tr${r[1].startsWith("a definir") ? ' class="a-definir"' : ""}><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody>
        </table></div>
        <p class="muted" style="margin-top:12px"><b>Para confirmar com o dono:</b></p>
        <ul class="lista-padrao">${z.confirmar.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>

      <div class="cartao">
        <h3>Cuidados</h3>
        <div class="duas-colunas">
          <div><p class="rotulo-desc">🌱 Lanche vegano (11. ${esc(infoLanche(11).codinome || infoLanche(11).nome)})</p><ul class="lista-padrao">${z.vegano.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
          <div><p class="rotulo-desc">⚠️ Alergênicos para avisar o avaliador</p><ul class="lista-padrao">${z.alergenicos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
        </div>
      </div>

      <div class="cartao">
        <div class="acoes" style="justify-content:space-between"><h3 style="margin:0">Checklist</h3><button class="link nao-imprimir" type="button" id="btn-limpar-check">Desmarcar tudo</button></div>
        <div class="duas-colunas" style="margin-top:10px">
          <div><p class="rotulo-desc">Abertura</p>${check("abertura", z.abertura)}</div>
          <div><p class="rotulo-desc">Fechamento</p>${check("fechamento", z.fechamento)}</div>
        </div>
      </div>
      ${z.pratos ? htmlPratos(z.pratos, check) : ""}`;
    box.querySelectorAll("[data-check]").forEach((c) => c.addEventListener("change", () => {
      const m = ler("ep_checklist", {}); m[c.dataset.check] = c.checked; gravar("ep_checklist", m);
    }));
    $("btn-limpar-check").addEventListener("click", () => { gravar("ep_checklist", {}); renderCozinha(); });
  }

  // Pratos da cozinha (almoço, especiais, chapa e leves): mesma lógica visual da montagem dos lanches.
  const TIPO_PRATO = { a: "pao", p: "carne", m: "molho", v: "verde", f: "croc" };
  function htmlPratos(pr, check) {
    const cartaoPrato = (p) => `<div class="pilha-lanche">
        <div class="pilha-nome">P${p.id}. ${esc(p.nome)}</div>
        <div class="pilha-sub">${esc(p.preco)} · ${esc(p.quem)}</div>
        <div class="pilha">${p.montagem.map(([t, rot], i) => `<div class="camada ${TIPO_PRATO[t]}">${i + 1}. ${esc(rot)}</div>`).join("")}</div>
        <p class="pilha-chapa"><b>Preparo:</b> ${esc(p.preparo)}</p>
      </div>`;
    const grupos = pr.grupos.map(([g, titulo]) => {
      const itens = pr.pratos.filter((p) => p.grupo === g);
      return itens.length ? `<p class="rotulo-desc" style="margin-top:16px">${esc(titulo)}</p><div class="pilhas">${itens.map(cartaoPrato).join("")}</div>` : "";
    }).join("");
    return `
      <h2 class="titulo-secao-cozinha">🍽 Pratos da cozinha</h2>
      <div class="cartao">
        <h3>Quem faz o quê nos pratos</h3>
        <div class="duas-colunas">
          <div class="papel"><div class="papel-nome">🍳 Chapeiro</div><p>${esc(pr.divisao.chapeiro)}</p></div>
          <div class="papel"><div class="papel-nome">🥗 Ajudante</div><p>${esc(pr.divisao.ajudante)}</p></div>
        </div>
        <h3 style="margin-top:18px">Semana da cozinha</h3>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Dia</th><th>O que sai</th><th>Na véspera</th><th>No dia</th></tr></thead>
          <tbody>${pr.semana.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>

      <div class="cartao">
        <h3>Preparo de todo dia, antes de abrir</h3>
        ${check("pratos", pr.diario)}
      </div>

      <div class="cartao">
        <h3>Montagem dos ${pr.pratos.length} pratos</h3>
        <p class="muted">Cada cartão mostra o prato na ordem de montar, do primeiro item ao último. Numerados de P1 a P${pr.pratos.length} para não confundir com os lanches.</p>
        <div class="legenda-camadas">
          <span><i class="camada pao"></i>Arroz, feijão, massa, pão</span><span><i class="camada carne"></i>Proteína</span>
          <span><i class="camada molho"></i>Molho e queijo</span><span><i class="camada verde"></i>Salada e verdura</span>
          <span><i class="camada croc"></i>Frito e empanado</span>
        </div>
        ${grupos}
        <p class="rotulo-desc" style="margin-top:16px">Extras (qualquer pedido)</p>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Extra</th><th>Preço</th><th>Porção</th></tr></thead>
          <tbody>${pr.extras.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>

      <div class="cartao">
        <h3>Porções padrão dos pratos</h3>
        <p class="muted">Picanha e contrafilé vêm do cardápio. O resto é sugestão até o dono confirmar.</p>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Item</th><th>Porção por prato</th><th>Onde vai</th></tr></thead>
          <tbody>${pr.porcoes.map((r) => `<tr${/a definir|sugestão/.test(r[1]) ? ' class="a-definir"' : ""}><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody>
        </table></div>
        <p class="muted" style="margin-top:12px"><b>Para confirmar com o dono:</b></p>
        <ul class="lista-padrao">${pr.confirmar.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>`;
  }

  // ---------- Compras e custo por lanche ----------
  // custo por unidade de compra: preço médio atual quando informado, senão o da última compra
  const custoUnidade = (it) => (it.preco != null ? it.preco : it.qtd ? it.custo / it.qtd : null);
  const custoBase = (it) => { const u = custoUnidade(it); return u != null && it.conteudo ? u / it.conteudo : null; };
  const fmtQtd = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  async function renderCompras() {
    const box = $("compras-conteudo");
    try {
      if (!compras) compras = await rpc("admin_compras", { p_senha: senha });
    } catch (e) { box.innerHTML = `<div class="cartao erro-msg">${esc(e.message)}</div>`; return; }
    if (!compras) { box.innerHTML = '<div class="cartao vazio">Lista de compras não encontrada no servidor.</div>'; return; }
    const c = compras;
    const proxima = ler("ep_proxima_compra", {});
    const pesoCarne = ler("ep_peso_carne", "") || c.peso_carne_padrao || "";
    const cmv = ler("ep_cmv", 30);
    const total = c.itens.reduce((a, it) => a + it.custo, 0);

    box.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="r">Última compra</div><div class="v">${reais(total)}</div></div>
        <div class="kpi"><div class="r">Itens comprados</div><div class="v">${c.itens.length}</div></div>
        <div class="kpi"><div class="r">Itens a cotar</div><div class="v">${c.cotar.length}</div></div>
        <div class="kpi"><div class="r">Próxima compra (prevista)</div><div class="v" id="total-previsto">–</div></div>
      </div>

      <div class="cartao">
        <h3>Lista de insumos</h3>
        <p class="muted">${esc(c.referencia)}. Digite em "Próxima compra" a quantidade que vai comprar (na unidade de compra) para ver o custo previsto. Fica salvo neste aparelho.</p>
        <div class="tabela-wrap"><table class="tabela-compras">
          <thead><tr><th>Produto</th><th>Categoria</th><th class="num">Comprado</th><th class="num">Pago</th><th class="num">Preço médio por unidade</th><th class="num nao-imprimir-col">Próxima compra</th><th class="num">Previsto</th></tr></thead>
          <tbody>${c.itens.map((it, i) => `<tr>
            <td><b>${esc(it.produto)}</b>${it.obs ? `<div class="obs">${esc(it.obs)}</div>` : ""}</td>
            <td data-rot="Categoria">${esc(it.categoria)}</td>
            <td class="num" data-rot="Comprado">${fmtQtd(it.qtd)} ${esc(it.unidade)}</td>
            <td class="num" data-rot="Pago">${reais(it.custo)}</td>
            <td class="num" data-rot="Preço médio"><b>${reais(custoUnidade(it))}</b>/${esc(it.unidade)}</td>
            <td class="num" data-rot="Próxima compra"><input class="qtd-proxima" type="number" inputmode="decimal" min="0" step="any" data-i="${i}" value="${proxima[it.produto] ?? ""}" placeholder="0"/> ${esc(it.unidade)}</td>
            <td class="num" data-rot="Previsto" data-previsto="${i}">–</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="3"><b>Total</b></td><td class="num"><b>${reais(total)}</b></td><td></td><td></td><td class="num"><b id="total-previsto-tab">–</b></td></tr></tfoot>
        </table></div>
        <p class="rotulo-desc" style="margin-top:14px">Falta cotar (estão nas receitas, mas não na compra)</p>
        <ul class="lista-padrao">${c.cotar.map((x) => `<li><b>${esc(x.produto)}</b>: ${esc(x.motivo)}</li>`).join("")}</ul>
      </div>

      <div class="cartao">
        <h3>Custo por lanche</h3>
        <div class="acoes" style="margin-bottom:10px">
          <label class="campo-inline">Peso do hambúrguer bovino <input id="peso-carne" type="number" min="0" step="1" value="${pesoCarne}" placeholder="g"/> g</label>
          <label class="campo-inline">CMV alvo <input id="cmv" type="number" min="1" max="100" step="1" value="${cmv}"/> %</label>
        </div>
        <p class="muted">Custo dos ingredientes de cada porção, pelo preço da última compra. O preço sugerido (custo ÷ CMV) só aparece quando todos os ingredientes do lanche têm custo. Não inclui tempero, óleo, embalagem e gás.</p>
        <div class="tabela-wrap"><table class="tabela-compras">
          <thead><tr><th>Lanche</th><th class="num">Custo dos ingredientes</th><th class="num">Preço atual</th><th class="num">CMV atual</th><th class="num">Preço sugerido</th><th>Falta definir</th></tr></thead>
          <tbody id="custo-lanches"></tbody>
        </table></div>
      </div>`;

    const atualizar = () => {
      let tot = 0, algum = false;
      box.querySelectorAll(".qtd-proxima").forEach((inp) => {
        const it = c.itens[inp.dataset.i];
        const q = parseFloat(String(inp.value).replace(",", "."));
        const cel = box.querySelector(`[data-previsto="${inp.dataset.i}"]`);
        if (q > 0) { const v = q * custoUnidade(it); tot += v; algum = true; cel.textContent = reais(v); }
        else cel.textContent = "–";
      });
      $("total-previsto").textContent = algum ? reais(tot) : "–";
      $("total-previsto-tab").textContent = algum ? reais(tot) : "–";

      const peso = parseFloat($("peso-carne").value);
      const alvo = parseFloat($("cmv").value) / 100;
      $("custo-lanches").innerHTML = dados.lanches.map((l) => {
        let custo = 0; const falta = [];
        (c.ficha[l.id] || []).forEach(([prod, porc]) => {
          let q = porc;
          if (porc === "CARNE") q = peso > 0 ? peso : null;
          if (porc === "CARNE2") q = peso > 0 ? 2 * peso : null;
          const it = c.itens.find((x) => x.produto === prod);
          const unit = it ? custoBase(it) : null;
          if (q == null || unit == null) { falta.push(porc === "CARNE" || porc === "CARNE2" ? "peso do hambúrguer" : prod + (it ? (unit == null ? " (peso da embalagem)" : " (porção)") : " (cotar)")); return; }
          custo += q * unit;
        });
        const completo = falta.length === 0;
        const pv = l.preco ?? c.precos?.[l.id];
        return `<tr><td><b>${l.id}. ${esc(l.codinome || l.nome)}</b> <span class="obs">${esc(l.nome)}</span></td>
          <td class="num" data-rot="Custo">${reais(custo)}${completo ? "" : ' <span class="obs">(parcial)</span>'}</td>
          <td class="num" data-rot="Preço atual">${pv ? reais(pv) : "–"}</td>
          <td class="num" data-rot="CMV atual">${completo && pv ? `<b class="${custo / pv > alvo ? "cmv-alto" : "cmv-ok"}">${num((100 * custo) / pv)}%</b>` : "–"}</td>
          <td class="num" data-rot="Preço sugerido">${completo && alvo > 0 ? `<b>${reais(custo / alvo)}</b>` : "–"}</td>
          <td class="falta" data-rot="Falta">${completo ? '<span class="ok-tag">completo</span>' : `<span class="obs">${esc([...new Set(falta)].join(", "))}</span>`}</td></tr>`;
      }).join("");
    };
    box.querySelectorAll(".qtd-proxima").forEach((inp) => inp.addEventListener("input", () => {
      const m = ler("ep_proxima_compra", {}); const it = c.itens[inp.dataset.i];
      if (inp.value === "") delete m[it.produto]; else m[it.produto] = inp.value;
      gravar("ep_proxima_compra", m); atualizar();
    }));
    $("peso-carne").addEventListener("input", (e) => { gravar("ep_peso_carne", e.target.value); atualizar(); });
    $("cmv").addEventListener("input", (e) => { gravar("ep_cmv", e.target.value); atualizar(); });
    atualizar();
  }

  $("btn-compras-xlsx").addEventListener("click", () => {
    if (!compras) return toast("Abra a aba Compras primeiro", true);
    if (!window.XLSX) return toast("Não foi possível carregar o gerador de Excel", true);
    const proxima = ler("ep_proxima_compra", {});
    const linhas = compras.itens.map((it) => {
      const q = parseFloat(String(proxima[it.produto] ?? "").replace(",", "."));
      return {
        "Produto": it.produto, "Categoria": it.categoria, "Unidade de compra": it.unidade,
        "Qtd comprada": it.qtd, "Pago (R$)": it.custo, "Custo por unidade (R$)": +custoUnidade(it).toFixed(4),
        "Próxima compra (qtd)": q > 0 ? q : "", "Previsto (R$)": q > 0 ? +(q * custoUnidade(it)).toFixed(2) : "",
        "Observação": it.obs || "",
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Insumos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras.cotar.map((x) => ({ "Produto": x.produto, "Para": x.motivo }))), "A cotar");
    XLSX.writeFile(wb, `compras-escritorio-${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  // Imprimir só a aba escolhida
  document.querySelectorAll("[data-imprimir]").forEach((b) => b.addEventListener("click", () => {
    document.body.dataset.imprimir = b.dataset.imprimir;
    window.print();
  }));
  window.addEventListener("afterprint", () => { delete document.body.dataset.imprimir; });

  // ---------- Cozinha (PDF do processo, só no painel) ----------
  let pdfUrl = null, pdfNome = "processo-cozinha.pdf";

  function pdfDeBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "application/pdf" });
  }

  async function carregarProcesso() {
    $("erro-pdf").textContent = "";
    $("pdf-info").textContent = "Carregando…";
    try {
      const r = await rpc("admin_processo", { p_senha: senha });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      pdfUrl = null;
      if (!r) {
        $("pdf-info").textContent = "Nenhum PDF enviado ainda. Use \"Enviar ou atualizar PDF\".";
        $("pdf-visor").classList.add("escondido");
        return;
      }
      pdfNome = r.nome;
      pdfUrl = URL.createObjectURL(pdfDeBase64(r.pdf));
      $("pdf-info").textContent = r.atualizado_em
        ? `Atualizado em ${new Date(r.atualizado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. Só aparece para quem tem a senha do painel.`
        : "Só aparece para quem tem a senha do painel.";
      $("pdf-visor").src = pdfUrl;
      $("pdf-visor").classList.remove("escondido");
    } catch (e) {
      $("pdf-info").textContent = "";
      $("erro-pdf").textContent = e.message;
    }
  }

  $("btn-pdf-baixar").addEventListener("click", () => {
    if (!pdfUrl) return toast("Nenhum PDF enviado ainda", true);
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfNome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $("pdf-arquivo").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast("PDF muito grande (máx. 3 MB)", true);
    $("erro-pdf").textContent = "";
    $("pdf-info").textContent = "Enviando…";
    try {
      const b64 = await new Promise((ok, erro) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(String(leitor.result).split(",")[1]);
        leitor.onerror = () => erro(new Error("Não foi possível ler o arquivo"));
        leitor.readAsDataURL(f);
      });
      await rpc("admin_processo_salvar", { p_senha: senha, p_pdf: b64, p_nome: f.name });
      toast("PDF salvo ✓");
      await carregarProcesso();
    } catch (e) {
      $("pdf-info").textContent = "";
      $("erro-pdf").textContent = e.message;
    }
  });

  // ---------- Link ----------
  function renderLink() {
    const url = new URL("./", location.href).href;
    $("link-publico").textContent = url;
    const msg = `Oi! Me ajuda a escolher os lanches do Escritório Petiscos & Cia? Prove e dê sua nota por aqui: ${url}`;
    $("btn-whats").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    const garcom = new URL("garcom", url).href;
    $("link-garcom").textContent = garcom;
    $("btn-garcom").href = garcom;
  }
  $("btn-copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("link-publico").textContent); toast("Link copiado ✓"); }
    catch (e) { toast("Selecione e copie o link manualmente", true); }
  });

  // ---------- Início ----------
  (async function () {
    let salva = null;
    try { salva = sessionStorage.getItem(CHAVE_SENHA); } catch (e) {}
    if (salva) {
      try { await carregar(salva); abrirApp(); } catch (e) { try { sessionStorage.removeItem(CHAVE_SENHA); } catch (_) {} }
    }
  })();
})();
