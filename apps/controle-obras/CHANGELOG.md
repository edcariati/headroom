# Changelog

## Fase 4 — Custo, medição e financeiro (em andamento)

- **Passo 0:** código dividido em `src/` (`style.css`, `protocolo.json`, `core.js`, `p2.js`, `p3.js`, `p4.js`, `views.js`, `nuvem.js`, `boot.js`)
  e `build.py`, que gera o `index.html` único idêntico ao anterior. Bateria de testes das fases 1 a 3 com jsdom (`npm test`).

- **Passo 1:** aba Orçamento: importação de CSV com validação, versões (v1 base imutável) e comparação entre versões. Modelo CSV para baixar.
- **Passo 2:** aditivos (rascunho → enviado → assinado/recusado), orçamento revisado, botão “Gerar aditivo” na ocorrência e no material.

## Fase 3 — Suprimentos
Fornecedores, compras, estoque, locações, contratos de prestador, termos de frente e danos.

## Fase 2 — Agenda e conformidade
Agenda, atas e ações, documentos legais e mensais, treinamentos, RFI, materiais, pré-entrega e linha de balanço.

## Fase 1 — Base e campo
Obras, 22 etapas, fichas de verificação, cronograma, semana e PPC, diário, ocorrências e prestadores.

## Nuvem
Supabase (login, tempo real, histórico de alterações, armazenamento de fotos e PDFs).
