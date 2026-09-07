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
| `vsm_staff`, `vsm_leads`, `vsm_lead_events` | VSM Builder | dito |
| `vsm_org_settings`, `vsm_invite_settings` | VSM Builder | dito |
| `project_org_id()`, `set_updated_at()`, `is_vsm_staff()`, `is_vsm_admin()` + die Policies auf obigen Tabellen | VSM Builder | dito |
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

## Was der VSM Builder von fremden Tabellen liest

Regel 1 verbietet, ein fremdes **Objekt** anzufassen — also Spalten, Policies,
Trigger. Sie verbietet nicht, fremde **Zeilen** zu lesen und zu schreiben; das
tut die Anwendung laengst, etwa mit `organization_invitations`. Zwei Faelle sind
seit dem 04.09. dazugekommen und sollen hier stehen, damit sie bei der
naechsten Prisma-Migration jemandem auffallen:

- **`organization_entitlements`** traegt je Organisation und Produkt
  (`AppProduct`) eine Stufe aus `Tier`. Das ist das Freemium-Rueckgrat aller
  drei Produkte, und der VSM Builder leitet seine Grenzen daraus ab
  (`src/lib/billing/entitlement.ts`). Eine eigene Tarif-Tabelle daneben waere
  eine zweite Wahrheit ueber denselben Kunden gewesen. Gelesen wird mit
  `product = 'VSM_BUILDER'` und `status = 'ACTIVE'`; ohne Zeile gilt FREE.
  Geschrieben wird nur ueber den Verwaltungsbereich (`/admin/organizations`,
  Rolle `admin`), und zwar mit Service-Role — welche Policies dort haengen,
  entscheidet das andere Repository.
- **`organization_invitations`** traegt die Einladungen; der VSM Builder legt
  dort Zeilen an und zieht sie zurueck. Seit dem 05.09. haengt an jeder
  Einladung optional eine Zeile in `vsm_invite_settings` — Empfaenger,
  Begruessung, ob das Logo mitgeht.
  Verknuepft ist sie ueber den **sha256-Hash des Einladungstokens**, nicht
  ueber `organization_invitations.id`, und zwar aus zwei Gruenden: Ein
  Fremdschluessel auf eine fremde Tabelle waere eine weitere Abhaengigkeit,
  und die Einladungsseite muss die Angaben zeigen, *bevor* der Empfaenger
  angemeldet ist — mit dem Hash als Schluessel genuegt dafuer eine Abfrage in
  einer Tabelle, die uns gehoert. Den Hash schreibt `createInvite`
  (`src/app/[locale]/team/actions.ts`) in beide Tabellen.
- **`auth.users`** wird ueber die Admin-API gelesen, nicht ueber PostgREST.
  Eine gespiegelte `profiles`-Tabelle braeuchte einen Trigger auf `auth.users`,
  wo schon `handle_new_user()` von Prisma haengt — ein zweiter Trigger auf einer
  fremden Tabelle ist genau die Konstellation vom 16.08.

Wer auf der Prisma-Seite `Tier` oder `AppProduct` erweitert: Der VSM Builder
faellt bei unbekannten Stufen auf FREE zurueck (`limitsFor()` in
`src/lib/billing/plans.ts`, dort getestet), sperrt sich also nicht aus. Er
zeigt die neue Stufe aber auch nicht an, bis sie dort eingetragen ist.

## Den ersten Betreiber eintragen

`vsm_staff` entscheidet, wer den Verwaltungsbereich unter `/admin` sieht — die
Betreiberseite, unabhaengig von `organization_members`. Die Tabelle hat
bewusst **kein** INSERT-Recht ueber PostgREST: Eine Oberflaeche, die ihre
eigenen Zugangsrechte vergeben kann, ist keine Absicherung. Der erste Eintrag
kommt deshalb von aussen, mit der Nutzer-Id aus dem Supabase-Dashboard
(Authentication → Users):

```sql
insert into public.vsm_staff (user_id, role, note)
values ('00000000-0000-0000-0000-000000000000', 'admin', 'Erstzugang')
on conflict (user_id) do update set role = excluded.role;
```

`admin` darf zusaetzlich Tarife vergeben, `sales` nur Interessenten pflegen.
Wer nicht in der Tabelle steht, bekommt unter `/admin` ein 404 — kein „Kein
Zugriff", denn das waere die Bestaetigung, nach der jemand sucht, der die
Adresse geraten hat.

## Stand dieses Verzeichnisses

Angelegt am 30.08.2026 — vorher hatte der VSM Builder **gar keine** Migrationen,
das komplette Schema existierte nur in der Produktivdatenbank.

Enthalten:

- `migrations/20260830155000_vsm_tables_baseline.sql` — `CREATE TABLE` fuer
  die zehn eigenen Tabellen samt Constraints, Indizes und Kommentaren. Steht
  vor der Autorisierungsschicht, weil die die Tabellen voraussetzt. Siehe
  "Von Null aufbauen" unten.
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
- `migrations/20260904175944_vsm_crm_and_staff.sql` — die Vertriebsschicht:
  `vsm_staff` (wer den Verwaltungsbereich sieht), `vsm_leads` (Interessenten
  mit ihrer Herkunft und ihrer Einwilligung) und `vsm_lead_events` (die
  anfuegende Chronik), dazu `is_vsm_staff()`/`is_vsm_admin()` und die Policies.
  Legt bewusst **keine** eigene Tarif-Tabelle an — siehe „Was der VSM Builder
  von fremden Tabellen liest".
