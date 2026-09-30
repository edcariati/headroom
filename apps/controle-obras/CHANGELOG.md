# Changelog

## Fase 6 — Supabase com login e perfis (em andamento, sem projeto real ainda)

- **Passos 1 a 3:** desenho (`docs/migracao-supabase/`), migrações `0001` (tabelas, perfis, RLS, exclusão lógica, auditoria) e `0002` (regras críticas e acesso do cliente), testadas em Postgres local (`npm run test:rls`).
- **Passo 4:** app fala o esquema novo (`esquema: v2`): versão por linha com aviso de conflito, exclusão pela função do servidor, Realtime, tela de acesso não liberado; testado com Supabase simulado.

## Fase 7 — Notificações, pós-obra, offline e guia (em andamento)

- **Passo 1:** desenho em `docs/fase7/`.
- **Passo 2 (7A.1):** motor de notificações no banco (`0003`), 7 eventos com teste de equivalência servidor × app, silêncio 20h–7h, resumo diário, central de avisos no app.
- **Passo 3 (7A.2):** +5 eventos (ação, RFI, material, aditivo parado), resumo semanal da diretoria, mensagem pronta ao prestador por WhatsApp (link) com registro no histórico, preferências de aviso.
- **Passo 4 (7B):** pós-obra: garantias (prazos padrão vazios até o Edson informar), chamados com parecer, SLA e aceite do cliente, visitas de 30/90/180 dias, pesquisa de satisfação e indicador, custo de garantia no DRE, portal do cliente; migração `0005` e eventos de aviso do pós-obra.

## Fase 5 — DRE, relatório ao cliente e avaliação (concluída)

- **Passo 0:** navegação da obra agrupada (8 grupos com subabas), URLs antigas preservadas.
- **Passo 1:** empresas do grupo, empresa na obra, contrato do cliente e receita prevista por competência. Página DRE (menu do topo).
- **Passo 2:** lançamentos, fechamento mensal com sugestões (receita e imposto), rateio de despesas gerais e DRE por obra com período, anterior e acumulado; repasse da Administração fora do resultado.
- **Passo 3:** página DRE por empresa e consolidado, quadro por obra que fecha com a empresa, gráficos de 12 meses e ranking de margem, exportação CSV detalhada.
- **Passo 4:** relatório mensal ao cliente (11 seções), rascunho ao vivo, emissão com números congelados, retificação, envio com prazo de objeção, validação ou objeção do cliente, escolha de fotos, impressão A4 e download em HTML.
- **Passo 5:** avaliação de prestadores (7 critérios, sugestões automáticas, justificativa acima de 2 pontos, nota ponderada), ranking na página Prestadores, aviso ao contratar nota abaixo de 6 e avaliação pendente ao encerrar contrato.
- **Passo 6:** encerramento da obra (checklist de 9 itens com justificativa), lições aprendidas e ajuste do P0 (manter × ajustar, R$/m², incidência, referência CSV, curva real, exportação calibrada). Selo e aviso em obra encerrada.
- **Passo 7:** indicadores (margem, nota média, relatório), alertas e agenda da fase 5; cascata de exclusão preserva empresas, despesas gerais e configuração global; documentação em `docs/`.
- **Passo 8:** referência R$/m² por etapa entre obras encerradas da mesma tipologia; menu do topo quebra linha no celular.

## Fase 4 — Custo, medição e financeiro (concluída)

- **Passo 0:** código dividido em `src/` (`style.css`, `protocolo.json`, `core.js`, `p2.js`, `p3.js`, `p4.js`, `views.js`, `nuvem.js`, `boot.js`)
  e `build.py`, que gera o `index.html` único idêntico ao anterior. Bateria de testes das fases 1 a 3 com jsdom (`npm test`).

- **Passo 1:** aba Orçamento: importação de CSV com validação, versões (v1 base imutável) e comparação entre versões. Modelo CSV para baixar.
- **Passo 2:** aditivos (rascunho → enviado → assinado/recusado), orçamento revisado, botão “Gerar aditivo” na ocorrência e no material.
- **Passo 3:** aba Medição com as 5 travas (documentos do mês, avanço, ficha, aditivo assinado, apontamento crítico), retenção, descontos de dano e as duas modalidades. Campos novos na obra: tolerância de avanço e faixas da curva ABC.
- **Passo 4:** aba Financeiro: contas a pagar (geradas por medição, compra e locação), aportes do cliente e fluxo de caixa mensal com gráfico. Na Gestão, desembolso previsto do cliente.
- **Passo 5:** painel orçado × comprometido × apropriado × pago por etapa, com “Sem etapa”, “Sem orçamento” e “Acima do orçado”.
- **Passo 6:** aba Físico-financeiro com BAC, PV, EV, AC, CPI, SPI, EAC, três curvas S em SVG e quadro físico × financeiro. Aprovação de medição com CPI/SPI abaixo de 1 exige análise.
- **Passo 7:** indicadores de custo e prazo no resumo, alertas e agenda financeiros, cascata de exclusão das coleções novas.
- **Passo 8:** referência R$/m² por etapa entre obras encerradas da mesma tipologia; menu do topo quebra linha no celular.
- **Passo 8:** curva ABC dos materiais e preços de referência (CSV) com alerta de item acima da referência + margem.

## Fase 3 — Suprimentos
Fornecedores, compras, estoque, locações, contratos de prestador, termos de frente e danos.

## Fase 2 — Agenda e conformidade
Agenda, atas e ações, documentos legais e mensais, treinamentos, RFI, materiais, pré-entrega e linha de balanço.

## Fase 1 — Base e campo
Obras, 22 etapas, fichas de verificação, cronograma, semana e PPC, diário, ocorrências e prestadores.

## Nuvem
Supabase (login, tempo real, histórico de alterações, armazenamento de fotos e PDFs).
