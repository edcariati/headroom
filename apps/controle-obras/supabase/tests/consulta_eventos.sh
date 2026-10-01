#!/usr/bin/env bash
# Uso: consulta_eventos.sh <seed.sql> <AAAA-MM-DD>  → imprime "tipo|obra|registro" ordenado.
# Sobe um Postgres local descartável, aplica as migrações, carrega o seed e chama eventos_notificaveis.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
D=$(mktemp -d); chmod 777 "$D"
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
su postgres -c "$PGBIN/initdb -D $D/d -A trust >/dev/null" && su postgres -c "$PGBIN/pg_ctl -D $D/d -o '-p 54397 -k $D' -l $D/log -w start >/dev/null"
trap 'su postgres -c "$PGBIN/pg_ctl -D $D/d -m immediate stop >/dev/null" || true' EXIT
export PGOPTIONS="-c client_min_messages=warning"
P="psql -h $D -p 54397 -U postgres -v ON_ERROR_STOP=1 -q -t -A -d postgres"
$P <<'SQL' >/dev/null
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
-- privilégios padrão PERMISSIVOS (pior caso, como em projetos Supabase antigos): a migração 0007 tem de neutralizar
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
-- STUB do schema storage do Supabase (só o necessário para testar as políticas; o real só existe no projeto)
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid(), metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert on storage.objects to authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
SQL
for m in "$AQUI"/../migrations/*.sql; do $P -f "$m" >/dev/null; done
$P -f "$1" >/dev/null
$P -c "select tipo||'|'||obra_id||'|'||registro_id from public.eventos_notificaveis('$2') order by 1"
