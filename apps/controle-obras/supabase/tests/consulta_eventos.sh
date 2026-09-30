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
SQL
for m in "$AQUI"/../migrations/*.sql; do $P -f "$m" >/dev/null; done
$P -f "$1" >/dev/null
$P -c "select tipo||'|'||obra_id||'|'||registro_id from public.eventos_notificaveis('$2') order by 1"
