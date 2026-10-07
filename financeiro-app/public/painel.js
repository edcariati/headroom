// Visão do diretor, dentro do Resumo: crescimento, atrasos, caixa dos próximos 12 meses, contratos parcelados e efeito no DRE.
import { brl, dataBR, esc, rotuloMes } from './util.js';
import { CORES, chipStatus, grafico, icon, kpi, linha, rosca } from './ui.js';

const fmtPct = (v) => `${Math.abs(v).toFixed(1).replace('.', ',')}%`;
// Variação com seta e cor; quando não há base de comparação, avisa em vez de inventar um número.
const variacao = (v, contra) => (v === null || v === undefined
  ? `<span class="suave">sem base de comparação</span>`
  : `<span class="${v >= 0 ? 'verde' : 'vermelho'}">${v >= 0 ? '▲' : '▼'} ${fmtPct(v)}</span> <span class="suave">${contra}</span>`);
const CORES_ROSCA = ['#FF9F1C', '#8B5CF6', '#22D3EE', '#D946EF', '#34D399', '#6F7890'];

export function blocoDiretor(p) {
  if (!p) return '';
  const c = p.crescimento, i = p.inadimplencia, pv = p.previsao, dre = p.dre;
  const evol = grafico(p.evolucao.map((m) => ({ rotulo: rotuloMes(m.mes), partes: [{ valor: m.recebido_cents, cor: CORES.pago }, { valor: -m.pago_cents, cor: CORES.atrasado }] })));
  const entradas = grafico([
    ...(pv.atrasado_receber_cents ? [{ rotulo: 'Atrasado', partes: [{ valor: pv.atrasado_receber_cents, cor: CORES.atrasado }] }] : []),
    ...pv.meses.map((m) => ({ rotulo: rotuloMes(m.mes), partes: [{ valor: m.entra_cents, cor: CORES.previsto }] })),
  ]);
  const rotulos = pv.meses.map((m) => rotuloMes(m.mes));
  const saldo = linha([{ nome: 'Saldo projetado', valores: pv.meses.map((m) => m.saldo_cents), cor: 'var(--amber)' },
    ...(pv.atrasado_receber_cents ? [{ nome: 'Se receber os atrasados', valores: pv.meses.map((m) => m.saldo_com_atrasados_cents), cor: 'var(--violet)', tracejada: true }] : [])], rotulos);
  const negativo = pv.meses.find((m) => m.saldo_cents < 0);

  const parcelados = p.parcelados.length ? `<section class="glass reveal" style="margin-top:var(--s4)"><div class="tabela-wrap"><table class="tbl"><thead><tr><th>Cliente e projeto</th><th>Parcelas</th><th class="num">Recebido</th><th class="num">Falta receber</th><th>Próxima</th><th>Situação</th></tr></thead><tbody>
    ${p.parcelados.map((x) => `<tr><td class="nome" data-label="Cliente"><strong>${esc(x.cliente || 'Sem cliente')}</strong><small>${esc(x.projeto || x.nome)}</small></td>
      <td data-label="Parcelas"><div class="parcelas-prog"><div class="progresso${x.atrasadas ? '' : ' ok'}" aria-hidden="true"><i style="width:${(x.pagas / x.total_parcelas) * 100}%"></i></div>
        <small>${x.pagas} de ${x.total_parcelas} pagas · faltam ${x.faltam}</small></div></td>
      <td class="num verde" data-label="Recebido">${brl(x.recebido_cents)}</td><td class="num" data-label="Falta receber"><b>${brl(x.falta_cents)}</b></td>
      <td data-label="Próxima">${x.proxima ? `${dataBR(x.proxima.vencimento)}<small>${brl(x.proxima.valor_cents)}</small>` : '—'}</td>
      <td data-label="Situação">${x.atrasadas ? `<span class="chip s-vencido">${icon('alert')}${x.atrasadas} atrasada${x.atrasadas === 1 ? '' : 's'} · ${brl(x.atrasado_cents)}</span>` : chipStatus('a_vencer', { a_vencer: 'Em dia' })}</td></tr>`).join('')}</tbody></table></div></section>
    ${p.parcelados_total > p.parcelados.length ? `<p class="suave" style="margin-top:var(--s2)">Mostrando ${p.parcelados.length} de ${p.parcelados_total} contratos parcelados. <button class="btn btn-ghost btn-sm" data-ir="pagamentos">Ver todos ${icon('dir')}</button></p>` : ''}`
    : '<p class="suave" style="padding:var(--s3) 0">Nenhum contrato parcelado em andamento.</p>';

  const topClientes = p.carteira.slice(0, 5), outros = p.carteira.slice(5).reduce((s, x) => s + x.valor_cents, 0);
  const partes = [...topClientes.map((x, k) => ({ rotulo: x.nome, valor: x.valor_cents, cor: CORES_ROSCA[k] })), ...(outros ? [{ rotulo: 'Outros clientes', valor: outros, cor: CORES_ROSCA[5] }] : [])];
  const cobrar = p.cobrar.length ? `<ul class="lista">${p.cobrar.map((x) => `<li><span class="esq">${icon('alert')}<span>${esc(x.nome)}<small>${x.max_atraso_dias} dia${x.max_atraso_dias === 1 ? '' : 's'} de atraso</small></span></span><span class="dir"><b class="num vermelho">${brl(x.vencido_cents)}</b></span></li>`).join('')}</ul>`
    : '<p class="suave" style="padding:var(--s3) 0">Nenhum cliente em atraso. Tudo em dia.</p>';

  return `
    <div class="sec-diretor">
      <h2 style="margin:var(--s6) 0 var(--s1)">Visão do diretor</h2>
      <p class="suave" style="margin-bottom:var(--s3)">Crescimento, atrasos e caixa. Estes números usam a data de hoje e não mudam com o período escolhido acima.</p>
      <div class="grade-kpi">
        ${kpi({ rotulo: 'Recebido no mês', icone: 'receitas', valor: c.mes.atual_cents, cor: 'verde', sub: variacao(c.mes.variacao_pct, 'vs mês anterior'), tag: 'div' })}
        ${kpi({ rotulo: 'Recebido no ano', icone: 'tendencia', valor: c.ano_recebido.atual_cents, cor: 'azul', sub: variacao(c.ano_recebido.variacao_pct, 'vs mesmo período de ' + (Number(p.hoje.slice(0, 4)) - 1)), tag: 'div' })}
        ${kpi({ rotulo: 'Ritmo (3 últimos meses)', icone: 'fluxo', valor: c.trimestre.atual_cents, cor: 'violet', sub: variacao(c.trimestre.variacao_pct, 'vs 3 meses antes'), tag: 'div' })}
        ${kpi({ rotulo: 'Inadimplência', icone: 'alert', valor: i.vencido_cents, cor: i.vencido_cents ? 'vermelho' : 'verde', sub: `<span class="${i.vencido_cents ? 'vermelho' : 'verde'}">${i.pct.toFixed(1).replace('.', ',')}% do que há a receber</span> · ${i.clientes} cliente${i.clientes === 1 ? '' : 's'}`, destino: 'areceber' })}
      </div>
      <div class="grade g2" style="margin-top:var(--s4)">
        <section class="glass painel reveal"><h3>Evolução: últimos 12 meses</h3>${evol}
          <div class="legenda"><span><i style="background:var(--ok)"></i>Recebido</span><span><i style="background:var(--err)"></i>Pago</span></div></section>
        <section class="glass painel reveal"><h3>Entradas previstas: próximos 12 meses</h3>${entradas}
          <div class="legenda"><span><i style="background:var(--violet)"></i>A vencer</span>${pv.atrasado_receber_cents ? '<span><i style="background:var(--err)"></i>Já atrasado</span>' : ''}<span class="suave">Total a vencer: <b class="num">${brl(pv.total_entradas_cents)}</b></span></div></section>
      </div>
      <div class="grade g2" style="margin-top:var(--s4)">
        <section class="glass painel reveal"><h3>Saldo projetado em 12 meses</h3>${saldo}
          <div class="legenda"><span><i style="background:var(--amber)"></i>Saldo projetado</span>${pv.atrasado_receber_cents ? '<span><i style="background:var(--violet)"></i>Se receber os atrasados</span>' : ''}</div>
          ${negativo ? `<p class="aviso-caixa">${icon('alert')}<span>O caixa fica negativo em ${rotuloMes(negativo.mes)}${pv.atrasado_receber_cents ? `. Receber os ${brl(pv.atrasado_receber_cents)} em atraso ${pv.meses.find((m) => m.saldo_com_atrasados_cents < 0) ? 'ajuda, mas não cobre tudo' : 'resolve'}.` : '.'}</span></p>` : ''}
          <p class="suave" style="margin-top:var(--s2)">Saldo atual ${brl(pv.saldo_atual_cents)} + entradas − saídas já lançadas. Atrasados não entram na linha principal.</p></section>
        <section class="glass painel reveal"><h3>Mês a mês</h3><div class="tabela-wrap" style="max-height:340px"><table class="tbl tbl-mes"><thead><tr><th>Mês</th><th class="num">Entra</th><th class="num">Sai</th><th class="num">Saldo</th></tr></thead><tbody>
          ${pv.meses.map((m) => `<tr><td data-label="Mês">${rotuloMes(m.mes)}</td><td class="num verde" data-label="Entra">${brl(m.entra_cents)}</td><td class="num vermelho" data-label="Sai">${brl(m.sai_cents)}</td><td class="num ${m.saldo_cents < 0 ? 'vermelho' : ''}" data-label="Saldo"><b>${brl(m.saldo_cents)}</b></td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <h3 style="margin:var(--s6) 0 var(--s2)">Contratos parcelados: quanto falta e quem cobrar</h3>
      ${parcelados}
      <div class="grade g2" style="margin-top:var(--s4)">
        <section class="glass painel reveal"><h3>Quem cobrar agora <button class="btn btn-ghost btn-sm" data-ir="areceber">A receber ${icon('dir')}</button></h3>${cobrar}</section>
        <section class="glass painel reveal"><h3>Quem vai pagar nos próximos 12 meses</h3>${partes.length ? rosca(partes, { centro: 'A receber' }) : '<p class="suave" style="padding:var(--s3) 0">Nada a vencer nos próximos 12 meses.</p>'}</section>
      </div>
      <h3 style="margin:var(--s6) 0 var(--s2)">Efeito no resultado: DRE × caixa em ${dre.ano}</h3>
      <div class="grade-kpi">
        ${kpi({ rotulo: 'Receita na DRE (competência)', icone: 'pizza', valor: dre.receita_competencia_cents, cor: 'azul', tag: 'div' })}
        ${kpi({ rotulo: 'Já recebida no caixa', icone: 'check', valor: dre.receita_caixa_cents, cor: 'verde', tag: 'div' })}
        ${kpi({ rotulo: 'Na DRE e ainda não recebida', icone: 'relogio', valor: dre.a_receber_cents, cor: dre.a_receber_cents ? 'laranja' : 'verde', tag: 'div' })}
        ${kpi({ rotulo: 'Resultado operacional (DRE)', icone: 'tendencia', valor: dre.resultado_competencia_cents, cor: dre.resultado_competencia_cents < 0 ? 'vermelho' : 'verde',
          sub: dre.margem_competencia_pct === null ? '' : `Margem ${dre.margem_competencia_pct.toFixed(1).replace('.', ',')}% · no caixa ${brl(dre.resultado_caixa_cents)}`, destino: 'dre' })}
      </div>
      <p class="suave" style="margin-top:var(--s2)">A DRE conta a receita no mês do serviço; o caixa só conta quando o dinheiro entra. A diferença é o que os clientes ainda devem.</p>
    </div>`;
}
