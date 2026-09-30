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

## Fase 5 — DRE, relatório ao cliente e avaliação

### Passo 0 — Navegação da obra

**D-5.0.1 — Grupos e subabas.** A obra passa a ter 8 grupos (Visão geral, Planejamento, Execução e qualidade, Suprimentos, Prestadores, Custo e financeiro, Gestão, Encerramento), como na proposta da especificação, com as subabas do grupo em uma segunda barra.
Cada grupo abre na primeira subaba. Um grupo só aparece quando ao menos uma aba dele já existe, e a segunda barra só aparece se o grupo tem mais de uma aba (as abas novas entram nos passos seguintes).
As URLs `#/obra/ID/aba` de antes continuam iguais; aba desconhecida abre o Resumo. A barra de grupos e a de subabas quebram em linhas no celular em vez de rolar de lado, para nada ficar escondido.

### Passo 1 — Empresas, empresa na obra e contrato do cliente

**D-5.1.1 — Empresas.** As duas empresas do grupo (Cariati Arquitetura Ltda e Cariati Construtora Ltda) são criadas sob demanda, na primeira vez que alguém abre a página DRE, o cadastro de obra ou a aba DRE (e só se a pessoa pode editar). São editáveis: nome, CNPJ, alíquota, critério de rateio e situação; dá para acrescentar outras e inativar.
A **alíquota fica vazia** (valor provisório): sem ela o app não sugere imposto. Empresa inativa some da lista de escolha na obra, mas seus lançamentos continuam.

**D-5.1.2 — Um contrato de cliente por obra** (id `cc_<obra>`). Guarda só o que vem do contrato assinado. Receita prevista por competência: valor fixo mensal entre o mês de início e o de fim; parcelas nas competências informadas;
percentual do custo × apropriado do mês (só Administração; na Gestão o app recusa).

**D-5.1.3 — Rateio manual.** Digitado como “Nome da obra; percentual”, uma obra por linha, só obras da própria empresa, somando 100%. Fica guardado na empresa.

### Passo 2 — Lançamentos, rateio e DRE por obra

**D-5.2.1 — Lançamentos.** Valor sempre positivo; o sinal vem da categoria. Receita, imposto e custo direto **precisam de obra**; despesa geral **não tem obra** (é da empresa e é rateada). A empresa do lançamento vem da obra; obra sem empresa não aceita lançamento (o app pede para definir a empresa).

**D-5.2.2 — Sugestão no fechamento do mês.** Nunca automática: o app lista a receita do contrato (competência do mês) e o imposto (alíquota da empresa × receita bruta do mês, incluindo a receita sugerida) e o usuário confirma todas, edita ou descarta.
Se já existe lançamento de mesma origem (`contrato` ou `imposto_auto`) para a obra e a competência, ele é mostrado como “já lançado” e **não se sugere de novo**. O imposto é sugerido uma vez; se a receita mudar depois, ele não se recalcula sozinho (edite o lançamento).
Descartar vale só na sessão atual (a sugestão volta ao reabrir), para o descarte nunca esconder receita de vez.

**D-5.2.3 — Rateio das despesas gerais (calculado na hora, nunca gravado).** Por empresa: `receita` (proporcional à receita bruta do mês de cada obra), `igual` ou `manual` (percentuais da empresa). Quando o critério não tem base (receita zero no mês, ou manual sem percentuais), o app **cai para partes iguais** para não perder a despesa.
Os centavos de sobra vão para a obra de maior peso, então a soma das partes é sempre igual à despesa. Empresa sem nenhuma obra: a despesa fica “não rateada” (aparece no DRE da empresa).

**D-5.2.4 — Períodos.** Mês atual, trimestre (3 meses até o atual), ano ou intervalo livre; comparação com o período anterior de mesmo tamanho e acumulado desde o primeiro lançamento.

**D-5.2.5 — Repasse (Administração).** Compras, medições (líquido) e locações **pagas no período**, mostradas num bloco separado, informativo, **fora do resultado**. Na Gestão o bloco não aparece.

**D-5.2.6 — Avisos permanentes.** A tela do DRE mostra: “Informação restrita à diretoria; o app ainda não separa perfis” e o aviso de confirmação com o contador. **Risco registrado:** enquanto não houver perfis (fase 6), qualquer pessoa que abre o app vê o DRE.

### Passo 3 — DRE por empresa e consolidado

**D-5.3.1 — Fechamento garantido.** O quadro “por obra” tem o total calculado a partir das linhas e **sempre fecha** com o DRE da empresa: se sobrar algo que não é de obra nenhuma (despesa geral de empresa sem obras, ou lançamento sem obra), aparece uma linha própria
(“Despesas gerais sem obra para ratear” ou “Lançamentos sem obra”). Obras sem empresa formam o grupo “Sem empresa” no consolidado. Consolidado = soma dos DREs de todas as empresas (mais “sem empresa”, se existir).

