// Cronograma de parcelas editável: cada parcela com a sua data e o seu valor (entrada em outra data, última parcela diferente...).
import { $, $$, brl, dataBR, dinheiroInput, esc, hojeISO, parseDinheiro } from './util.js';
import { icon } from './ui.js';

export const addMes = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number), t = a * 12 + (m - 1) + n, ano = Math.floor(t / 12), mes = (t % 12) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(d, new Date(ano, mes, 0).getDate())).padStart(2, '0')}`;
};
// Divide o total em n parcelas iguais; os centavos que sobram vão para as primeiras (como no servidor).
export function dividir(total, n) {
  const base = Math.floor(total / n), resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}
export function gerarCronograma(total, n, primeiro) {
  const venc = primeiro || hojeISO();
  return dividir(Math.max(0, total || 0), Math.max(1, n || 1)).map((v, i) => ({ vencimento: addMes(venc, i), valor_cents: v }));
}
// Entrada em data própria; o restante é dividido nas demais parcelas a partir do primeiro vencimento.
export function comEntrada(total, n, primeiro, entrada) {
  const resto = Math.max(0, total - entrada.valor_cents), outras = Math.max(1, n - 1);
  return [{ vencimento: entrada.vencimento, valor_cents: entrada.valor_cents },
    ...dividir(resto, outras).map((v, i) => ({ vencimento: addMes(primeiro || hojeISO(), i), valor_cents: v }))];
}
export const somaCronograma = (linhas) => linhas.reduce((s, l) => s + (l.valor_cents || 0), 0);
export const cronogramaOk = (linhas, total) => linhas.length >= 1 && linhas.every((l) => l.vencimento && l.valor_cents > 0) && somaCronograma(linhas) === total;
export function mensagemCronograma(linhas, total) {
  if (!linhas.length) return 'Informe pelo menos uma parcela.';
  const ruim = linhas.findIndex((l) => !l.vencimento || !(l.valor_cents > 0));
  if (ruim >= 0) return `A parcela ${ruim + 1} precisa de data e de valor maior que zero.`;
  const dif = total - somaCronograma(linhas);
  return dif ? `A soma das parcelas está ${dif > 0 ? 'abaixo' : 'acima'} do total em ${brl(Math.abs(dif))}. Use "Jogar a diferença na última parcela" ou ajuste os valores.` : null;
}

// Editor visual. raiz: elemento onde desenhar. aoMudar: chamado a cada alteração.
export function editorCronograma(raiz, { total = 0, linhas = [], aoMudar, maximo = 360, entrada = true } = {}) {
  let tot = total, rows = linhas.map((l) => ({ ...l }));
  const dif = () => tot - somaCronograma(rows);
  const rodape = () => {
    const d = dif();
    $('[data-soma]', raiz).textContent = brl(somaCronograma(rows));
    $('[data-total-alvo]', raiz).textContent = brl(tot);
    const chip = $('[data-diferenca]', raiz);
    chip.className = `chip ${d === 0 ? 's-pago' : 's-vencido'}`;
    chip.innerHTML = d === 0 ? `${icon('check')}Fecha com o total` : `${icon('alert')}${d > 0 ? 'Faltam' : 'Sobram'} ${brl(Math.abs(d))}`;
    $('[data-fix]', raiz).hidden = d === 0;
  };
  const desenhar = () => {
    raiz.innerHTML = `<div class="cronograma">
      <div class="cronograma-tabela" role="group" aria-label="Parcelas">${rows.map((l, i) => `<div class="cronograma-linha" data-i="${i}">
        <span class="cronograma-n">${i + 1}</span>
        <input class="campo" type="date" data-cv value="${esc(l.vencimento || '')}" aria-label="Vencimento da parcela ${i + 1}">
        <input class="campo" data-cm inputmode="decimal" value="${l.valor_cents ? dinheiroInput(l.valor_cents) : ''}" placeholder="0,00" aria-label="Valor da parcela ${i + 1} em reais" autocomplete="off">
        <button type="button" class="icon-btn" data-crm aria-label="Remover parcela ${i + 1}"${rows.length <= 1 ? ' disabled' : ''}>${icon('x')}</button></div>`).join('')}</div>
      <div class="cronograma-rodape"><span class="suave">Soma <b class="num" data-soma></b> de <b class="num" data-total-alvo></b></span><span data-diferenca></span></div>
      <div class="cronograma-acoes"><button type="button" class="btn btn-sm" data-cadd${rows.length >= maximo ? ' disabled' : ''}>${icon('plus')}Parcela</button>
        <button type="button" class="btn btn-sm" data-igual>Dividir igualmente</button><button type="button" class="btn btn-sm btn-primary" data-fix hidden>Jogar a diferença na última parcela</button></div>
      ${entrada ? `<div class="cronograma-entrada"><span class="suave">Entrada em outra data:</span>
        <input class="campo" data-ev inputmode="decimal" placeholder="Valor da entrada" aria-label="Valor da entrada" autocomplete="off"><input class="campo" type="date" data-ed value="${hojeISO()}" aria-label="Data da entrada">
        <button type="button" class="btn btn-sm" data-aplicar-entrada>Aplicar entrada</button></div>` : ''}</div>`;
    rodape();
  };
  const mudou = () => { rodape(); aoMudar?.(); };
  raiz.addEventListener('input', (e) => {
    const i = Number(e.target.closest('.cronograma-linha')?.dataset.i);
    if (!rows[i]) return;
    if (e.target.matches('[data-cv]')) rows[i].vencimento = e.target.value;
    if (e.target.matches('[data-cm]')) rows[i].valor_cents = parseDinheiro(e.target.value) || 0;
    mudou();
  });
  raiz.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-crm]');
    if (rm && rows.length > 1) { rows.splice(Number(rm.closest('.cronograma-linha').dataset.i), 1); desenhar(); return aoMudar?.(); }
    if (e.target.closest('[data-cadd]') && rows.length < maximo) {
      const ult = rows.at(-1)?.vencimento || hojeISO();
      rows.push({ vencimento: addMes(ult, 1), valor_cents: Math.max(0, dif()) }); desenhar(); aoMudar?.();
      return $$('[data-cm]', raiz).at(-1)?.focus();
    }
    if (e.target.closest('[data-igual]')) { rows = gerarCronogramaDe(rows, tot); desenhar(); return aoMudar?.(); }
    if (e.target.closest('[data-fix]')) { const d = dif(); rows.at(-1).valor_cents = Math.max(0, (rows.at(-1).valor_cents || 0) + d); desenhar(); return aoMudar?.(); }
    if (e.target.closest('[data-aplicar-entrada]')) {
      const v = parseDinheiro($('[data-ev]', raiz).value), data = $('[data-ed]', raiz).value;
      if (!v || v <= 0 || v >= tot || !data) return $('[data-ev]', raiz).focus();
      const primeiro = rows.length > 1 ? rows.find((r) => r.vencimento)?.vencimento : null;
      rows = comEntrada(tot, Math.max(2, rows.length), primeiro || addMes(data, 1), { valor_cents: v, vencimento: data }); desenhar(); aoMudar?.();
    }
  });
  // "Dividir igualmente" mantém o número de parcelas e o primeiro vencimento
  const gerarCronogramaDe = (atuais, t) => gerarCronograma(t, atuais.length, atuais.find((r) => r.vencimento)?.vencimento);
  desenhar();
  return {
    linhas: () => rows.map((l) => ({ ...l })),
    total: () => tot,
    definir(novas, novoTotal) { rows = novas.map((l) => ({ ...l })); if (novoTotal !== undefined) tot = novoTotal; desenhar(); },
    mudarTotal(t) { tot = t; rodape(); },
    ok: () => cronogramaOk(rows, tot),
    mensagem: () => mensagemCronograma(rows, tot),
    resumo: () => `${rows.length} parcela${rows.length === 1 ? '' : 's'}, a primeira em ${rows[0]?.vencimento ? dataBR([...rows].map((r) => r.vencimento).sort()[0]) : '—'}`,
  };
}
