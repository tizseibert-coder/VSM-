#!/usr/bin/env bash
# Faehrt die Migrationen dieses Verzeichnisses gegen eine leere Datenbank.
#
# supabase/README.md: "Ein Baseline, der nie auf einer leeren Datenbank lief,
# ist eine Vermutung." Das hier macht aus der Vermutung eine Pruefung — und
# zwar ohne Docker und ohne die Supabase-CLI, es genuegt ein Postgres.
#
# Aufruf:
#   ./supabase/tests/leere-datenbank-pruefen.sh "postgresql://postgres@/pfad?port=5432"
#
# Die Datenbank hinter der URL wird geloescht und neu angelegt. Auf die
# Produktion zeigen waere also das Ende der Produktion — deshalb der Riegel
# unten.
set -euo pipefail

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Aufruf: $0 <postgres-url einer WEGWERF-Datenbank>" >&2
  exit 64
fi
if [[ "$URL" == *"supabase.co"* || "$URL" == *"supabase.com"* ]]; then
  echo "Abgelehnt: Diese URL zeigt auf Supabase. Das Skript legt die Datenbank neu an." >&2
  exit 64
fi

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$(dirname "$HIER")"

lauf() {
  echo "  → $(basename "$1")"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$1"
}

echo "Fremde Voraussetzungen (Prisma/Supabase, nur nachgebildet):"
lauf "$HIER/fremde_voraussetzungen.sql"

echo "Migrationen:"
for datei in "$SUPA"/migrations/*.sql; do
  lauf "$datei"
done

echo "Seed:"
lauf "$SUPA/seed.sql"

echo
psql "$URL" -tAc "
  select 'Tabellen: '||count(*) from pg_tables
  where schemaname='public' and tablename in
    ('projects','processes','inventory_buffers','scenarios','spaghetti_layouts',
     'reports','historical_metrics','benchmark_data','benchmark_reference','activity_logs');"
psql "$URL" -tAc "select 'Policies: '||count(*) from pg_policy;"
psql "$URL" -tAc "select 'Referenzwerte: '||count(*) from benchmark_reference;"
echo "Durchgelaufen."
