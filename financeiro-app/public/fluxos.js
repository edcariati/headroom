// Fluxos: os passos que o financeiro entrega, com o que está pendente em cada um e os registros que o fluxo pede
// (contato de cobrança, conferência com o extrato e entrega do relatório quinzenal).
import { $, api, brl, dataBR, esc, hojeISO, modal, opcoes, parseDinheiro, toast } from './util.js';
import { animarContadores, gauge, icon, kpi, revelar, skeletonPagina } from './ui.js';

const CANAIS = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail', presencial: 'Presencial', outro: 'Outro' };
export const nomeCanal = (c) => CANAIS[c] || c;

export function formContato({ pessoa_id, nome, parcela_id = null }, aoSalvar) {
  modal('Registrar contato', `<p class="suave">Cliente: <b>${esc(nome)}</b></p>
    <div class="linha2"><label class="f">Data *<input class="campo" type="date" name="data" value="${hojeISO()}" required></label>
      <label class="f">Canal<select class="campo" name="canal">${Object.entries(CANAIS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></label></div>
    <label class="f">Resposta do cliente ou combinado *<textarea class="campo" name="resposta" rows="3" required placeholder="Ex.: Vai pagar na sexta, pediu o boleto de novo"></textarea></label>`, {
    rotulo: 'Registrar',
    onSubmit: async (d) => {
      await api('contatos', { method: 'POST', body: { pessoa_id, parcela_id, data: d.data, canal: d.canal, resposta: d.resposta } });
      toast('Contato registrado.');
      aoSalvar?.();
    },
  });
}

export function formConferencia(contas, contaId, aoSalvar) {
  modal('Conferir conta com o extrato', `
    <label class="f">Conta *<select class="campo" name="conta_id" required>${opcoes(contas, contaId, 'Escolha…')}</select></label>
    <div class="linha2"><label class="f">Data do extrato *<input class="campo" type="date" name="data" value="${hojeISO()}" required></label>
      <label class="f">Saldo no extrato do banco (R$) *<input class="campo" name="saldo" inputmode="decimal" required placeholder="0,00" autocomplete="off"></label></div>
    <label class="f">Explicação da diferença<textarea class="campo" name="observacao" rows="2" placeholder="Só é obrigatória se o saldo do banco for diferente do aplicativo"></textarea></label>
    <p class="suave">O aplicativo calcula o saldo da conta até a data e compara com o extrato.</p>`, {
    rotulo: 'Registrar conferência',
    onSubmit: async (d) => {
      const saldo = parseDinheiro(d.saldo);
      if (saldo === null) throw new Error('Informe o saldo do extrato, como 12.345,67.');
      const r = await api('conferencias', { method: 'POST', body: { conta_id: d.conta_id, data: d.data, saldo_banco_cents: saldo, observacao: d.observacao } });
      toast(r.diferenca_cents === 0 ? 'Conta conferida: saldo igual ao extrato.' : `Conferência registrada com diferença de ${brl(r.diferenca_cents)}.`);
      aoSalvar?.();
    },
  });
}

export function formEntrega(aoSalvar) {
  modal('Relatório quinzenal entregue', `<p class="suave">Registre que o fluxo de caixa, a DRE, os resultados e a lista de atrasos foram entregues ao diretor.</p>
    <label class="f">Data da entrega *<input class="campo" type="date" name="data" value="${hojeISO()}" required></label>
    <label class="f">Observação<textarea class="campo" name="observacao" rows="2" placeholder="Ex.: Enviado por e-mail e apresentado na reunião"></textarea></label>`, {
    rotulo: 'Registrar entrega',
    onSubmit: async (d) => { await api('entregas', { method: 'POST', body: { data: d.data, observacao: d.observacao } }); toast('Entrega registrada.'); aoSalvar?.(); },
  });
}

const CAMINHO = [['Cliente fechou', ''], ['Cadastro do cliente', ''], ['Projeto e serviços', ''], ['Receita e parcelas', ''], ['Cobrança', ''], ['Pagou no prazo?', 'dec'], ['Baixa do recebimento', ''], ['Conciliação e relatório', 'fim']];

