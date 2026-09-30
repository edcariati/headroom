# Esquema relacional proposto (Supabase) — RASCUNHO PARA CONFIRMAÇÃO

Nada foi criado no Supabase. Este documento é só desenho.

## Princípios
- Uma tabela por coleção atual (38), com colunas tipadas para o que é consultado/filtrado e uma coluna `dados jsonb` para o restante.
- Toda tabela: `id uuid pk`, `criado_em`, `criado_por`, `atualizado_em`, `atualizado_por`, `excluido_em` (exclusão **só lógica**), `versao int` (controle de concorrência).
- Tabelas com obra: `obra_id uuid fk → obras`. Dinheiro em `numeric(14,2)`.
- **RLS ligada em todas as tabelas.** Chave `service_role` nunca no app.

## Tabelas de sistema (novas)
- `perfis (user_id pk → auth.users, nome, papel, ativo)`
- `obra_membros (obra_id, user_id, papel_na_obra)` — quem enxerga qual obra
- `empresa_membros (empresa_id, user_id)` — quem enxerga a DRE da empresa
- `auditoria (id, tabela, registro_id, acao, antes jsonb, depois jsonb, user_id, em)` — alimentada por gatilho
- `config` (global) e `convites`

## Mapeamento das coleções
Grupos: **Campo** (obras, etapas, atividades, pacotes, diarios, fichas, ocorrencias, prestadores, eventos, atas, acoes, docsLegais, docsPrest, rfis, materiais, locs, servicos, treinamentos), **Suprimentos** (fornecedores, compras, movEstoque, locacoes, contratosPrest, termos, danos), **Custo** (orcamentos, orcItens, aditivos, medicoes, contasPagar, aportes), **Gestão financeira** (empresas, contratosCliente, lancamentos, relatorios, avaliacoes, licoes, config).
Colunas tipadas mínimas: `obra_id`, datas de filtro (`data`, `competencia`, `vencimento`), `status`, chaves estrangeiras (`prestador_id`, `contrato_id`, `empresa_id`), valores monetários.

## Anexos
Bucket privado `anexos`, caminho `obra_id/colecao/registro_id/arquivo`; políticas de Storage seguem as mesmas regras de acesso da obra. URLs assinadas de curta duração.

## Decisões que preciso que o Edson confirme
1. Colunas tipadas + `jsonb` (recomendado) ou tudo em `jsonb` como hoje?
2. Um único escritório (single-tenant) — confirmado?
3. Retenção da auditoria (sugestão: indefinida).
