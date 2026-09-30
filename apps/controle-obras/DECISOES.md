# Decisões de projeto

Registro do que foi decidido onde a especificação era ambígua ou omissa, e por quê.
Cada item diz a fase em que entrou.

## Fase 4 — passo 0 (módulos e build)

**D0.1 — Onde fica o código-fonte.** O arquivo `controle-obras-cariati.html` citado na especificação não estava na pasta.
Foi usado `apps/controle-obras/index.html`, que é o mesmo Artifact publicado (conferido) mais a camada de nuvem (Supabase).
*Por quê:* é a única versão real do app; recriar outra seria arriscar divergência.

**D0.2 — Ordem dos módulos.** `core + p2 + p3 + p4 + views + nuvem + boot`. A nuvem (login, Supabase, histórico) e o `boot()`
ficam no fim porque dependem das visões e do `render`. O bloco do Supabase continua dentro de `core.js`, entre os utilitários e o `Store`,
para o build ser idêntico byte a byte ao arquivo anterior.
*Como foi provado:* o `index.html` gerado é idêntico ao anterior (`cmp`), e `tests/build.test.js` falha se `src/` e `index.html` divergirem.

**D0.3 — `A4` passa a ser da fase 4 (feito no passo 1, não no 0).** Hoje `A4` guarda as ações de nuvem/histórico.
No passo 1 elas viram `ANuvem` e `A4` fica livre para as ações da fase 4, como pede a especificação (cadeia `A || A2 || A3 || A4 || ANuvem`).
*Por quê no passo 1:* o passo 0 precisa ser uma mudança sem efeito no comportamento, para provar a regressão.

**D0.4 — Testes.** Node 22 (`node --test`) com jsdom, sem framework extra. O banco falso imita `window.claude.use('db')`
(`collection().onSnapshot`, `doc().set/delete`), então testamos o app real, sem alterar o código para testar.

## Fase 4 — decisões de negócio (preenchidas conforme cada passo entra)

### Passo 1 — Orçamento

**D1.1 — Itens em lotes (`orcItens`).** Os itens de cada versão vão sempre para a coleção `orcItens`, em lotes de 150 itens por documento
(`<orcId>_<n>`); o documento da versão (`orcamentos`) guarda só o cabeçalho, o total e os subtotais por etapa e por tipo.
*Por quê:* um item ocupa ~250 bytes; 150 itens ≈ 40 KB, longe dos 256 KB por documento, e o orçamento de uma obra grande cabe em poucos documentos
(o limite de ~5.000 documentos no total continua respeitado). Os lotes são gravados antes do cabeçalho, então uma importação interrompida não deixa versão sem itens.

**D1.2 — Formato do CSV.** Colunas obrigatórias `codigo, etapa, descricao, unidade, quantidade, preco_unitario, tipo`; opcionais `prestador, total`.
Aceita `;`, `,` ou tabulação, decimal com vírgula ou ponto, R$ e milhar com ponto. Nomes de coluna sem acento/maiúscula e algumas variações
(`qtd`, `un`, `pu`, `servico`…). Arquivo em Windows-1252 (Excel brasileiro) é detectado. Dá para colar o texto em vez de enviar arquivo.
*Por quê:* o Edson ainda não definiu a origem do orçamento (Vobi, Base44 ou planilha); o CSV é o denominador comum.

**D1.3 — Validação.** Qualquer erro bloqueia a importação inteira (nada é importado pela metade). Linha só com total é rejeitada
(orçamento detalhado é exigência do Edson). Prestador não encontrado é aviso: o item entra sem prestador e não poderá ser medido até o prestador ser cadastrado e o CSV importado de novo como nova versão.

**D1.4 — Ligação item → prestador.** Feita pelo nome, na importação, comparando sem acento e sem diferença de maiúsculas.
*Por quê:* a medição só lista itens do prestador; guardar o id evita depender do texto depois.


### Passo 2 — Aditivos e orçamento revisado

**D2.1 — Itens do aditivo em texto.** O aditivo é digitado com um item por linha (`descrição; unidade; quantidade; preço unitário; etapa; tipo; prestador`),
o mesmo formato de colunas do orçamento. *Por quê:* o formulário do app não tem lista dinâmica de itens e o aditivo costuma ter poucas linhas; ao colar da planilha o Edson usa o mesmo hábito.
Tudo passa pela mesma validação do orçamento (quantidade > 0, preço ≥ 0, etapa 1–22).

**D2.2 — Sinal.** Os itens do aditivo são sempre digitados positivos; o tipo (`acréscimo`, `supressão`, `prazo`) dá o sinal. Supressão entra no orçamento revisado com total negativo
e **não aparece para medição**. Aditivo de prazo não tem itens, só dias.

**D2.3 — Imutabilidade.** Rascunho é editável e excluível; depois de enviado ao cliente não se edita. Assinado e recusado são definitivos: para corrigir, cria-se outro aditivo.
Assinar exige o registro de como o cliente assinou (texto obrigatório, anexo opcional).

**D2.4 — Orçamento revisado.** Versão vigente do orçamento (a de maior número) + aditivos assinados. Cada item de aditivo entra com código `A<nº>.<item>`. O orçamento base nunca é reescrito.

