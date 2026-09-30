# Regras críticas no servidor — PARA CONFIRMAÇÃO

Nenhuma regra crítica pode depender só do navegador. Proposta (funções SQL/RPC + gatilhos, `security definer` com checagem de papel):

| Regra | Onde hoje | No servidor |
|---|---|---|
| 5 travas da medição e aprovação com CPI/SPI < 1 exigindo análise | `medTravas`, `medAprovar` | RPC `aprovar_medicao(id, analise)` recalcula as travas; `UPDATE` direto de `status` bloqueado |
| Orçamento v1 imutável; versões só acrescentam | `orcSalvar` | gatilho impede `UPDATE/DELETE` em versões publicadas |
| Aditivo assinado altera o orçamento revisado | `adt*` | RPC `assinar_aditivo` |
| Relatório emitido congela números | `relatorios` | gatilho bloqueia edição de `numeros` após emissão; retificação cria novo registro |
| Conta paga não volta | `baixarConta` | gatilho: só `dono/financeiro` e com auditoria |
| Encerramento com checklist e justificativa | `encerrarObra` | RPC `encerrar_obra` |
| Exclusão só lógica | hoje é física | `DELETE` negado; `excluido_em` via RPC |
| Alçada de aprovação | `alcada` | checagem na RPC |
| Quem altera o quê | — | gatilho de auditoria grava antes/depois |

O navegador continua validando (UX), mas o servidor é a autoridade.
