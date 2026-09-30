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