- `migrations/20260905170000_vsm_org_branding_and_invite_settings.sql` — das
  Firmenprofil: `vsm_org_settings` (Logo, Firmenangaben, Vorgaben fuer neue
  Wertstroeme) und `vsm_invite_settings` (was an einer Einladung haengt).
  Beide liegen **neben** `organizations` bzw. `organization_invitations` und
  nicht darin — die gehoeren Prisma. Das Logo steht als base64 in der Zeile
  und nicht im Storage: Ein Bucket braeuchte Policies auf `storage.objects`,
  einer Tabelle, die Supabase gehoert, und waere ein Einrichtungsschritt, den
  niemand sieht, bis das erste Logo nicht hochlaedt. Bei einem Logo je Firma
  und 200 kB Obergrenze ist das die billigere Rechnung; bei Bildern im
  Wertstrom waere sie es nicht.
- `seed.sql` — die Referenzwerte des Branchenvergleichs.
- `tests/` — die nachgebildeten fremden Objekte und das Pruefskript. Keine
  Migrationen; siehe "Pruefen" unten.

`20260901174003` und `20260903212855` hiessen bis zum 04.09. `20260901120000` und
`20260903180000` — Zeitstempel, die beim Schreiben der Datei entstanden und
nicht die, unter denen die Datenbank sie verzeichnet hat. `db push` haette
beide ein zweites Mal angewandt (folgenlos, weil idempotent, aber mit einem
zweiten Eintrag fuer dieselbe Aenderung). Daher jetzt Regel 5.

`20260830160000_vsm_authorization_layer.sql` hat bewusst *keinen* Eintrag in
der Datenbank: Sie schreibt einen Ist-Zustand fest, der schon vorher da war.
Ein `db push` wendet sie an — idempotent, und danach ist sie verzeichnet.

## Von Null aufbauen

Seit dem 04.09.2026 geht das. Vorher stand hier "Was noch fehlt: der
Tabellen-Baseline" — `CREATE TABLE` fuer die zehn Tabellen existierte
nirgends.

`migrations/20260830155000_vsm_tables_baseline.sql` schliesst die Luecke. Er
ist nicht aus `supabase db pull` entstanden: Der zieht das *ganze*
public-Schema, also auch die Prisma-Tabellen, und die haette man anschliessend
von Hand wieder herausschneiden muessen — beide Systeme wuerden sonst dieselben
Objekte beanspruchen. Stattdessen gezielt aus dem Katalog der
Produktivdatenbank abgefragt: Spalten, Vorgaben, Constraints, Indizes,
Kommentare.

Die Reihenfolge auf einer frischen Datenbank:

1. `prisma migrate deploy` aus `D:\LeanPulse Industrial\apps\api` — legt
   `organizations`, `auth`-Anbindung und `has_org_role()` an.
2. Die Migrationen hier, in Dateinamensreihenfolge.
3. `seed.sql`.

Schritt 1 ist keine Empfehlung, sondern Voraussetzung: Der Baseline prueft am
Anfang, ob `public.organizations` und `auth.users` existieren, und bricht sonst
mit einer Meldung ab, die sagt, was zu tun ist. `projects.organization_id` und
die beiden Spalten von `activity_logs` zeigen dorthin — fremde Tabellen
mit anzulegen waere eine Eigentumsverletzung, die Fremdschluessel wegzulassen
eine Luege ueber das Schema.

## Pruefen

```bash
./supabase/tests/leere-datenbank-pruefen.sh "postgresql://postgres@/wegwerf?host=/pfad/zum/socket&port=5432"
```

Das Skript legt die Datenbank neu an, faehrt `tests/fremde_voraussetzungen.sql`
(nachgebildete Prisma- und Supabase-Objekte, **keine** Migration), dann alle
Migrationen, dann den Seed, und zaehlt am Ende nach. Es braucht weder Docker
noch die Supabase-CLI, nur ein `psql`. Auf eine Supabase-URL zu zeigen lehnt es
ab.

Stand 05.09.2026, gegen Postgres 16.13: 10 Tabellen des Baselines, 3
Vertriebstabellen, 2 Profiltabellen, 28 Policies, 6 Referenzwerte. Spalten (alle 113), Typen, NOT-NULL-Flags, Vorgabewerte,
Fremdschluessel, Indizes sowie RLS und Policy-Zahl je Tabelle stimmen mit der
Produktion ueberein.

Eine Abweichung bleibt und ist keine: Vier CHECK-Constraints legt Postgres 16
in einer anderen Schreibweise ab als 17 — `(ARRAY[…]::varchar[])::text[]` wird
dort in Element-Casts umgeschrieben. Supabase faehrt 17, produktiv steht die
unveraenderte Form. Geprueft wird in beiden Faellen dasselbe. Wer den Baseline
gegen eine 16er-Instanz haelt, sollte das nicht "korrigieren".