**D-5.3.2 — Gráficos.** Barras de receita líquida e resultado dos últimos 12 meses e ranking de margem por obra (barras horizontais, maior margem primeiro; margem negativa em vermelho). SVG puro, tema claro e escuro.

**D-5.3.3 — CSV detalhado.** Uma linha por lançamento do período e da empresa escolhida, colunas `empresa;obra;competencia;categoria;subcategoria;descricao;valor;origem`, separador `;`, valor com vírgula decimal e BOM para abrir direto no Excel brasileiro.
*Desenho conforme a especificação; como o app gera o arquivo na hora a partir dos lançamentos, nenhum arquivo de exemplo foi criado no repositório.*

### Passo 4 — Relatório mensal ao cliente

**D-5.4.1 — Rascunho ao vivo, emitido congelado.** O rascunho recalcula os números a cada abertura; **emitir** guarda uma fotografia (`snapshot`) e daí em diante o relatório é montado só dela: mudar dados, renomear a obra ou lançar novas ocorrências não altera nada. Resumo e fotos também não se editam depois de emitido.
Correção = **retificação**: novo rascunho ligado ao anterior (`retificacaoDe`), com o resumo e as fotos copiados e números novos. O original continua intacto e é marcado “substituído” quando uma retificação é emitida. Só rascunho pode ser excluído.

**D-5.4.2 — Conteúdo.** As 11 seções da especificação; a Administração mostra suprimentos e financeiro (orçado × comprometido × apropriado × pago, medições do mês, contas em aberto, desembolso dos 3 meses seguintes, CPI/SPI/EAC e a análise do desvio, se houver) e a Gestão mostra medições aprovadas e desembolso previsto do cliente.
*Avanço e indicadores refletem a data da emissão*, não uma reconstrução do fim do mês (o app não guarda histórico mês a mês do avanço). “Retrabalho” = reaberturas de ocorrência.

**D-5.4.3 — Pendências do cliente com data-limite.** Materiais de nível 3 pendentes (prazo do material), aditivos aguardando assinatura (data-limite = envio + dias de escalonamento da obra, padrão 7) e, na Administração, compras que dependem do cliente (data-limite de pedido).

**D-5.4.4 — Envio, prazo de objeção e validação.** Registra-se a data de envio e o prazo para objeção; depois a resposta do cliente: “validou” ou “fez objeção” (com texto obrigatório). A validação é registro manual da equipe; o cliente ainda não acessa o app.

**D-5.4.5 — PDF sem biblioteca.** “Imprimir / salvar como PDF” usa `window.print()` com folha de estilo de impressão (A4, sem menus, blocos sem quebra no meio). Dentro do claude.ai o app roda num quadro isolado onde a impressão pode ser bloqueada: nesse caso o app avisa
e oferece **“Baixar relatório em HTML”**, arquivo único com o estilo embutido, que se imprime no navegador. *Ponto que só uma pessoa confere:* como a impressão sai no papel/PDF.
Fotos no HTML baixado são links para o armazenamento; com o Supabase configurado abrem normalmente.

**D-5.4.6 — Fotos.** Até 12, escolhidas entre as do diário do mês.

### Passo 5 — Avaliação de prestadores

**D-5.5.1 — Sugestões (todas provisórias e editáveis).** Pontualidade = 10 × pacotes concluídos ÷ pacotes marcados do prestador (pacote sem marcação não conta). Conformidade = 10 × (1 − mín(1, pontos ÷ 10)), pontos = 3 por crítica + 1 por importante + 0,3 por simples atribuídas ao prestador na obra (abertas ou fechadas).
Limpeza = termos de frente em que o prestador **sai** entregues “limpa e sem dano” ÷ termos em que ele sai. Danos = 10 × (1 − mín(1, custo dos danos causados ÷ 2% do valor dos contratos dele na obra)). Documentação = meses do contrato (do início até o fim ou o mês atual) com os quatro documentos conferidos ÷ meses do contrato.
Reincidência = 10 × (1 − ocorrências que já foram reabertas ÷ ocorrências do prestador). **Segurança nunca é sugerida.** Sem dados suficientes o critério fica sem sugestão (não vira zero). Sugestões arredondadas a 1 casa decimal.

**D-5.5.2 — Nota.** O avaliador altera qualquer nota (0 a 10); diferença **acima de 2 pontos** da sugestão exige justificativa. Nota final = média ponderada (pesos editáveis, padrão iguais) só dos critérios preenchidos, com 1 casa. A avaliação guarda também as sugestões do momento, para auditoria.

