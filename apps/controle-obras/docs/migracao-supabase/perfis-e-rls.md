# Perfis e matriz de permissões proposta — PARA CONFIRMAÇÃO

## Perfis sugeridos
| Perfil | Quem |
|---|---|
| `dono` | Edson: tudo, inclusive usuários, DRE e encerramento |
| `gestor` | engenheiro/gestor de obras: operação completa das obras a que pertence; sem DRE de empresa |
| `financeiro` | orçamento, medição, contas, DRE, relatórios; sem campo |
| `campo` | mestre/estagiário: diário, fichas, ocorrências, pacotes, estoque; só leitura do resto |
| `cliente` | só leitura do relatório emitido e da validação/objeção da própria obra |
| `leitura` | consulta geral, sem escrita |

## Matriz (L = leitura, E = escrita, A = aprovar/travar, — = sem acesso)
| Área | dono | gestor | financeiro | campo | cliente | leitura |
|---|---|---|---|---|---|---|
| Obras/etapas/cronograma | LEA | LE | L | L | — | L |
| Diário, fichas, ocorrências | LEA | LEA | L | LE | — | L |
| Suprimentos (compras, estoque, locação) | LEA | LEA | LE | LE (estoque) | — | L |
| Contratos de prestador, termos, danos | LEA | LEA | LE | L | — | L |
| Orçamento, aditivos | LEA | LE (A aditivo) | LEA | — | — | L |
| Medição | LEA | LE | LEA | — | — | L |
| Contas a pagar, aportes | LEA | L | LEA | — | — | L |
| DRE, lançamentos, empresas | LEA | — | LEA | — | — | — |
| Relatório ao cliente | LEA | LE | LEA | — | L (emitido; valida/objeta) | L |
| Avaliações, lições | LEA | LEA | L | — | — | L |
| Encerrar/reabrir obra | LEA | — | — | — | — | — |
| Usuários e config global | LEA | — | — | — | — | — |

## RLS (regra geral)
- Leitura/escrita só se `exists(obra_membros)` para a obra do registro e o papel permitir a operação; `dono` vê tudo.
- `excluido_em is not null` oculto nas políticas de leitura; `DELETE` físico bloqueado para todos os papéis (só exclusão lógica).
- `cliente` tem políticas próprias: só `relatorios` com status `enviado` da obra dele.

## Perguntas ao Edson
1. A matriz acima está correta? Quem é o “gestor” hoje (há mais de uma pessoa)?
2. O cliente terá login próprio (recomendado) ou recebe o relatório por link/PDF?
3. O mestre de obras precisa ver valores (custos), ou só quantidades?
