# Datenbank: wer besitzt was

Der VSM Builder teilt sich **eine** Postgres-Datenbank und **ein** `public`-Schema
mit zwei anderen Produkten. Das ist eine bewusste Entscheidung vom 16.08.2026
(gemeinsames Login fuers Freemium-Modell, ein Supabase-Projekt statt drei), aber
es bedeutet: zwei Migrationssysteme arbeiten auf demselben Schema.

Diese Datei legt die Grenze fest. Sie ist nicht Buerokratie — die Verletzung
dieser Grenze hat am 16.08. die Registrierung **aller drei Produkte** lahmgelegt
und es ist bis zum 30.08. niemandem aufgefallen.

## Die Aufteilung

| Objekte | Eigentuemer | Wo |
|---|---|---|
| `organizations`, `organization_members`, `organization_entitlements` | Prisma | `D:\LeanPulse Industrial\apps\api\prisma\migrations\` |
| Alle PascalCase-Tabellen (`Machine`, `TrackingLog`, `User`, …) | Prisma | dito |
| `handle_new_user()`, `has_org_role()` + deren Policies | Prisma | dito |
| `projects`, `processes`, `inventory_buffers`, `scenarios`, `spaghetti_layouts`, `reports`, `historical_metrics`, `benchmark_data`, `benchmark_reference`, `activity_logs` | VSM Builder | `supabase/migrations/` (hier) |
| `project_org_id()`, `set_updated_at()` + die Policies auf obigen Tabellen | VSM Builder | dito |
| `consulting_leads` | Landing-Page | `D:\LeanPulse Landing` |

Faustregel: **Wer die Tabelle besitzt, besitzt alles, was an ihr haengt** —
Policies, Trigger, Indizes. Funktionen gehoeren dorthin, wo die Tabellen liegen,
die sie lesen.

## Die Regeln

1. **Nie ein Objekt anfassen, das dem anderen System gehoert.** Wenn du es
   brauchst, gehoert die Aenderung ins andere Repository.
2. **Aenderungen an `organizations` & Co. immer gegen `handle_new_user()`
   pruefen.** Genau das wurde am 16.08. versaeumt: die Migration fuegte
   `organizations.slug NOT NULL` hinzu, der Trigger fuellte die Spalte nicht,
   und jede Registrierung brach ab.
3. **Kein `prisma migrate dev` gegen diese Datenbank.** `dev` vergleicht
   `schema.prisma` mit der Datenbank und generiert die Differenz — die
   VSM-Tabellen stehen dort nicht drin, es wuerde sie **loeschen** wollen. Nur
   `prisma migrate deploy`, das ausschliesslich vorhandene Migrationsdateien
   anwendet. (Die Migrationen dort sind aus demselben Grund handgeschrieben.)
4. **Nichts direkt im Supabase-SQL-Editor aendern.** Wenn es doch passiert:
   sofort eine idempotente Migration nachziehen, die denselben Zustand
   herstellt.
5. **Der Dateiname traegt die Version, die in der Datenbank steht.** Wer eine
   Aenderung ueber den SQL-Editor oder das Supabase-Werkzeug anwendet, bekommt
   dort einen Zeitstempel zugeteilt, den er sich nicht aussuchen kann. Die
   nachgezogene Datei (Regel 4) muss genau diesen Namen tragen — sonst haelt
   `db push` sie fuer eine neue Migration und wendet sie ein zweites Mal an.
   Nachsehen mit:

   ```sql
   select version, name from supabase_migrations.schema_migrations order by version;
   ```

## Stand dieses Verzeichnisses

Angelegt am 30.08.2026 — vorher hatte der VSM Builder **gar keine** Migrationen,
das komplette Schema existierte nur in der Produktivdatenbank.

Enthalten:

- `migrations/20260830160000_vsm_authorization_layer.sql` — Hilfsfunktionen,
  RLS und alle Policies der VSM-Tabellen, plus die `updated_at`-Trigger. Das
  ist der Teil, dessen Verlust am teuersten waere: der VSM Builder greift
  ausschliesslich als `authenticated` ueber PostgREST zu und hat keine API mit
  Owner-Rechten, die RLS umgehen koennte. Ohne Policies ist die Anwendung nicht
  unsicher, sondern funktionslos.
- `migrations/20260901174003_future_state_wizard_fields.sql` — die vier
  Spalten der Wizard-Fragen 6 bis 8, ebenfalls nachtraeglich eingecheckt.
- `migrations/20260903212855_piece_value_and_currency.sql` — `piece_value` und
  `currency` auf `projects`, fuer das gebundene Kapital.
- `seed.sql` — die Referenzwerte des Branchenvergleichs.

Die beiden letzten hiessen bis zum 04.09. `20260901120000` und
`20260903180000` — Zeitstempel, die beim Schreiben der Datei entstanden und
nicht die, unter denen die Datenbank sie verzeichnet hat. `db push` haette
beide ein zweites Mal angewandt (folgenlos, weil idempotent, aber mit einem
zweiten Eintrag fuer dieselbe Aenderung). Daher jetzt Regel 5.

`20260830160000_vsm_authorization_layer.sql` hat bewusst *keinen* Eintrag in
der Datenbank: Sie schreibt einen Ist-Zustand fest, der schon vorher da war.
Ein `db push` wendet sie an — idempotent, und danach ist sie verzeichnet.

## Was noch fehlt

**Der Tabellen-Baseline.** `CREATE TABLE` fuer die zehn Tabellen oben steht noch
nirgends. Solange das fehlt, laesst sich aus diesem Repository keine Datenbank
von Null aufbauen — die Autorisierungsmigration setzt die Tabellen voraus.

Der Weg dahin, bewusst nicht blind ausgefuehrt:

```bash
npx supabase link --project-ref xoqrouqzjirglnsubgzs
npx supabase db pull --schema public
```

`db pull` zieht das **ganze** Schema, also auch die Prisma-Tabellen. Die
gezogene Datei muss anschliessend auf die zehn Tabellen aus der Liste oben
zusammengestrichen werden, sonst beanspruchen beide Systeme dieselben Objekte —
und das waere schlimmer als der heutige Zustand.

Danach gegen eine frische Datenbank pruefen (`npx supabase db reset`), nicht nur
gegen die Produktion. Ein Baseline, der nie auf einer leeren Datenbank lief, ist
eine Vermutung.

**Kleinere offene Punkte:**

- `benchmark_reference` hat keinen Unique-Index auf
  `(industry, company_size, metric_name)`. Deshalb muss `seed.sql` mit
  DELETE + INSERT arbeiten statt mit einem sauberen Upsert.
- `projects` hat keine Spalte fuer die Arbeitstage pro Jahr; die 250 stehen als
  Konstante in `src/lib/vsm/calculations.ts`, waehrend die verfuegbaren Minuten
  pro Tag am Projekt haengen. Beide stecken in derselben Formel (Audit-Befund
  S5) — die Spalte waere die naechste echte Schemaaenderung hier.