**D-5.5.3 — Ranking e aviso.** A página Prestadores mostra nota média, número de obras avaliadas, última avaliação e “recontrataria”. Ao **criar** contrato com prestador de nota média abaixo de 6, o formulário mostra um aviso na primeira tentativa de salvar; salvar de novo confirma (não bloqueia).

**D-5.5.4 — Encerramento do contrato.** Encerrar o contrato registra `encerradoEm`, sugere abrir a avaliação e o prestador entra em “avaliação pendente” na aba Avaliações da obra (grupo Prestadores).

### Passo 6 — Encerramento, lições e ajuste do P0

**D-5.6.1 — Mapeamento etapa → disciplina (PROPOSTA, para o Edson confirmar).** O P0 é organizado por disciplina e o app por etapa do protocolo. Proposta inicial, já editável na tela (fica guardada e vale para todas as obras):

| Disciplina | Etapas do protocolo |
| --- | --- |
| Projetos e legalização | 1 Pré-obra |
| Canteiro e mobilização | 2 Mobilização e canteiro |
| Terraplanagem e contenções | 3 Terraplanagem e locação · 4 Contenções e drenagem do terreno |
| Fundação e estrutura | 5 Fundação · 6 Estrutura |
| Alvenaria e vedações | 7 Alvenaria e vedações |
| Cobertura | 8 Cobertura |
| Instalações prediais | 9 Instalações embutidas · 10 Reservatórios, fossa e águas pluviais · 11 SPDA e aterramento |
| Impermeabilização e isolamentos | 12 Impermeabilização · 13 Isolamento térmico e acústico |
| Revestimentos, contrapisos e fachada | 14 Revestimentos, contrapisos e forros · 15 Fachada e revestimentos externos |
| Esquadrias e marcenaria | 16 Esquadrias, marcenaria e serralheria |
| Pintura | 17 Pintura |
| Energia solar e aquecimento | 18 Energia solar e aquecimento de água |
| Acabamentos finais | 19 Acabamentos finais |
| Áreas externas | 20 Áreas externas |
| Limpeza e entrega | 21 Limpeza, vistoria e entrega · 22 Pós-obra |

**D-5.6.2 — Regra do P0 (método do Edson).** Só entra na comparação o que já foi executado ou comprado: etapa **liberada** ou com **custo apropriado > 0**. Para cada uma: orçado (orçamento revisado) × real (apropriado), desvio em R$ e %, R$/m² (dividido pela área da obra) orçado e real e incidência real (% do custo real total).
**Economia** (real ≤ orçado) → ação **manter** o valor unitário do P0; **déficit** (real > orçado) → ação **ajustar**, com o R$/m² real como sugestão de novo valor, que o Edson pode editar antes de exportar. Etapa sem custo e não liberada fica fora. Área da obra em branco: sem R$/m² (o app avisa).
O quadro por disciplina soma as etapas dela e aplica a mesma regra.

**D-5.6.3 — Referência opcional (20 serviços).** CSV `servico;incidencia;minimo;maximo` (percentuais); o serviço é casado pelo nome da disciplina (sem acento e sem diferença de maiúsculas) e incidências reais fora da faixa são sinalizadas.

**D-5.6.4 — Curva real.** % acumulado por mês do custo apropriado até o total (serve de referência físico-financeira para novos orçamentos).

**D-5.6.5 — Exportação “P0 calibrado” (desenho).** CSV `;`, com BOM, em duas partes: (1) `etapa;disciplina;rs_m2_p0_original;rs_m2_real;desvio_pct;acao;rs_m2_calibrado;incidencia_real_pct`; (2) depois de uma linha em branco, a curva real `mes;pct_acumulado`. Gerado na hora a partir dos dados; nenhum arquivo de exemplo foi criado no repositório.

**D-5.6.6 — Encerrar a obra.** Checklist de 9 itens (documentos de encerramento, ocorrências, danos, contas a pagar [Administração], termos de frente, estoque, avaliações, relatório do último mês, lições). Item pendente exige **justificativa** para encerrar. Definições onde havia ambiguidade:
*termos de frente* = todo prestador com contrato na obra tem ao menos um termo em que ele sai; *estoque* = saldo positivo exige registrar o destino (justificativa); *relatório do último mês* = emitido no mês atual ou, se hoje é até o dia 10, no mês anterior.
Obra encerrada ganha selo, e criar algo novo nela pede confirmação (uma vez por sessão). É possível reabrir.

**D-5.6.7 — Lições.** Causas do desvio digitadas uma por linha (`etapa; causa; valor; texto`, com a causa entre cliente, fornecedor, produção, projeto, clima, retrabalho, orçamento subdimensionado, outra); o app guarda junto o orçado × realizado por etapa no momento do registro.