### Passo 3 — Medição

**D3.1 — Fichas (trava 3).** Para medir itens da etapa N: precisa haver ao menos uma ficha **aprovada** (“não se aplica” não conta) e nenhuma reprovada ou aguardando reinspeção.
Fichas ainda sem inspeção só geram aviso. Etapa sem nenhuma ficha aprovada bloqueia. *Por quê:* é a leitura mais conservadora de “ao menos uma ficha aprovada e nenhuma reprovada”.

**D3.2 — Avanço (trava 2).** Percentual medido do contrato = (medido em análise/aprovado/pago + esta medição) ÷ valor do contrato (se o contrato não tem valor, usa o orçado dos itens do prestador).
Avanço físico do prestador = média das atividades dele no cronograma ponderada pela duração; **sem atividades o avanço é 0** (e a tela avisa), então a medição exige justificativa.
A justificativa fica em `justificativas[]` (autor, data). Tolerância padrão de 5 pontos, editável na obra (`tolerAvanco`).

**D3.3 — Retenção por apontamento crítico (trava 5).** Ocorrência crítica **aberta** do prestador na etapa de itens medidos retém o valor desses itens (não bloqueia). Como o valor retido não está sendo pago,
**a retenção % incide só sobre (bruto − retido)**, para não descontar duas vezes o mesmo dinheiro.

**D3.4 — Gestão.** A Cariati mede e aprova, mas o valor a pagar pelo cliente é o bruto medido; retenção, descontos de dano e valor retido aparecem como **recomendação** (“reter R$ X”). Não gera conta a pagar.

**D3.5 — Quantidades já medidas.** Contam medições em análise, aprovadas e pagas; rascunho não conta (para dois rascunhos não se bloquearem). O excedente é conferido ao salvar as quantidades **e** de novo ao aprovar.

**D3.6 — Desvio (CPI/SPI).** A aprovação já pede `analiseDesvio` quando CPI ou SPI < 1 (Gestão: só SPI). Até o passo 6 o cálculo de CPI/SPI é um espaço reservado que devolve “sem dados”; o passo 6 o substitui.

**D3.7 — Conta a pagar.** A aprovação (Administração) cria a conta com id fixo `cp_medicao_<id>` (não duplica), valor líquido, retenção destacada e vencimento em branco para o financeiro preencher.

### Passo 4 — Contas a pagar, aportes e fluxo de caixa

**D4.1 — Geração das contas (só Administração).** Medição aprovada, pedido de compra emitido e locação devolvida geram a conta com id fixo (`cp_<origem>_<id>`); repetir o evento **atualiza** a mesma conta em vez de duplicar, e uma conta já paga nunca é sobrescrita.
Compra: vencimento = entrega prevista + N, quando a condição da cotação escolhida tem “N dias”; senão fica em branco e a conta mostra “Sem vencimento” (não entra no fluxo até ser preenchido).
Locação: valor real (do início até a devolução), não o previsto.

**D4.2 — Pagar pelos dois lados.** “Marcar como paga” na conta e “Marcar como pago” na compra/medição dão o mesmo resultado (a origem e a conta ficam pagas). A conta só é paga se a origem estiver conferida
(compra conferida, medição aprovada, locação devolvida). Locação não tem situação “paga” própria; o pago dela é a conta paga.

**D4.3 — Fluxo de caixa.** Por mês: aportes previstos e recebidos, desembolsos previstos (contas não canceladas, por vencimento) e pagos (por data de pagamento).
**Saldo do mês** = recebido − pago nos meses até o atual, e previsto − previsto nos meses futuros; o saldo acumulado soma isso desde o primeiro mês. Meses com saldo acumulado negativo ficam em destaque.
*Por quê:* misturar previsto e realizado no mesmo mês distorceria o saldo; o passado é fato, o futuro é projeção.

**D4.4 — Gestão.** A aba Financeiro mostra só o desembolso previsto do cliente por mês (medições aprovadas e a aprovar, pelo mês do fim do período). Não há contas a pagar na Gestão.

**D4.5 — Gráficos.** SVG puro, sem biblioteca, com as cores das variáveis do tema (`var(--steel)` etc.), então funcionam nos temas claro e escuro. O mesmo gerador serve às curvas S do passo 6.

### Passo 5 — Comprometido, apropriado e pago

**D5.1 — Um caminho só (sem dupla contagem).** Em vez de somar o mesmo dinheiro em duas colunas, cada valor está numa só situação:
**comprometido** = pedidos emitidos e ainda não conferidos + locações prevista/ativa (pelo previsto) + saldo de contrato ainda não medido;
**apropriado** = compras conferidas ou pagas + medições aprovadas ou pagas (bruto) + locações devolvidas (pelo real);
**pago** = compras pagas + medições pagas (líquido) + locações com conta paga. A **exposição** (comprometido + apropriado) é o que se compara com o orçado.
*Por quê:* a especificação já pedia isso para contrato + medição; estendemos o mesmo raciocínio a compras e locações para a tabela fechar (contrato de 10.000 com 2.400 medidos = 2.400 apropriado + 7.600 comprometido = 10.000).
O alerta “comprometido acima do orçado” usa a **exposição**.

