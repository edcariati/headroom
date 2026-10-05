import { $, $$, api, toast } from './util.js';
import { formLancamento, formTransferencia } from './forms.js';
import * as V from './views.js';

const ROTAS = {
  resumo: ['Resumo', (el) => V.resumo(el)],
  pagamentos: ['Pagamentos do cliente', (el) => V.pagamentos(el)],
  receitas: ['Receitas', (el, q) => V.lista(el, 'receita', q)],
  despesas: ['Despesas', (el, q) => V.lista(el, 'despesa', q)],
  transferencias: ['Transferências', (el) => V.transferencias(el)],
  contas: ['Contas e extratos', (el, q) => V.contas(el, q)],
  fluxo: ['Fluxo de caixa', (el) => V.fluxo(el)],
  dre: ['DRE gerencial', (el) => V.dre(el)],
  resultados: ['Resultados', (el, q) => V.resultados(el, q)],
  outros: ['Outros relatórios', (el) => V.outros(el)],
  cadastros: ['Cadastros', (el, q) => V.cadastrosView(el, q)],
};
const NAV = [['Financeiro', ['resumo', 'pagamentos', 'receitas', 'despesas', 'transferencias', 'contas']], ['Relatórios', ['fluxo', 'dre', 'resultados', 'outros']], ['Configurações', ['cadastros']]];

$('#nav').innerHTML = NAV.map(([g, itens]) => `<div class="nav-grupo">${g}</div>${itens.map((k) => `<a class="nav-link" href="#/${k}" data-k="${k}">${ROTAS[k][0]}</a>`).join('')}`).join('');

function rota() {
  const [caminho, query = ''] = (location.hash.slice(2) || 'resumo').split('?');
  return { chave: ROTAS[caminho] ? caminho : 'resumo', query: Object.fromEntries(new URLSearchParams(query)) };
}

let seq = 0;
async function render() {
  const { chave, query } = rota();
  const [titulo, fn] = ROTAS[chave];
  $('#titulo').textContent = titulo;
  document.title = `${titulo} · Financeiro interno`;
  $$('.nav-link').forEach((a) => a.classList.toggle('ativo', a.dataset.k === chave));
  $('#side').classList.remove('aberto');
  const el = $('#conteudo');
  const minha = ++seq;
  try {
    await fn(el, query);
  } catch (e) {
    if (minha === seq) el.innerHTML = `<div class="vazio">Não foi possível carregar esta tela: ${e.message}</div>`;
  }
}
window.addEventListener('hashchange', render);

$('#menu-btn').onclick = () => $('#side').classList.toggle('aberto');
$('#novo-btn').onclick = (e) => { e.stopPropagation(); $('#novo-menu').hidden = !$('#novo-menu').hidden; };
document.addEventListener('click', () => { $('#novo-menu').hidden = true; });
$('#novo-menu').onclick = (e) => {
  const t = e.target.dataset.novo;
  if (!t) return;
  const depois = () => 
// ---------- acesso por senha ----------
function telaLogin() {
  document.body.classList.add('login');
  $('#conteudo').innerHTML = `<form class="login-card" id="login-form">
    <img class="login-logo" src="logo-cariati.png" alt="Cariati Arquitetura &amp; Gestão"><h2>Financeiro interno</h2><p class="suave">Acesso restrito. Digite a senha.</p>
    <input class="campo" type="password" name="senha" autocomplete="current-password" placeholder="Senha" required autofocus aria-label="Senha">
    <div class="erro" role="alert"></div><button class="btn primary" type="submit">Entrar</button></form>`;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const botao = $('button', e.target);
    botao.disabled = true;
    try {
      await api('login', { method: 'POST', body: { senha: e.target.senha.value } });
      document.body.classList.remove('login');
      render();
    } catch (err) {
      $('.erro', e.target).textContent = err.message;
      botao.disabled = false;
      e.target.senha.select();
    }
  };
}
window.addEventListener('sem-sessao', telaLogin);
$('#sair').onclick = async () => { await api('logout', { method: 'POST' }).catch(() => {}); telaLogin(); };

(async () => {
  try {
    const s = await api('sessao');
    $('#sair').hidden = !s.exige_senha;
    if (!s.autenticado) return telaLogin();
  } catch (e) {
    $('#conteudo').innerHTML = `<div class="vazio">Não foi possível conectar ao sistema: ${e.message}</div>`;
    return;
  }
  render();
})();
  (t === 'transferencia' ? formTransferencia(depois) : formLancamento(t, depois)).catch((err) => toast(err.message, true));
};

// ---------- acesso por senha ----------
function telaLogin() {
  document.body.classList.add('login');
  $('#conteudo').innerHTML = `<form class="login-card" id="login-form">
    <img class="login-logo" src="logo-cariati.png" alt="Cariati Arquitetura &amp; Gestão"><h2>Financeiro interno</h2><p class="suave">Acesso restrito. Digite a senha.</p>
    <input class="campo" type="password" name="senha" autocomplete="current-password" placeholder="Senha" required autofocus aria-label="Senha">
    <div class="erro" role="alert"></div><button class="btn primary" type="submit">Entrar</button></form>`;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const botao = $('button', e.target);
    botao.disabled = true;
    try {
      await api('login', { method: 'POST', body: { senha: e.target.senha.value } });
      document.body.classList.remove('login');
      render();
    } catch (err) {
      $('.erro', e.target).textContent = err.message;
      botao.disabled = false;
      e.target.senha.select();
    }
  };
}
window.addEventListener('sem-sessao', telaLogin);
$('#sair').onclick = async () => { await api('logout', { method: 'POST' }).catch(() => {}); telaLogin(); };

(async () => {
  try {
    const s = await api('sessao');
    $('#sair').hidden = !s.exige_senha;
    if (!s.autenticado) return telaLogin();
  } catch (e) {
    $('#conteudo').innerHTML = `<div class="vazio">Não foi possível conectar ao sistema: ${e.message}</div>`;
    return;
  }
  render();
})();
