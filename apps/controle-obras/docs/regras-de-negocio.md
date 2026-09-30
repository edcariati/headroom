# Regras de negócio (fases 1 a 5)

Regras ambíguas e decisões estão em `DECISOES.md`. Parâmetros marcados como provisórios são editáveis.

## Modalidades
- **Gestão de Obras:** o cliente paga direto; o app mostra o desembolso previsto do cliente.
- **Administração de Obra:** o escritório paga (contas a pagar) e repassa; o repasse fica fora do resultado da DRE.

## Campo e conformidade
- Alerta crítico de CNO após 30 dias de obra sem cadastro.
- Compromisso no mesmo horário e responsável pede confirmação; reagendar exige motivo e conta reagendamentos.
- Ata exige decisões; ação exige responsável e prazo; material com ressalvas exige descrição.
- Pré-entrega vira ocorrência da etapa 21.

## Suprimentos
- Contratar prestador com nota média < 6 avisa antes.
- Compra, locação e medição geram contas a pagar (Administração).

## Orçamento e aditivos
- Importação CSV validada; versões (v1 imutável); orçamento revisado = base + aditivos assinados.
- Aditivo: rascunho → enviado → assinado/recusado.

## Medição (5 travas)
Documentos do mês, avanço dentro da tolerância, ficha, aditivo assinado, apontamento crítico. Retenção sobre (bruto − retido); descontos de dano. Com CPI ou SPI < 1, aprovar exige análise.

## Custo
Comprometido → apropriado → pago, sem dupla contagem. Painel por etapa com “Sem etapa”, “Sem orçamento” e “Acima do orçado”.

## Físico-financeiro (EVM)
BAC, PV, EV, AC, CPI = EV/AC, SPI = EV/PV, EAC = BAC/CPI; três curvas S em SVG.

## Curva ABC e referência
Faixas A/B por obra (padrão 50/90); alerta de item acima da referência + margem.

## DRE gerencial
- Receita prevista por competência (contrato do cliente); impostos pela alíquota da empresa (editável).
- Despesas gerais rateadas por receita ou manualmente.
- DRE por obra, por empresa e consolidado; o quadro por obra fecha com a empresa.

## Relatório ao cliente
Rascunho ao vivo; emissão congela os números; retificação cria novo registro; envio define prazo de objeção; cliente valida ou objeta.

## Avaliação
7 critérios, sugestões automáticas, justificativa obrigatória acima de 2 pontos de diferença da sugestão, nota ponderada.

## Encerramento e P0
Checklist de 9 itens (pendência exige justificativa); lições; ajuste do P0: economia → manter, déficit → ajustar pelo R$/m² real; só etapas liberadas ou com custo.

## Alertas e agenda (fase 5)
Ver D-5.7.x em `DECISOES.md`.
