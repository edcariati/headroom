# Operação — PARA CONFIRMAÇÃO

- **Segredos:** `.env` no `.gitignore`; `.env.example` sem valores (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). `service_role` nunca no app, no repositório ou no navegador; usada só em script administrativo local do Edson.
- **Ambientes:** `cariati-obras-dev` (trabalho) e produção (passo 8).
- **Backups:** backup diário do Supabase + exportação mensal (CSV/JSON) guardada pelo Edson.
- **Usuários:** convite por e-mail; desativar em vez de excluir.
- **Auditoria:** consulta por obra/registro, tela só para `dono`.
- **Testes:** testes de RLS (cada papel × cada tabela) rodando contra o dev antes de cada liberação.
- **Monitoramento:** logs do Supabase; alerta de falhas de RPC.
