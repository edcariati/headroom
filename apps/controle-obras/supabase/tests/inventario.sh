#!/usr/bin/env bash
# Inventário do banco (fase 9, passo 0): sobe um Postgres local descartável, aplica TODAS as migrações
# e imprime em Markdown: tabelas, RLS, políticas, funções (security definer, search_path), gatilhos, grants.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
D=$(mktemp -d); chmod 777 "$D"
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
su postgres -c "$PGBIN/initdb -D $D/d -A trust >/dev/null" && su postgres -c "$PGBIN/pg_ctl -D $D/d -o '-p 54396 -k $D' -l $D/log -w start >/dev/null"
trap 'su postgres -c "$PGBIN/pg_ctl -D $D/d -m immediate stop >/dev/null" || true' EXIT
export PGOPTIONS="-c client_min_messages=warning"
P="psql -h $D -p 54396 -U postgres -v ON_ERROR_STOP=1 -q -A -t -d postgres"
$P <<'SQL' >/dev/null
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
-- privilégios padrão PERMISSIVOS (pior caso, como em projetos Supabase antigos): a migração 0007 tem de neutralizar
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
SQL
for m in "$AQUI"/../migrations/*.sql; do $P -f "$m" >/dev/null; done
echo "## Tabelas e RLS"
echo "| Tabela | RLS ligada | RLS forçada | Políticas | Grants (authenticated) | Grants (anon) |"; echo "|---|---|---|---|---|---|"
$P -F '|' -c "select '| '||c.relname||' | '||case when c.relrowsecurity then 'sim' else '**NÃO**' end||' | '||case when c.relforcerowsecurity then 'sim' else 'não' end||' | '||coalesce((select string_agg(p.polname||'('||case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'todas' end||')', ', ' order by p.polname) from pg_policy p where p.polrelid=c.oid),'**nenhuma**')||' | '||coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants g where g.table_name=c.relname and g.grantee='authenticated'),'—')||' | '||coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants g where g.table_name=c.relname and g.grantee='anon'),'—')||' |' from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname"
echo; echo "## Funções"
echo "| Função | security definer | search_path fixo | Executável por |"; echo "|---|---|---|---|"
$P -c "select '| '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') | '||case when p.prosecdef then 'sim' else 'não' end||' | '||case when exists(select 1 from unnest(coalesce(p.proconfig,'{}')) x where x like 'search_path=%') then 'sim' else (case when p.prosecdef then '**NÃO**' else 'n/a' end) end||' | '||coalesce((select string_agg(distinct r.rolname, ',') from pg_roles r where r.rolname in ('anon','authenticated') and has_function_privilege(r.rolname, p.oid, 'execute')),'só dono')||' |' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname"
echo; echo "## Gatilhos"
$P -c "select '- '||event_object_table||': '||trigger_name||' ('||event_manipulation||')' from information_schema.triggers where trigger_schema='public' group by 1 order by 1" | sort -u | head -80
echo; echo "## Contagens"
$P -c "select 'tabelas='||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'"
$P -c "select 'tabelas sem RLS='||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"
$P -c "select 'tabelas com RLS e sem política='||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policy p where p.polrelid=c.oid)"
$P -c "select 'funções security definer sem search_path='||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) x where x like 'search_path=%')"
$P -c "select 'funções executáveis por anon='||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute') and p.proname not like 'trg\_%'"
$P -c "select 'políticas com using(true)='||count(*) from pg_policy where pg_get_expr(polqual, polrelid) = 'true' or pg_get_expr(polwithcheck, polrelid) = 'true'"
