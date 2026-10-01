#!/usr/bin/env bash
# Gera supabase/aplicar-todas.sql: todas as migrações, em ordem, para colar no Editor SQL do Supabase.
# Uso: bash supabase/gerar-aplicar-todas.sh [--check]   (--check falha se o arquivo estiver desatualizado)
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
SAIDA="$AQUI/aplicar-todas.sql"
TMP=$(mktemp)
{
  echo "-- Controle de Obras Cariati — TODAS as migrações em ordem (gerado por supabase/gerar-aplicar-todas.sh)."
  echo "-- Cole no Editor SQL do projeto cariati-obras-dev e execute UMA vez. Em projeto novo e vazio."
  echo "-- Não contém segredos. Depois, rode supabase/primeiro-dono.sql trocando o e-mail."
  for f in "$AQUI"/migrations/*.sql; do echo; echo "-- ===== $(basename "$f") ====="; cat "$f"; done
} > "$TMP"
if [ "$1" = "--check" ]; then
  cmp -s "$TMP" "$SAIDA" || { echo "supabase/aplicar-todas.sql está desatualizado: rode bash supabase/gerar-aplicar-todas.sh"; exit 1; }
  echo "aplicar-todas.sql em dia"
else
  mv "$TMP" "$SAIDA"; echo "gerado: $SAIDA"
fi
