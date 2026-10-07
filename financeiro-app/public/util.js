import { icon } from './ui.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '-');
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const STATUS = { pago: 'Pago', vencido: 'Vencido', vence_hoje: 'Vence hoje', a_vencer: 'A vencer', em_aberto: 'Em aberto' };
export const rotuloMes = (aaaamm) => { const [a, m] = aaaamm.split('-'); return `${MES_CURTO[Number(m) - 1]}/${a.slice(2)}`; };

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
export async function api(caminho, { method = 'GET', body, keepalive = false } = {}) {
  const r = await fetch(urlApi(caminho), {
    method, keepalive, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && !caminho.startsWith('login')) window.dispatchEvent(new Event('sem-sessao'));
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}
export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

// Aviso rápido. toast('texto'), toast('texto', true) ou toast('texto', { tipo, acao: { rotulo, fn }, duracao }).
export function toast(msg, opcoes = {}) {
  const o = typeof opcoes === 'boolean' ? { tipo: opcoes ? 'erro' : 'ok' } : opcoes === 'erro' ? { tipo: 'erro' } : opcoes;
  const tipo = o.tipo || 'ok';
  const dur = o.duracao || (tipo === 'erro' ? 7000 : 3600);
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `${icon(tipo === 'erro' ? 'alert' : tipo === 'info' ? 'info' : 'check')}<span>${esc(msg)}</span>${o.acao ? `<button class="toast-acao">${esc(o.acao.rotulo)}</button>` : ''}<i class="barra-tempo" style="animation-duration:${dur}ms"></i>`;
  $('#toasts').append(el);
  const fechar = () => el.remove();
  const t = setTimeout(fechar, dur);
  if (o.acao) $('.toast-acao', el).onclick = () => { clearTimeout(t); fechar(); o.acao.fn(); };
}

// Exclusão com "Desfazer": esconde na hora, só chama o servidor depois de alguns segundos.
const pendentes = new Set();
export function excluirComDesfazer({ aviso, executar, ocultar, restaurar, depois }) {
  ocultar();
  let feito = false;
  const rodar = async (keepalive) => {
    if (feito) return;
    feito = true; pendentes.delete(rodar);
    try { await executar(keepalive); depois?.(); } catch (e) { restaurar(); toast(e.message, 'erro'); }
  };
  pendentes.add(rodar);
  const t = setTimeout(() => rodar(false), 7000);
  toast(aviso, { tipo: 'info', duracao: 7000, acao: { rotulo: 'Desfazer', fn: () => { clearTimeout(t); feito = true; pendentes.delete(rodar); restaurar(); toast('Exclusão desfeita.'); } } });
}
window.addEventListener('pagehide', () => pendentes.forEach((f) => f(true)));

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
  return `<div class="pilula-vidro" role="group" aria-label="Período">${icon('calendar')}
    <input class="campo" type="date" name="de" value="${p.de}" aria-label="Data inicial"><span class="suave" aria-hidden="true">→</span>
    <input class="campo" type="date" name="ate" value="${p.ate}" aria-label="Data final">
    <select class="campo" name="atalho" aria-label="Atalho de período"><option value="">Atalhos</option><option value="mes">Este mês</option>
    <option value="ano">Este ano</option><option value="passado">Ano passado</option><option value="90">Últimos 90 dias</option></select></div>`;
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

// Rascunho dos formulários: o que foi digitado fica guardado no navegador até salvar ou descartar.
const RASC_VALIDADE_MS = 7 * 24 * 3600 * 1000;
const lerRasc = (k) => { try { const r = JSON.parse(localStorage.getItem(k)); return r && Date.now() - r.t < RASC_VALIDADE_MS ? r : null; } catch { return null; } };
const gravarRasc = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
const apagarRasc = (k) => { try { localStorage.removeItem(k); } catch { /* sem storage */ } };
function coletar(form) {
  const v = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'password' || el.type === 'file' || el.type === 'submit' || el.type === 'button') continue;
    if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; } else if (el.type === 'checkbox') v[el.name] = el.checked; else v[el.name] = el.value;
  }
  return v;
}
function aplicar(form, v) {
  for (const [nome, valor] of Object.entries(v)) {
    const els = [...form.elements].filter((e) => e.name === nome);
    for (const el of els) {
      if (el.type === 'radio') el.checked = el.value === valor;
      else if (el.type === 'checkbox') el.checked = !!valor;
      else if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === valor)) continue;
      else el.value = valor;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

// Modal (vira "bottom sheet" no celular). onSubmit(dados) pode lançar erro: a mensagem aparece no formulário.
// chave: identifica o rascunho (inclua o id ao editar um registro); chave: false desliga o rascunho.
export function modal(titulo, corpo, { onSubmit, rotulo = 'Salvar', pequeno = false, rodape = null, classe = '', perigo = false, chave, proteger = false } = {}) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog" class="folha ${classe}" novalidate>
    <div class="folha-topo"><h2>${esc(titulo)}</h2><button type="button" class="icon-btn" data-fechar aria-label="Fechar">${icon('x')}</button></div>
    <div class="folha-corpo">${corpo}<div class="erro" role="alert"></div></div>
    <div class="folha-rodape">${rodape ?? `<button type="button" class="btn btn-ghost" data-fechar>Cancelar</button>${onSubmit ? `<button class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" type="submit">${esc(rotulo)}</button>` : ''}`}</div></form>`;
  if (pequeno) dlg.style.width = 'min(440px, calc(100vw - 24px))';
  document.body.append(dlg);
  const form = $('form', dlg);
  const rascunho = onSubmit && chave !== false && !(chave === undefined && /^Editar/.test(titulo)) ? `rasc:${chave ?? titulo}` : null;
  let sujo = false, extra = null, tmr = null, fim = false;
  const salvar = () => {
    if (!rascunho || fim) return;
    clearTimeout(tmr);
    const v = coletar(form);
    gravarRasc(rascunho, { t: Date.now(), v, x: extra?.ler?.() ?? null, passo: extra?.passo?.() ?? null });
  };
  const agendar = () => { sujo = true; clearTimeout(tmr); tmr = setTimeout(salvar, 350); };
  let restaurado = rascunho ? lerRasc(rascunho) : null;
  const aviso = () => {
    const el = document.createElement('div');
    el.className = 'aviso-rascunho';
    el.innerHTML = `${icon('info')}<span style="flex:1">Rascunho recuperado: você pode continuar de onde parou.</span><button type="button" class="btn btn-ghost btn-sm" data-descartar>Descartar</button>`;
    $('.folha-corpo', dlg).prepend(el);
    $('[data-descartar]', el).onclick = () => { fim = true; apagarRasc(rascunho); sujo = false; clearTimeout(tmr); fechar(true); toast('Rascunho descartado.'); };
  };
  if (restaurado) { aplicar(form, restaurado.v); sujo = true; aviso(); }
  form.addEventListener('input', agendar);
  form.addEventListener('change', agendar);
  const fechar = (sem = false) => {
    if (!sem && sujo && rascunho) { salvar(); toast('Rascunho guardado. Abra de novo para continuar de onde parou.', { tipo: 'info' }); }
    window.removeEventListener('pagehide', salvar);
    dlg.close(); dlg.remove();
  };
  $$('[data-fechar]', dlg).forEach((b) => { b.onclick = () => fechar(); });
  // clicar fora ou apertar Esc com algo digitado não fecha: evita perder o que está na tela
  const protegido = () => { if (!sujo || !(rascunho || proteger)) return false; dlg.classList.remove('chacoalha'); void dlg.offsetWidth; dlg.classList.add('chacoalha'); return true; };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (!protegido()) fechar(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && !protegido()) fechar(); });
  window.addEventListener('pagehide', salvar);
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return fechar();
    if (!form.checkValidity()) {
      const inv = form.querySelector(':invalid');
      inv.setAttribute('aria-invalid', 'true');
      inv.addEventListener('input', () => inv.removeAttribute('aria-invalid'), { once: true });
      inv.focus();
      $('.erro', dlg).innerHTML = `${icon('alert')}<span>Preencha os campos obrigatórios (*).</span>`;
      return;
    }
    const botao = $('button[type=submit]', dlg);
    if (botao) botao.disabled = true;
    try {
      const dados = Object.fromEntries(new FormData(form));
      $$('input[type=checkbox]', form).forEach((c) => { dados[c.name] = c.checked; });
      await onSubmit(dados, form);
      fim = true; clearTimeout(tmr);
      if (rascunho) apagarRasc(rascunho);
      sujo = false;
      fechar(true);
    } catch (err) {
      $('.erro', dlg).innerHTML = `${icon('alert')}<span>${esc(err.message)}</span>`;
      if (botao) botao.disabled = false;
    }
  };
  dlg.showModal();
  return {
    fechar: () => fechar(true), dlg, salvarRascunho: agendar,
    // editores próprios (lista de serviços, etapa atual...) entram no rascunho: { ler, aplicar, passo, irPasso }
    definirExtra(obj) {
      extra = obj;
      if (restaurado) { if (restaurado.x != null) obj.aplicar?.(restaurado.x); if (restaurado.passo != null) obj.irPasso?.(restaurado.passo); restaurado = null; }
    },
  };
}

export function confirmar(msg, rotulo = 'Excluir') {
  return new Promise((resolve) => {
    let ok = false;
    const m = modal('Confirmar ação', `<p>${esc(msg)}</p><p class="suave">Você poderá desfazer por alguns segundos.</p>`, { onSubmit: async () => { ok = true; }, rotulo, pequeno: true, perigo: true, chave: false });
    m.dlg.addEventListener('close', () => resolve(ok));
  });
}

export const opcoes = (lista, sel, vazio = '—', rot = (x) => x.nome) =>
  `<option value="">${esc(vazio)}</option>${lista.map((x) => `<option value="${x.id}"${String(sel) === String(x.id) ? ' selected' : ''}>${esc(rot(x))}</option>`).join('')}`;