**D5.2 — Saldo de contrato por etapa.** O contrato não tem etapa. O saldo ainda não medido é repartido entre as etapas dos itens do prestador no orçamento revisado, proporcional ao valor de cada item;
prestador sem itens orçados cai em “Sem etapa”. Contrato encerrado não compromete mais nada.

**D5.3 — Medição paga por etapa.** O líquido pago é repartido entre as etapas na proporção do bruto medido, com a sobra de centavos no maior trecho, para o total bater exatamente.

**D5.4 — Gestão.** Só contratos e medições entram (compras e locações são do cliente e não têm valor no app).

### Passo 6 — Físico-financeiro e curvas S

**D6.1 — Indicadores.** BAC = orçamento revisado. **PV** = Σ (orçado da etapa × fração do cronograma decorrida), com a etapa indo do menor início ao maior fim das atividades dela (distribuição linear por dia).
**EV** = Σ (orçado da etapa × físico da etapa); físico = 100% se a etapa está liberada, senão o avanço das atividades ponderado pela duração, e 0 sem atividades (com aviso).
**AC** = total apropriado (só Administração). CPI = EV ÷ AC; SPI = EV ÷ PV (as duas modalidades); EAC = BAC ÷ CPI. Cores: ≥ 1 ok, 0,9–1 atenção, < 0,9 crítico.
Etapa com orçamento e sem atividades fica **fora do PV** (não dá para planejar sem cronograma) e é listada como “orçamento sem cronograma”.

**D6.2 — Curva S física realizada.** O app não guarda o histórico do avanço mês a mês. A curva realizada soma as etapas **liberadas** no mês da liberação (`liberadaEm`) e, no mês atual, acrescenta o avanço parcial das etapas em andamento.
Assim ela termina exatamente no EV de hoje; meses futuros ficam vazios. *Limitação:* o avanço parcial de meses passados não é reconstruído.

**D6.3 — Curva S de custo.** Planejado = a mesma distribuição do físico em R$; apropriado e pago vêm das datas dos eventos (conferência da compra, aprovação e pagamento da medição, devolução e pagamento da locação).

**D6.4 — Quadro de acompanhamento.** Físico (avanço da etapa) × financeiro (apropriado ÷ orçado) por etapa e por prestador (medido ÷ contrato × avanço no cronograma). Alerta quando o financeiro passa do físico em mais de 10 pontos (valor provisório).

**D6.5 — Aprovação com desvio.** Se CPI ou SPI < 1 (Gestão: só SPI), aprovar a medição exige a análise da causa, guardada em `analiseDesvio`.

### Passo 7 — Indicadores, alertas e agenda

**D7.1 — Indicadores no resumo** (só aparecem com orçamento importado): orçamento revisado com EAC, CPI (só Administração), SPI, avanço físico × orçamento consumido (só Administração), comprometido/apropriado/pago ÷ orçado e aditivos ÷ contratado (base). Alerta amarelo de aditivos acima de 10% do base (valor provisório).

**D7.2 — Alertas novos.** Medição em análise há mais de `diasEscalar` dias; medição bloqueada por documentos; conta vencida (crítico) e a vencer em 7 dias; aporte previsto e não recebido; aditivo aguardando o cliente há mais de `diasEscalar` dias;
CPI/SPI < 1 (crítico se < 0,9); orçamento sem cronograma; exposição acima do orçado; custo sem orçamento. Todos entram no painel geral automaticamente.

**D7.3 — Agenda (área Financeiro).** Vencimentos de contas abertas, aportes previstos ainda não recebidos e o **último dia útil do mês** (segunda a sexta; feriados não são considerados) quando há medição em rascunho, para o mês atual e o seguinte.

**D7.4 — Exclusão em cascata.** Excluir a obra apaga também `orcamentos`, `orcItens`, `aditivos`, `medicoes`, `contasPagar` e `aportes` dela, sem tocar nos de outras obras.

### Passo 8 — Curva ABC e preço de referência

**D8.1 — Classe ABC.** Só materiais do orçamento revisado, do maior para o menor. A classe vem do quanto já foi acumulado **antes** do item: A enquanto esse acumulado é menor que a faixa A (padrão 80%), B até a faixa B (95%), C depois. Quem cruza o corte fica na classe de baixo,
e um item que começa exatamente em 80% já é B. Faixas editáveis em “Editar obra” (valores provisórios).

**D8.2 — Preço de referência.** Vem de um CSV `codigo;preco` que o Edson fornece (ex.: tabela SINAPI). O app não acessa API externa. Os preços ficam num documento próprio (`orcItens`, id `ref_<obra>`), separado do orçamento, para não alterar a versão 1, que é imutável.
Item cujo preço unitário passa de **referência × (1 + margem da obra)** ganha o selo “Acima” e um alerta. O alerta compara o **orçamento**; compras não têm código de item do orçamento, então não são comparadas.
Limite prático: o documento de preços cresce ~30 bytes por código; um orçamento de milhares de itens continua muito abaixo dos 256 KB.
