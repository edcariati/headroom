# Achados preliminares (fase 9, passos 0 e 5 antecipado)

Fontes externas consultadas em **01/10/2026**: [Supabase — Data API](https://supabase.com/docs/guides/database/data-api.md), [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security.md) e a [nota sobre concessões explícitas a partir de 30/05/2026](https://www.createwith.com/tool/supabase/updates/supabase-requires-explicit-permission-grants-for-new-tables-starting-may-30). Esta última é fonte secundária: **não confirmei na página oficial** o que cada projeto novo ou antigo recebe por padrão. Por isso o desenho **não depende do padrão do Supabase**: revoga e concede explicitamente.

## A-01 · RLS não protege TRUNCATE; privilégios padrão de tabela não eram revogados — **ALTO (crítico se o projeto herdar `ALL` para `authenticated`)**
- **Descrição:** a migração 0001 só revogava `anon` e concedia `select/insert/update` ao `authenticated`; **não revogava** o que o projeto concede por padrão. Em projetos Supabase com o padrão antigo (`ALL` em novas tabelas para `anon` e `authenticated`), qualquer usuário logado poderia executar `TRUNCATE` (que **ignora RLS**) em tabela de dados e apagar tudo, e `anon` teria privilégios de tabela (só a RLS o barraria).
- **Como reproduzir:** `PULAR_MIGRACAO=0007 bash supabase/tests/teste_local.sh` (o script simula o padrão permissivo): sem a correção, o teste de DELETE físico já reprova (`DELETE físico negado até ao dono`) e a suíte de permissões acusa TRUNCATE.
- **Correção:** `supabase/migrations/0007_endurecer_permissoes.sql`: revoga tudo de `anon` e `authenticated` em todas as tabelas e sequências, concede só o mínimo, e fixa o padrão para objetos futuros.
- **Prova:** `supabase/tests/teste_permissoes.sql` — como usuário logado (até a diretoria) tenta `TRUNCATE` e `DELETE` em **todas** as coleções e tabelas de sistema; confirma que `anon` não tem nenhum privilégio. Roda em `npm run test:rls` contra o pior caso.
- **Estado:** corrigido e provado **em Postgres local**. **Pendente:** repetir no projeto real (`cariati-obras-dev`) quando existir.

## A-02 · Funções internas executáveis por qualquer usuário — **MÉDIO**
- **Descrição:** `criar_tabela_colecao(text)` (cria tabelas e políticas) e as funções de gatilho (`trg_*`, `dados_sem_valores`) eram executáveis por `anon` e `authenticated` (herança do `EXECUTE` para PUBLIC). A primeira é executada com os direitos de quem chama; em projeto onde o usuário possa criar objetos no schema `public`, seria um caminho para criar tabelas.
- **Correção:** 0007 revoga `EXECUTE` de todas as funções e concede só a lista fechada (3 de apoio às políticas e 6 funções chamadas pelo app, cada uma valida o chamador por dentro).
- **Prova:** `teste_permissoes.sql` — `anon` sem função alguma; `authenticated` só a lista prevista; tentativa de `criar_tabela_colecao`, do motor de avisos e de `create table` por usuário logado falha.
- **Estado:** corrigido e provado em Postgres local.

## A-03 · Funções futuras herdariam `EXECUTE` público — **MÉDIO**
- **Correção:** 0007 `alter default privileges … revoke … on functions from public, anon, authenticated`. **Prova:** o teste de “lista fechada de funções” falha se alguém criar função nova sem conceder de propósito.
- **Estado:** corrigido e provado em Postgres local.

## Lacunas encontradas (viram achados no passo certo)
- **L-1 · Storage sem políticas:** não há política de Storage por obra e perfil no repositório. O esquema antigo (`schema.sql`) tinha o bucket da ponte; o desenho novo (caminho por obra, URL assinada, tipos e tamanhos) **ainda não foi escrito**. Hoje o app sobe a foto em `usuario/ano-mes/…` e abre por **URL pública** (`blobUrl`). **Provável achado ALTO** (anexo de outra obra acessível): a confirmar no passo 3.
- **L-2 · Sem funções de borda, sem convite, sem 2FA:** o e-mail de aviso, o convite de usuário pela diretoria e a autenticação em dois fatores **não foram implementados**; a criação de usuários e perfis é manual.
- **L-3 · Cabeçalhos de segurança (CSP etc.) dependem da hospedagem**, que ainda não foi escolhida.
- **L-4 · Dependência externa por CDN:** o app carrega a biblioteca do Supabase de um CDN (versão fixada, sem verificação de integridade `integrity=`). Recomendação: auto-hospedar ou usar SRI.
