# Gestão integrada: quinzenal, pedidos de pagamento, meta × evolução, pagamentos e prazos, fora do escopo

Pedido do Edson (seis situações + fora do escopo). Tudo dentro do app, na obra, e ligado ao **Fluxo geral** (painel "Ritos de gestão") e ao **painel de indicadores**.

| # | Situação | Onde está no app | Como funciona |
|---|---|---|---|
| 1 | Relatório da obra a cada 15 dias | Obra › Gestão › **Relatório quinzenal** | Tarefa da engenharia na Agenda (1ª a 15 e 16 ao fim do mês, prazo 2 dias após fechar a quinzena). Campos: resumo, "onde estamos e o que precisamos do cliente", próximos passos, fotos (envio novo ou do diário). O avanço, a meta × evolução, o PPC e as pendências vêm do app. Emitido = congelado; correção = retificação. Registro de envio e validação do cliente reaproveitam o relatório mensal. **Sem valores em R$** (só percentuais). |
| 2 | Físico × financeiro | Obra › Custo › **Meta × evolução** (e Físico-financeiro, que já existia) | Por etapa: meta do cronograma até hoje × executado × % pago. Alerta quando o pago passa do executado em mais de 10 pontos (aviso a partir de 5) ou o físico fica 10 pontos atrás da meta. |
| 3 | Pedidos de pagamento, vários orçamentos, cotações | Obra › Custo › **Pedidos de pagamento** (compras e cotações de material continuam em Suprimentos) | Pedido → orçamentos recebidos (mínimo 3, ou justificativa de dispensa) → escolha (se não for o menor valor, justificativa) → envio → aprovação por alçada → conta a pagar → baixa. Entra no custo da etapa (comprometido ao aprovar, pago ao pagar). |
| 4 | Final de obra × compras | Obra › Encerramento | Itens novos no checklist (compras e conferências, locações, pedidos de pagamento, fora do escopo) e o quadro "Alinhamento final com compras". Alerta de fim de obra quando a etapa 21 começa ou a última atividade termina em até 30 dias. |
| 5 | Meta × evolução × pagamentos | Aba **Meta × evolução**, KPI no painel, alerta da obra e Fluxo geral | KPI "Etapas alinhadas" (% das etapas em andamento sem desvio) e "Pago ÷ executado (IPE)", mais "pago adiante do executado" em R$. No Fluxo geral aparece em "Ritos de gestão" e no detalhe de cada etapa. |
| 6 | Pagamentos a fazer, prazos e fluxo do mês | Obra › Custo › **Pagamentos e prazos** | A pagar (vencidos, 7 e 30 dias), prazos de entrega (compras, locações, atividades dos prestadores, pedidos) e o **fluxo do mês × programação da etapa**: quanto o cronograma programa para cada etapa no mês × o que está a pagar e o que foi pago. Sinaliza "pagamento sem programação" e "etapa programada sem pagamento previsto". |

## Fora do escopo (compra, contratação ou pagamento que não estava combinado)

Regra única, vale para **compras** e **pedidos de pagamento** (contratação de serviço entra como pedido de pagamento do tipo "Prestador"):

1. **Marcar** "fora do escopo" e dizer por quê (mesma lista dos tipos de ocorrência: solicitação do cliente, imprevisto, exigência de órgão, falha de projeto…). Se o serviço cai numa etapa **sem orçamento**, o app exige a marcação.
2. **Aditivo**: criar o aditivo na aba Orçamento (itens, valor, prazo) e **vincular** ao pedido ou à compra.
3. **Cliente assina**: só com o aditivo **assinado** o item pode ser aprovado, pedido e pago. Aprovação do cliente por escrito é sempre registrada (data, referência, anexo).
4. **Emergência** (esperar o aditivo causa risco a pessoas ou à obra): o cliente autoriza **por escrito**; o app registra a autorização e abre o prazo de **5 dias** para regularizar o aditivo. Vencido o prazo, vira alerta crítico e evento na Agenda.
5. No relatório quinzenal e mensal, o item aparece nas **pendências de decisão do cliente** até o aditivo ser assinado.

## Decisões que precisam do Edson (valores provisórios no código)

- Mínimo de orçamentos por pedido: **3** (constante `ORC_MIN`).
- Tolerâncias do alinhamento: pago adiante do físico **10 pontos** (aviso em 5); físico atrás da meta **10 pontos**.
- Prazo do relatório quinzenal: **2 dias** após fechar a quinzena.
- Prazo para regularizar aditivo de emergência: **5 dias**.
- Janela de fim de obra: **30 dias** antes da última atividade (ou etapa 21 iniciada).
- Contratação de prestador fora do escopo: hoje passa pelo pedido de pagamento; o contrato em si continua sendo cadastrado em Contratos. Definir se queremos travar o cadastro do contrato até o aditivo assinado.

## Dados e segurança

- Nova coleção `pedidosPag` (grupo **financeiro**: dono, gestor e financeiro; campo e cliente não leem nem gravam). Migração `0009_pagamentos.sql`, testada em `supabase/tests/teste_pagamentos.sql`.
- Relatório quinzenal usa a tabela `relatorios` (`tipo = 'quinzenal'`, `mes = 'AAAA-MM-Q1|Q2'`); o cliente só vê os emitidos (política já existente).
- Abas com R$ (pedidos, pagamentos e prazos, meta × evolução) não aparecem para campo; o cliente só vê Garantias, Chamados, Visitas, Satisfação, Relatório mensal e **quinzenal**.
- Notificações do servidor (`eventos_notificaveis`) **ainda não** incluem o relatório quinzenal nem o prazo de emergência; hoje esses avisos vivem na Agenda e nos alertas do app. Pendente para a fase de notificações.
