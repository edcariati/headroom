# Vobi × Controle de Obras Cariati

Base: 15 prints da plataforma Vobi (projeto CA250804, conta Cariati), enviados pelo Edson. Não houve acesso direto à plataforma. **Só consta aqui o que apareceu nos prints**; o que não apareceu está marcado "não visto".

## O que os prints mostram

| Área da Vobi | O que vimos | Nosso app |
|---|---|---|
| Menu lateral | Home, Projetos, Oportunidades, Administrativo, Gestão de Tarefas, Compras e Contratações, Gestão de Obras (Planejamentos, Diário), Estoque, Financeiro, Vobi Pay, Ferramentas, Cadastros | Menu superior: Obras, Visão geral, Agenda, Prestadores, Fornecedores, Fluxo, DRE |
| Projeto › Geral | Detalhes gerais (descrição, código, origem, endereço, valor estimado e ganho, datas), **etiquetas coloridas**, dados do cliente, **próximas tarefas**, **próximos pagamentos**, resumo de atividades | Resumo da obra com alertas e indicadores. **Agora também** "Próximas tarefas" e "Próximos pagamentos". Sem etiquetas nem valor ganho |
| Barra do projeto | Abas Geral, Orçamento, Tarefas, Obra, Compras, Estoque (bloqueada por plano), Financeiro, Anotações, Arquivos, Documentos; **Compartilhar**; **Ver como cliente**; avatares da equipe | Grupos de abas por obra. Sem "Ver como cliente" nem compartilhar por link |
| Orçamento | Lista hierárquica (grupo › subgrupo › item), colunas Grupo, Categoria, Un., Qtd., Custo un., Preço total, **Status colorido por item**; busca, filtro, relatórios, **Criar documento**, total | Importa orçamento por etapa e aditivos. Sem status por item nem composição editável |
| Obra › Planejamento | Lista/Gantt, filtro por período, responsável por linha | Cronograma, Gantt, balanço, semana e PPC (mais completo em campo) |
| Obra › Medições | Tela vazia com "Nova medição" | Medição de prestadores com retenção e travas |
| Obra › Físico-Financeiro e Curva S | **Configuração**: periodicidade (mensal…), valores previstos (**preço com BDI** ou custo sem BDI), valores realizados (**pagamentos do cliente** ou despesas do negócio) | Curva S e físico × financeiro fixos; sem escolha de periodicidade nem de base de valor |
| Obra › Diário | Lista com data, status, **código sequencial**, **nº de fotos**, origem, criado por; editar, **imprimir**, **duplicar**, excluir; **Exportar PDF**; vista lista/grade; filtro por período; "agente de IA" (bloqueado) | Diário com fotos e relatório. Sem duplicar, grade nem exportar a lista |
| Compras › Solicitações | Código **SC00090**, nome ("Mat- …"), criação, necessidade, custo previsto, status, **prioridade**, responsável, origem; **abas de situação com contagem** (Rascunho, Abertas, Aprovadas, Cotação, Compra e contratação, Recusadas, Finalizadas); paginação | Quadro por situação. **Agora também** lista com filtro por situação, **código SC**, **prioridade** e colunas parecidas |
| Compras › Cotações | Código **QT00117**, nº de fornecedores, status (Aberta, Resposta pendente, Cotada…), vínculo com a solicitação (SC) | Mapa de cotações dentro da compra, sem lista própria nem código |
| Compras › Ordens de compra | Código **OC00444**, fornecedor, custo realizado, status (Aprovada, Enviada, Confirmada…) | Pedido dentro da compra, sem lista nem código próprios |
| Compras › Contratos | Contratos e medições com terceiros; filtro por status | Contratos de prestadores e medições |
| Compras › Panorama | Existe; conteúdo **não visto** | Visão geral › Compras |
| Financeiro | **Resumo**: receitas e despesas (em aberto, vencido, recebido/pago, com contagens), balanço com barras; **próximas receitas e despesas** (parcela "15/18"); abas Pagamentos do cliente, Receitas, Despesas, Resultados, **Orçado × Realizado** | Contas a pagar, aportes, DRE, Visão geral › Finanças. Sem receitas parceladas por projeto nem aba Orçado × Realizado |
| Anotações | Blocos de notas, atas de reunião, compartilháveis com o cliente | Reuniões e atas |
| Arquivos | Pastas e subpastas, abas Todos/Pessoais/Compartilhados/Cliente | Documentos por obra |
| Documentos | **Gerador de propostas e contratos** com templates | Não temos |
| Fora dos prints de projeto | Oportunidades (CRM), Administrativo, Vobi Pay, Ferramentas, Cadastros, Estoque (bloqueado) | Não temos CRM nem pagamento integrado |

## Onde o nosso app já é mais forte
Protocolo de 22 etapas com portas de liberação e fichas; PPC e causas; alçada e fora do escopo com aditivo; pedidos de pagamento com mínimo de orçamentos; relatório quinzenal e mensal congelados; meta × evolução × pagamentos com KPI; Visão geral com horizontes de 7 a 120 dias; offline.

## Lacunas, em ordem de prioridade
1. **Lista própria de cotações e de ordens de compra, com código** (QT e OC). Já fizemos código e lista das solicitações.
2. **Configuração do físico-financeiro e da Curva S**: periodicidade, preço com BDI × custo sem BDI, pagamentos do cliente × despesas.
3. **Resumo financeiro por obra** com cartões Em aberto / Vencido / Recebido / Pago e balanço, e **próximas receitas**.
4. **Aba Orçado × Realizado** por obra (hoje está espalhada entre custo por etapa e DRE).
5. **"Ver como cliente"**: pré-visualizar o que o cliente enxerga.
6. **Diário**: duplicar relatório, exportar lista em PDF, vista em grade, contagem de fotos na lista.
7. **Gerador de propostas e contratos** a partir de templates.
8. **Etiquetas** nas obras e valor estimado/ganho.
9. **Orçamento com status por item** e composição.
10. **Oportunidades (CRM)** e **Vobi Pay** (pagamentos integrados): maior esforço, dependem de decisão de negócio.

## Não visto
Estoque (bloqueado no plano), Panorama de compras, Tarefas, aba Receitas, Despesas, Resultados, Orçado × Realizado, Administrativo, Cadastros, Ferramentas. Para fechar a análise, mandar prints dessas telas.
