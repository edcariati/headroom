# Modelo de dados (fases 1 a 5)

Toda coleção guarda documentos JSON com `id`. Quase todas têm `obraId`. Nesta versão os dados ficam na tabela ponte `registros` (colecao, id, dados jsonb); o desenho relacional fica para a fase 6. Dinheiro sempre com 2 casas (`r2`). Datas em `AAAA-MM-DD`; competência em `AAAA-MM`.

## Fase 1 — Base e campo
| Coleção | Conteúdo principal |
|---|---|
| `obras` | nome, cliente, tipologia, modalidade (Gestão de Obras / Administração de Obra), área, início, metaPPC, diasEscalar, margemPreco, alçada, `empresaId`, `tolerAvanco`, `abcA`, `abcB`, `encerradoEm` |
| `etapas` | 22 etapas por obra: número, status, liberada, datas |
| `atividades` | cronograma: nome, etapa, prestadorId, início, fim, avanço (%) |
| `pacotes` | pacotes da semana (PPC) |
| `diarios` | diário de obra |
| `fichas` | fichas de verificação por etapa |
| `ocorrencias` | gravidade, etapa, origem (ex.: `pre_entrega`), prazo, status |
| `prestadores` | cadastro, seguro, treinamento |

## Fase 2 — Agenda e conformidade
`eventos` (agenda, reagendamentos), `atas`, `acoes` (responsável e prazo), `docsLegais` (CNO etc.), `docsPrest` (documentos mensais por prestador: inss, fgts, folha, certidões), `rfis`, `materiais` (decisões/amostras, níveis de aprovação), `locs` e `servicos` (linha de balanço), `treinamentos`.

## Fase 3 — Suprimentos
`fornecedores`, `compras` (pedido, entrega, histórico), `movEstoque` (entrada/saída por item e etapa), `locacoes` (equipamento, apontamentos, aprovação), `contratosPrest` (escopo, valor, retenção, período, status, `encerradoEm`), `termos` (termo de frente), `danos` (causador, custo, rateio).

## Fase 4 — Custo, medição e financeiro
| Coleção | Conteúdo principal |
|---|---|
| `orcamentos` | versão (v1 base imutável), total, por etapa e por tipo, nº de lotes |
| `orcItens` | lotes de até 150 itens (`orcId`, `lote`); doc `ref_<obra>` guarda preços de referência |
| `aditivos` | rascunho → enviado → assinado/recusado; valor; assinatura |
| `medicoes` | contratoId, número, período, itens, retenção, descontos, justificativas, status |
| `contasPagar` | origem (medição, compra, locação), vencimento, valor, status, `pagoEm` |
| `aportes` | aportes do cliente |

## Fase 5 — DRE, relatório e avaliação
| Coleção | Conteúdo principal |
|---|---|
| `empresas` | nome, cnpj, alíquota de impostos, critério de rateio (receita/manual), rateio manual, ativa |
| `contratosCliente` | doc `cc_<obra>`: valor, honorários/taxa, vigência, receita prevista por competência |
| `lancamentos` | empresaId, obraId (vazio = despesa geral), competência, categoria, subcategoria, valor, origem, anexos |
| `relatorios` | obraId, mês, status (rascunho/emitido/enviado), texto, fotos, números congelados, prazoObjecao, validacaoCliente, retificacaoDe |
| `avaliacoes` | prestadorId, contrato, 7 critérios (nota e justificativa), nota final ponderada |
| `licoes` | causas de desvio e orçado × realizado por etapa |
| `config` | `p0_mapa` (etapa→disciplina), `p0_ref` (referência CSV), `p0_<obra>` (ajustes) |

## Exclusão de obra
Em cascata apaga tudo com `obraId` da obra. Preserva `empresas`, lançamentos sem obra (despesas gerais) e a config global.

## Fase 7B — Pós-obra (novas coleções)
`garantias` (obra, sistema, início, prazo em meses, fim), `chamadosGarantia` (sistema, ambiente, descrição, urgência, status, parecer + justificativa, prestador, SLA gravado, aceite do cliente, histórico), `chamadosCustos` (valor do reparo, separado para controlar quem vê), `visitasPosObra` (marco 30/90/180, previsão, checklist, resumo, fotos), `pesquisasSatisfacao` (id `obra_momento`, notas 0–10, comentário). Configurações em `config`: `garantia_prazos`, `sla_garantia`, `posobra_checklist`. A obra ganha `entregueEm`. Cascata de exclusão inclui as cinco coleções.
