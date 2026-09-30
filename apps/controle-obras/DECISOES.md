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

_Nenhuma ainda._
