# 7B — Pós-obra: desenho

## Tabelas (RLS por obra e perfil; valor de reparo em tabela separada)
| Tabela | Campos |
|---|---|
| `garantias` | obra, sistema/item, início (= `entregueEm`), `prazoMeses`, fim calculado |
| `garantia_prazos_padrao` | sistema, meses — **editável, vazia até o Edson fornecer os prazos** |
| `chamados_garantia` | obra, sistema/ambiente, descrição, fotos, urgência, `abertoPor`, status (`aberto`, `em_triagem`, `visita_agendada`, `em_atendimento`, `resolvido`, `negado`), `parecer` (`coberto`/`nao_coberto`/`parcial`) + justificativa (**obrigatória se negado/não coberto**), prestador, datas, aceite do cliente |
| `chamados_custos` | chamado, valor do reparo (visível só a diretoria, engenharia e administrativo) |
| `visitas_pos_obra` | obra, marco (30/90/180), data prevista/realizada, checklist (itens editáveis, fotos, observações), relatório curto |
| `pesquisas_satisfacao` | obra, marco (entrega/30/90/180), notas (recomendação 0–10, qualidade, prazo, comunicação, limpeza), comentário, respondida em |
| `pesquisa_tokens` | (alternativa sem login) hash do token, validade curta, uso único, tentativas |

## Regras
- `entregueEm` na obra dispara: garantias correndo, **3 eventos** na agenda (30/90/180 dias) e aviso à engenharia 7 dias antes. Sem `entregueEm`, garantia não corre.
- Alertas de garantia a vencer (60 e 30 dias) à engenharia.
- SLA configurável (provisório): 1ª resposta e resolução por urgência; descumprimento = aviso escalonado crítico.
- Cliente abre chamado no portal, acompanha e confirma a resolução; a equipe pode abrir em nome dele.
- Visita agendada cria evento na agenda da obra e mensagem pronta ao prestador.
- **Custo de garantia** vira lançamento de **custo direto** no DRE (categoria própria `garantia`), **sem reabrir competências emitidas**: lançamento entra no mês corrente, com nota explicativa, e o relatório já emitido não muda.
- Reincidência por prestador alimenta a avaliação (critério de conformidade) e a incidência de garantia por sistema alimenta lições/P0.
- Nota de satisfação < 7 (provisório) avisa a diretoria.

## Pesquisa de satisfação: login × token
Recomendação: **portal logado** (perfil cliente). Token só como alternativa para obra sem login: hash armazenado, validade curta (ex.: 7 dias), uso único, limite de 5 tentativas, abre **só** o formulário.

## Indicador “Satisfação do cliente”
Média e distribuição por obra, tipologia e geral; evolução entrega/30/90/180; ao lado das lições aprendidas.

## Portal do cliente (pré-requisito)
Login com perfil `cliente` vinculado à obra. Telas: relatório mensal emitido (já no servidor), chamados, relatório de visita, pesquisa. O cliente **nunca** vê tabelas internas (RLS já nega).

## Decisões que preciso do Edson
1. Prazos de garantia por sistema e texto do Termo (não serão inventados).
2. SLA inicial (horas/dias) por urgência — começo com: crítica 1 dia / alta 3 / média 7 / baixa 15 para 1ª resposta? (provisório, editável)
3. Cliente com login próprio (recomendado) ou token?
4. O cliente recebe aviso de garantia a vencer?
