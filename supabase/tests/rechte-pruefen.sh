#!/usr/bin/env bash
# Prueft die Autorisierungsschicht gegen eine leere Datenbank.
#
# Das Gegenstueck zu `leere-datenbank-pruefen.sh`: Der prueft, dass das Schema
# entsteht. Dieser prueft, was es erlaubt — ob ein Betrachter wirklich nur
# liest, ob die Firmengrenze haelt, ob das Protokoll anfuegend bleibt.
#
# supabase/README.md nennt die Autorisierungsschicht "den Teil, dessen Verlust
# am teuersten waere". Bis jetzt war sie der einzige Teil ohne Pruefung.
#
# Aufruf:
#   ./supabase/tests/rechte-pruefen.sh "postgresql://postgres@/wegwerf?host=/pfad/zum/socket&port=5432"
#
# Erwartet eine LEERE Wegwerf-Datenbank. Braucht weder Docker noch die
# Supabase-CLI, nur ein `psql` — dieselbe Linie wie beim Schwesterskript.
set -euo pipefail

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Aufruf: $0 <postgres-url einer leeren WEGWERF-Datenbank>" >&2
  exit 64
fi
if [[ "$URL" == *"supabase.co"* || "$URL" == *"supabase.com"* ]]; then
  echo "Abgelehnt: Diese URL zeigt auf Supabase. Das Skript legt Testdaten an und ersetzt has_org_role()." >&2
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

# Erst jetzt, nach den Migrationen: Die Huelsen aus den fremden
# Voraussetzungen werden durch fahrbare Fassungen ersetzt. Vorher ginge es
# nicht — die Policies, die von has_org_role() abhaengen, gibt es da noch
# nicht.
echo "Rechtelogik (nachgebildet, siehe Kopf der Datei):"
lauf "$HIER/fremde_rechtelogik.sql"

echo
echo "Pruefungen:"
# ON_ERROR_STOP steht in der Datei selbst; -q wuerde die NOTICE-Meldungen
# nicht unterdruecken, aber die \echo-Zwischenueberschriften lesen sich
# besser ohne den Befehlslaerm.
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$HIER/rechte_pruefen.sql"
