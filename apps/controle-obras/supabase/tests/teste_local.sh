#!/usr/bin/env bash
# Valida a migração em um Postgres LOCAL descartável (não toca o Supabase).
set -e
D=$(mktemp -d); chmod 777 "$D"
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
su postgres -c "$PGBIN/initdb -D $D/d -A trust >/dev/null" && su postgres -c "$PGBIN/pg_ctl -D $D/d -o '-p 54399 -k $D' -l $D/log -w start >/dev/null"
trap 'su postgres -c "$PGBIN/pg_ctl -D $D/d -m immediate stop >/dev/null" || true' EXIT
export PGOPTIONS="-c client_min_messages=warning"
P="psql -h $D -p 54399 -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "create database t" >/dev/null
$P -d t <<'SQL'
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create role anon nologin; create role authenticated nologin;
SQL
$P -d t -f "$(dirname "$0")/../migrations/0001_base.sql"
$P -d t -f "$(dirname "$0")/../migrations/0002_regras.sql"
$P -d t -c "set role authenticated" >/dev/null
$P -d t -f "$(dirname "$0")/../migrations/0003_notificacoes.sql"
cat "$(dirname "$0")/teste_rls.sql" "$(dirname "$0")/teste_regras.sql" "$(dirname "$0")/teste_notif.sql" > "$D/todos.sql"
$P -d t -f "$D/todos.sql"
echo "RLS OK"
