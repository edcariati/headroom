export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '-');
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const STATUS = { pago: 'Pago', vencido: 'Vencido', vence_hoje: 'Vence hoje', a_vencer: 'A vencer', em_aberto: 'Em aberto' };

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "1.234,56" -> 123456 (centavos). Retorna null se não for um número válido.
export function parseDinheiro(txt) {
  const s = String(txt ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const dinheiroInput = (c) => (c / 100).toFixed(2).replace('.', ',');

// Todas as chamadas vão para a mesma função: /api/app?rota=<caminho>&<filtros>
export const urlApi = (caminho) => {
  const [rota, resto] = caminho.split('?');
  return `/api/app?${new URLSearchParams({ rota })}${resto ? '&' + resto : ''}`;
};
export async function api(caminho, { method = 'GET', body } = {}) {
  const r = await fetch(urlApi(caminho), {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && !caminho.startsWith('login')) window.dispatchEvent(new Event('sem-sessao'));
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}
export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

export function toast(msg, erro = false) {
  const el = document.createElement('div');
  el.className = `toast${erro ? ' erro' : ''}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), erro ? 6000 : 3000);
}

// Período global (guardado no navegador, se possível).
const anoAtual = new Date().getFullYear();
let periodo = { de: `${anoAtual}-01-01`, ate: `${anoAtual}-12-31` };
try { periodo = JSON.parse(localStorage.getItem('periodo')) || periodo; } catch { /* sem storage */ }
export const getPeriodo = () => ({ ...periodo });
export function setPeriodo(p) {
  periodo = { ...p };
  try { localStorage.setItem('periodo', JSON.stringify(periodo)); } catch { /* sem storage */ }
}
export function controlePeriodo(p) {
  return `<span class="barra" style="margin:0"><input class="campo" type="date" name="de" value="${p.de}" aria-label="Data inicial">
    <span class="suave">até</span><input class="campo" type="date" name="ate" value="${p.ate}" aria-label="Data final">
    <select class="campo" name="atalho" aria-label="Atalho de período"><option value="">Atalhos</option><option value="mes">Este mês</option>
    <option value="ano">Este ano</option><option value="passado">Ano passado</option><option value="90">Últimos 90 dias</option></select></span>`;
}
export function ligarPeriodo(raiz, aoMudar) {
  const de = $('[name=de]', raiz), ate = $('[name=ate]', raiz), atalho = $('[name=atalho]', raiz);
  const aplicar = () => { if (de.value && ate.value && de.value <= ate.value) { setPeriodo({ de: de.value, ate: ate.value }); aoMudar(); } };
  de.onchange = ate.onchange = aplicar;
  atalho.onchange = () => {
    const h = new Date(), a = h.getFullYear(), m = h.getMonth();
    const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const mapa = {
      mes: [f(new Date(a, m, 1)), f(new Date(a, m + 1, 0))], ano: [`${a}-01-01`, `${a}-12-31`],
      passado: [`${a - 1}-01-01`, `${a - 1}-12-31`], 90: [f(new Date(Date.now() - 90 * 864e5)), f(h)],
    };
    if (!mapa[atalho.value]) return;
    [de.value, ate.value] = mapa[atalho.value];
    aplicar();
  };
}

// Modal baseado em <dialog>. onSubmit(dados) pode lançar erro: a mensagem aparece no formulário.
export function modal(titulo, corpo, { onSubmit, rotulo = 'Salvar', pequeno = false } = {}) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog"><h2>${esc(titulo)}</h2>${corpo}<div class="erro" role="alert"></div>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button>${onSubmit ? `<button class="btn primary" type="submit">${esc(rotulo)}</button>` : ''}</div></form>`;
  if (pequeno) dlg.style.width = 'min(420px, calc(100vw - 24px))';
  document.body.append(dlg);
  const fechar = () => { dlg.close(); dlg.remove(); };
  $('[data-fechar]', dlg).onclick = fechar;
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  const form = $('form', dlg);
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return fechar();
    const botao = $('button[type=submit]', dlg);
    botao.disabled = true;
    try {
      const dados = Object.fromEntries(new FormData(form));
      $$('input[type=checkbox]', form).forEach((c) => { dados[c.name] = c.checked; });
      await onSubmit(dados, form);
      fechar();
    } catch (err) {
      $('.erro', dlg).textContent = err.message;
      botao.disabled = false;
    }
  };
  dlg.showModal();
  return { fechar, dlg };
}

export function confirmar(msg, rotulo = 'Excluir') {
  return new Promise((resolve) => {
    const m = modal('Confirmar', `<p>${esc(msg)}</p>`, { onSubmit: async () => resolve(true), rotulo, pequeno: true });
    m.dlg.addEventListener('close', () => resolve(false));
  });
}

export const opcoes = (lista, sel, vazio = '—', rot = (x) => x.nome) =>
  `<option value="">${esc(vazio)}</option>${lista.map((x) => `<option value="${x.id}"${String(sel) === String(x.id) ? ' selected' : ''}>${esc(rot(x))}</option>`).join('')}`;

// Gráfico de barras em SVG. barras = [{rotulo, partes:[{valor, classe}]}]. Aceita valores negativos (resultado).
export function grafico(barras, { altura = 240 } = {}) {
  const W = 940, H = altura, pl = 64, pr = 8, pt = 22, pb = 26;
  const pos = barras.map((b) => b.partes.filter((p) => p.valor > 0).reduce((s, p) => s + p.valor, 0));
  const neg = barras.map((b) => b.partes.filter((p) => p.valor < 0).reduce((s, p) => s + p.valor, 0));
  const max = Math.max(1, ...pos), min = Math.min(0, ...neg);
  const y = (v) => pt + ((max - v) / (max - min)) * (H - pt - pb);
  const larg = (W - pl - pr) / Math.max(barras.length, 1);
  const bw = Math.min(46, larg * 0.62);
  const curto = (c) => { const v = c / 100; const a = Math.abs(v); return `${v < 0 ? '-' : ''}${a >= 1e6 ? (a / 1e6).toFixed(1) + ' mi' : a >= 1e3 ? Math.round(a / 1e3) + ' mil' : Math.round(a)}`; };
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  let svg = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras mensal">`;
  for (const t of ticks) svg += `<line class="grade" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${curto(t)}</text>`;
  barras.forEach((b, i) => {
    const x = pl + larg * i + (larg - bw) / 2;
    let acima = 0, abaixo = 0;
    for (const p of b.partes) {
      if (!p.valor) continue;
      const topo = p.valor > 0 ? acima + p.valor : abaixo;
      const base = p.valor > 0 ? acima : abaixo + p.valor;
      svg += `<rect x="${x}" y="${y(topo)}" width="${bw}" height="${Math.max(1, y(base) - y(topo))}" rx="2" fill="${p.cor}"><title>${esc(b.rotulo)}: ${brl(p.valor)}</title></rect>`;
      if (p.valor > 0) acima += p.valor; else abaixo += p.valor;
    }
    const total = acima + abaixo;
    if (total) svg += `<text x="${x + bw / 2}" y="${(total >= 0 ? y(acima) : y(abaixo)) + (total >= 0 ? -5 : 13)}" text-anchor="middle">${curto(total)}</text>`;
    svg += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(b.rotulo)}</text>`;
  });
  return svg + '</svg>';
}
export const CORES = { pago: 'var(--pago)', atrasado: 'var(--atraso)', previsto: 'var(--previsto)', azul: 'var(--azul)', verde: 'var(--verde)', vermelho: 'var(--vermelho)' };
export const rotuloMes = (aaaamm) => { const [a, m] = aaaamm.split('-'); return `${MES_CURTO[Number(m) - 1]}/${a.slice(2)}`; };