export async function fluxosView(el) {
  window.dispatchEvent(new CustomEvent('crumbs', { detail: ['Financeiro', 'Fluxos'] }));
  if (el.dataset.tela !== 'fx') el.innerHTML = skeletonPagina();
  const r = await api('fluxos');
  el.dataset.tela = 'fx';
  const perc = (r.em_dia / r.total) * 100;
  const dataKpi = (rotulo, ic, iso) => `<div class="kpi reveal"><span class="kpi-topo"><span class="kpi-rot">${icon(ic)}${rotulo}</span></span><span class="kpi-val">${iso ? dataBR(iso) : '—'}</span></div>`;
  const ult = (k) => r.passos.find((p) => p.chave === k)?.ultimo;
  const acao = (p) => ({
    acompanhamento: `<a class="btn btn-sm" href="#/areceber">${icon('alvo')}Abrir A receber</a>`,
    conciliacao: `<button class="btn btn-sm" type="button" data-conferir>${icon('check')}Registrar conferência</button>`,
    relatorio: `<button class="btn btn-sm" type="button" data-entrega>${icon('check')}Marcar como entregue</button>`,
  }[p.chave] || '');
  const cartao = (p) => `<article class="glass painel reveal passo-fluxo${p.pendencias ? ' com-pendencia' : ''}">
    <header class="passo-fluxo-topo"><span class="orb" style="width:44px;height:44px"><b style="font-size:.95rem">${p.n}</b></span>
      <div class="passo-fluxo-nome"><strong>${esc(p.nome)}</strong><small>${esc(p.quando)}</small></div>
      ${p.pendencias ? `<span class="chip s-a_vencer">${icon('alert')}${p.pendencias} pendência${p.pendencias === 1 ? '' : 's'}</span>` : `<span class="chip s-pago">${icon('check')}Em dia</span>`}</header>
    <p style="margin:var(--s3) 0">${esc(p.entrega)}</p>
    ${p.itens.length ? `<ul class="lista passo-fluxo-itens">${p.itens.map((i) => `<li><span>${esc(i)}</span></li>`).join('')}${p.pendencias > p.itens.length ? `<li><span class="suave">e mais ${p.pendencias - p.itens.length}…</span></li>` : ''}</ul>` : ''}
    <div class="passo-fluxo-acoes"><a class="btn btn-sm" href="#/${p.onde.rota}">${esc(p.onde.rotulo)}</a>${acao(p)}
      ${p.ultimo_rotulo ? `<span class="suave">${esc(p.ultimo_rotulo)}: ${p.ultimo ? dataBR(p.ultimo) : 'nenhum registro'}</span>` : ''}</div></article>`;

  el.innerHTML = `
    <div class="grade g-destaque">
      <section class="glass painel hero mira reveal" style="display:grid;place-items:center">${gauge({ pct: perc, rotulo: 'Passos em dia', valor: `<span data-count="${perc}" data-fmt="pct">${perc.toFixed(0)}%</span>`, sub: `${r.em_dia} de ${r.total} passos`, cor: r.pendencias ? 'amber' : 'violet', ariaLabel: `${r.em_dia} de ${r.total} passos do fluxo em dia` })}</section>
      <div class="grade-kpi" style="align-content:center">
        ${kpi({ rotulo: 'Pendências', icone: 'alert', valor: r.pendencias, cor: r.pendencias ? 'laranja' : 'verde', formato: 'int' })}
        ${dataKpi('Último contato', 'raio', ult('acompanhamento'))}
        ${dataKpi('Última conferência', 'banco', ult('conciliacao'))}
        ${dataKpi('Último relatório', 'fluxo', ult('relatorio'))}
      </div></div>
    <section class="glass painel reveal" style="margin-top:var(--s4)"><h3>Caminho do contrato ao caixa</h3>
      <div class="caminho">${CAMINHO.map(([t, k], i) => `<span class="caminho-passo${k ? ' ' + k : ''}"><i>${i + 1}</i>${esc(t)}</span>`).join('')}</div>
      <p class="suave" style="margin-top:var(--s3)">Se não pagou: o cliente vai para o topo de A receber, o financeiro cobra e registra o contato, e a projeção de caixa mostra o que compensar.</p></section>
    <h2 style="margin:var(--s6) 0 var(--s3)">O que o financeiro entrega em cada passo</h2>
    <div class="empilha">${r.passos.map(cartao).join('')}</div>`;
  const recarregar = () => fluxosView(el);
  el.onclick = (e) => {
    if (e.target.closest('[data-conferir]')) return formConferencia(r.contas, '', recarregar);
    if (e.target.closest('[data-entrega]')) return formEntrega(recarregar);
  };
  revelar(el); animarContadores(el);
}