**D-5.6.8 — Onde ficam os dados.** Configurações globais (mapa de disciplinas, referência do P0) e ajustes por obra ficam na coleção nova `config` (ids `p0_mapa`, `p0_ref`, `p0_<obra>`); ela entra na exclusão em cascata só para o que tem `obraId`.

## Fase 5 — Passo 7 (indicadores, alertas e agenda)

**D-5.7.1 — Indicadores no resumo.** Margem da obra (DRE acumulado), nota média dos prestadores e situação do relatório do mês.

**D-5.7.2 — Alertas.** Obra sem empresa; sem contrato do cliente; relatório do mês anterior não emitido depois do dia 5; validação do cliente pendente depois do prazo de objeção; contrato encerrado sem avaliação além de `diasEscalar`; todas as etapas liberadas há mais de 30 dias sem encerrar a obra. Obra encerrada não gera alertas.

**D-5.7.3 — Agenda.** Emissão do relatório (dia 5), prazo de objeção do cliente e fim do contrato do cliente.

**D-5.7.4 — Exclusão em cascata.** Apaga as coleções com `obraId` da obra; preserva empresas, despesas gerais (sem obra) e a configuração global (`config/p0_mapa`, `p0_ref`).

## Fase 5 — Passo 8 (benchmark) e menu no celular

**D-5.8.1 — Referência entre obras encerradas.** Na aba Encerramento: R$/m² real por etapa (mínimo, mediana, média, máximo e nº de obras) de **outras** obras encerradas da **mesma tipologia**, com área informada. Só entram etapas com custo apropriado. Sem obra comparável, o app avisa. A tipologia igual é decisão minha (provisória): dá para ampliar para todas as tipologias se o Edson preferir.

**D-5.8.2 — Menu do topo no celular.** Os itens passam a quebrar linha em vez de rolar para o lado, para o DRE e a Nuvem não ficarem escondidos.

## Fase 6 — Passo 2 (migração base, sem executar no Supabase)

O Edson respondeu “pode fazer”. Interpretei como aprovação do desenho em `docs/migracao-supabase/` com as opções recomendadas (registrar aqui para ele corrigir se for diferente):
- **D-6.2.1** Um escritório só (single-tenant). Tabelas no formato `id text` (os ids atuais são texto, ex.: `cc_<obra>`), `obra_id` tipado e `dados jsonb` com o restante; colunas tipadas adicionais entram quando uma consulta pedir.
- **D-6.2.2** Perfis: dono, gestor, financeiro, campo, cliente, leitura. A matriz virou **dados** (tabelas `permissoes` e `colecoes`), fácil de ajustar sem mexer em código. Cliente ainda não lê nada; o acesso dele ao relatório emitido vem em passo próprio.
- **D-6.2.3** Exclusão só lógica: `DELETE` negado a todos; a exclusão é a função `excluir_registro`, que confere permissão; `UPDATE` direto de `excluido_em` é bloqueado por gatilho.
- **D-6.2.4** Versão (`versao`) e auditoria (antes/depois, quem, quando) por gatilho; auditoria só o dono lê.
- **D-6.2.5** Validação: `npm run test:rls` sobe um Postgres local descartável, aplica `supabase/migrations/0001_base.sql` e roda `supabase/tests/teste_rls.sql`. **Nada foi aplicado no Supabase** (sem projeto/URL/chave `anon` ainda).
- Ainda falta: RPCs das regras críticas (aprovar medição, assinar aditivo, congelar relatório, encerrar obra), política do cliente, e ligar o app (login, carregamento por obra, Realtime) — depende do projeto `cariati-obras-dev`.

## Fase 6 — Passo 3 (regras críticas no servidor)

O Edson aprovou o passo 2. `supabase/migrations/0002_regras.sql` (testada em Postgres local; nada aplicado no Supabase):
- **D-6.3.1** Relatório emitido não muda `snapshot`, mês, data de emissão nem volta a rascunho (prazo de objeção e envio ainda podem mudar). Correção = retificação (novo registro).
- **D-6.3.2** Versões de orçamento e seus itens são imutáveis (preços de referência `ref_*` podem mudar).
- **D-6.3.3** Conta paga só volta pelo dono; medição só é aprovada por dono ou financeiro, não nasce aprovada e, aprovada, não tem itens alterados; aditivo assinado é imutável e só dono/gestor/financeiro assinam.
- **D-6.3.4** Só o dono encerra ou reabre obra.
- **D-6.3.5** Cliente lê **somente relatórios emitidos da própria obra** e valida/objeta pela função `validar_relatorio` (objeção exige motivo).
- **Limite honesto:** o servidor ainda **não recalcula** as 5 travas da medição nem o CPI/SPI; ele só controla quem aprova e o congelamento. Recalcular no servidor exige portar `medTravas` e o EVM para SQL: fica como passo próprio, a confirmar com o Edson.
