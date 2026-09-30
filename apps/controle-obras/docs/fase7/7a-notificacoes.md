# 7A — Notificações e cobrança escalonada: desenho

## 1. Decisão central: onde as regras de alerta rodam
Hoje os alertas são calculados no navegador (`alertasObra` → P2 → P3 → P4 → P5; ~45 regras). Para notificar, o servidor precisa calcular sozinho.

**Proposta (recomendada): regras de notificação em SQL, só para os eventos do catálogo (Anexo B), e o navegador continua calculando os alertas que mostra na tela.** Duas implementações, travadas por um **teste de equivalência**:
1. Um seed de dados (JSON) é carregado no app (jsdom) e no Postgres local.
2. O app produz a lista `{evento, obra, chave}` a partir de `alertasObra`/`eventos*`; o Postgres produz a lista pela função `eventos_notificaveis(agora)`.
3. O teste exige listas iguais, com data simulada.
Alternativa descartada por ora: o app ler sempre os alertas do servidor (elimina duplicação, mas perde a resposta imediata na tela e o uso offline).
**Custo honesto:** portar ~25 eventos para SQL é trabalho grande; o passo 2 entrega o motor + ~10 eventos de maior valor (críticos e vencimentos) e o restante entra no passo 3.

## 2. Tabelas novas (todas com RLS)
| Tabela | Campos principais |
|---|---|
| `notificacao_regras` | `tipo`, `ativo`, `canais` (app/email), `antecedencia_dias`, `perfis_destino`, `critico` |
| `notificacoes` | `id`, `user_id`, `tipo`, `obra_id`, `titulo`, `corpo`, `link`, `chave` (idempotência, **única por user_id+chave**), `criada_em`, `lida_em` |
| `notificacao_entregas` | `notificacao_id`, `canal`, `estado` (pendente/enviada/falhou), `tentativas`, `erro`, `enviada_em` |
| `notificacao_preferencias` | `user_id`, `canais`, `silencio_ini/fim`, `resumo_diario`, `por_obra` |
| `contatos_prestador` (histórico de `wa.me`) | `obra_id`, `origem` (ocorrência/ação), `origem_id`, `canal`, `texto`, `por`, `em` |

Acesso: usuário lê/atualiza (lida_em) só as próprias `notificacoes`; regras só a diretoria; entregas só o servidor.

## 3. Motor
- `pg_cron` (fuso `America/Sao_Paulo`): a cada 15 min → `gerar_notificacoes(agora)`; dias úteis 7h → resumo diário; segunda 7h → resumo semanal.
- `gerar_notificacoes(agora timestamptz)` recebe a hora **por parâmetro** (testável em tempo simulado), insere com `on conflict (user_id, chave) do nothing` (idempotência).
- Chave = `tipo:registro:janela` (ex.: `apont_vencido:oc123:d0`, `apont_escalado:oc123:d7`). Escada: um aviso por degrau, nunca um por dia.
- Entrega por e-mail: Edge Function lê `notificacao_entregas` pendentes, chama o provedor, marca estado; reenvio com espera crescente (1, 5, 30, 120 min); limite de N envios por usuário/hora.
- Horário silencioso: entregas de e-mail adiadas para 7h; crítico fura o silêncio **só por e-mail**; o app (central) sempre recebe.

## 4. Responsável como usuário
`acoes.responsavel` e similares são texto livre. Proposta: campo opcional `responsavelUserId` (select de usuários) ao lado do texto; sem ele, o aviso vai para a engenharia da obra. Migração: nada é forçado; o texto livre continua valendo para cobrança manual.

## 5. Mensagem montada para um destinatário (sem vazar valores)
Função única `montar_mensagem(tipo, payload, papel_destino)`: a **lista de campos permitidos por papel** é uma tabela (`mensagem_campos`). Papéis `campo` e apoio técnico nunca recebem campos monetários; o teste monta cada tipo para cada papel e falha se achar `R$` ou números de tabelas protegidas.

## 6. Mensagem ao prestador (`wa.me`)
Modelo editável por tipo (apontamento, prazo, equipamento…), botão “Enviar pelo WhatsApp” abre `https://wa.me/<fone>?text=<texto codificado>` e grava em `contatos_prestador`. Nenhuma API e nenhum custo. **Verificar documentação e preços atuais antes de recomendar a API oficial** (não feito ainda; só se o Edson decidir).

## 7. Push web (opcional)
Não será prometido. Antes de implementar: verificar suporte atual por navegador/iPhone (PWA instalado). Entra só se funcionar de forma confiável.

## 8. Catálogo de eventos: mapeamento para o que já existe
| Evento (Anexo B) | Regra atual no app | Observação |
|---|---|---|
| Ocorrência crítica aberta | `alertasObra` (crítica aberta) | imediato, crítico |
| Apontamento vencendo/vencido/escalado | `vencidaOc`, `atrasoOc`, `diasEscalar` | escada d-1 / d0 / d+diasEscalar |
| Ação vencendo/vencida | agenda de ações P2 | precisa `responsavelUserId` |
| Item crítico com data-limite de pedido | materiais/compras P3 | 7d, 1d, vencido |
| Compra aguardando aprovação do cliente | compras P3 | `diasEscalar` |
| Conta a pagar / aporte atrasado | `alertasP4` | sem valor para campo/apoio |
| Medição em análise há N dias | medições P4 | a definir campo “enviadaEm” |
| Documentos/treinamentos vencendo | docs P2 | 30 e 7 dias |
| PPC abaixo da meta 2 semanas | PPC P1/P2 | segunda-feira |
| CPI/SPI < 1 na aprovação | `medAprovar` P4 | no ato da aprovação |
| Relatório não emitido; validação pendente | `alertasP5` | já existe |
| Garantia, visita, chamado, satisfação | **novos** (7B) | |

## 9. Decisões que preciso do Edson
1. Catálogo e destinatários do Anexo B estão corretos? Algum evento a cortar (para não incomodar)?
2. Horário silencioso 20h–7h e resumos (7h, dias úteis; semanal segunda) ok?
3. `responsavelUserId` opcional nas ações: ok?
4. O cliente recebe e-mail ou só aviso no portal?
