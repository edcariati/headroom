# Fase 7 — Passo 0: conferência de partida

| Item | Situação |
|---|---|
| Fases 1 a 5 | Concluídas, 186 testes verdes (app em Node + jsdom). |
| Fase 6 | **Parcial.** Migrações `0001`/`0002` validadas em Postgres local; app fala o esquema novo testado só com **Supabase simulado**. **Não há projeto `cariati-obras-dev` real**, então nada foi aplicado nem testado com login real. |
| Ambiente de desenvolvimento no ar | **Não.** Bloqueia a entrega real dos blocos 7A (e-mail, agendador no banco) e 7B (login do cliente). |
| Login do cliente | Perfil `cliente` existe na RLS (lê relatório emitido; valida por RPC). Falta tela/portal e vínculo cliente–obra por usuário (hoje `obra_membros`). |

**Como esta fase procede enquanto o Supabase real não existe:** tudo que dá para provar em Postgres local e jsdom é construído e testado assim (regras de notificação em SQL, RLS das tabelas novas, fila offline com IndexedDB falso). O que depende de serviço externo (e-mail, agendador `pg_cron`, Edge Functions, push) fica com interface pronta e teste com provedor simulado, marcado “não validado de verdade”.

## O que só o Edson faz (seção 0 do prompt) — lista viva
1. Criar o projeto `cariati-obras-dev` no Supabase (URL + chave `anon`; nunca `service_role`).
2. Escolher provedor de e-mail transacional e configurar o domínio (SPF/DKIM); a chave entra como segredo do Supabase.
3. Decidir se haverá WhatsApp por API. **Padrão: não.** Usa-se `wa.me` com mensagem pronta (sem custo).
4. Confirmar horário silencioso (20h–7h), resumo diário (7h, dias úteis) e semanal (segunda, 7h).
5. Fornecer **prazos de garantia por sistema** e o modelo do Termo de Garantia (não serão inventados).
6. Convidar clientes para o portal quando o 7B estiver pronto.
7. Escolher obra piloto e pessoas do treinamento.
