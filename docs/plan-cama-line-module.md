# Plan — CAMA als eigenständiges Linien-Modul (Nachtrag/Umbau)

**Erstellt:** 2026-09-17, auf Nutzerwunsch nach Durchsicht des Schneider-Electric-CAMA-Playbooks
(`SPL_GEN_Capacity Management(CAMA)_000767AA`). Ersetzt die Kernentscheidung "Eine CAMA-Linie = ein
VSM-Prozess" aus `docs/plan-cama-capacity-analysis.md` (Abschnitt "Kernentscheidung: Was ist eine
'Linie'?"), **bevor** diese Migration je auf einer echten Datenbank außerhalb des Testsystems
gelaufen ist — siehe dort, Abschnitt "Testsystem, nicht Prod". Kein Altbestand zu migrieren, das ist
der Grund, warum dieser Umbau jetzt und nicht später sauber möglich ist.

**Stand:** Plan, noch nicht umgesetzt. Umsetzung nach Schritten unten, je nach Freigabe.

---

## Warum der Umbau

Der Nutzer will drei Dinge, die das bisherige Modell nicht kann:

1. **Linien anlegen, bevor/ohne dass ein VSM existiert.** "Firmenprofil → meine Linien anlegen
   (Sägen, Drehen, …)" als eigener erster Schritt, unabhängig von einem VSM-Projekt.
2. **VSM und Kapazitätsmanagement als getrennte, aber verlinkte Module.** Linie A hat ein VSM *und*
   Kapazitätsdaten; Linie B hat nur Kapazitätsdaten, kein VSM. Heute unmöglich: `shift_model`/
   `monthly_demand` hängen an `processes`, also existiert CAMA nur dort, wo schon eine Prozessbox
   in einem VSM existiert.
3. **Raum für ein drittes Modul später**, das ebenfalls auf "Linien" referenziert, ohne CAMA- oder
   VSM-Tabellen anfassen zu müssen.

Das bestätigt sich sogar aus dem Playbook selbst: Dort ist CAMA ein eigenständiges Modul mit eigenem
Scope (Upstream/Midstream/Downstream), VSM taucht darin gar nicht auf — die enge Kopplung an
`processes` war eine Entscheidung dieses Repos für v1, keine methodische Vorgabe von CAMA.

**Nutzerentscheidung 2026-09-17:** Kapazität ist eine Eigenschaft der **Linie**, nicht des
**Szenarios**. Ein Future-State-Szenario kann eine andere VSM-Prozesskette zeichnen, aber die reale
Linie dahinter (Taktrate der Maschine, Schichtmodell, Marktnachfrage) ist unabhängig davon eine
einzige Wahrheit. Damit entfällt auch die bisherige Notwendigkeit, CAMA-Felder bei
`createScenario` zu kopieren (Schritt 7 des alten Plans) — es gibt nichts mehr, das pro Szenario
dupliziert werden müsste.

---

## Neues Datenmodell

Drei separate Tabellen statt zwei Spalten auf `processes` — bewusst nach demselben Muster wie
`vsm_billing_customers` neben `organization_entitlements` (siehe dessen Migrationskommentar): eine
schmale Bruecken-/Fachtabelle pro Modul, keine gemeinsame breite Tabelle, die bei jedem neuen Modul
wieder wächst.

```sql
-- Modul 0: die Linie selbst — organisationsweiter Stammsatz, kennt weder VSM noch CAMA.
-- Jedes künftige Modul (Downstream/DC, Upstream/Lieferant, ...) referenziert nur line_id,
-- fasst diese Tabelle sonst nie an.
CREATE TABLE public.production_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- RLS: Mitglieder der Organisation lesen, Editoren+ schreiben — has_org_role(organization_id, ...),
-- exakt dieselbe Kette wie vsm_org_settings.

-- Modul CAMA: Kapazitätsdaten zu einer Linie. 1:1 zu production_lines, eigene Tabelle statt
-- weiterer Spalten auf production_lines — Downstream-/Upstream-Module bekommen später ihre je
-- eigene *_capacity-analoge Tabelle, ohne production_lines je zu ändern.
--
-- **Korrektur 2026-09-17, während der Umsetzung gefunden:** Der erste Entwurf unten vergaß
-- Taktrate/Bedienerzahl/NEE — die lagen bisher implizit auf `processes` und sollten dort bleiben.
-- Das widerspricht aber direkt dem Kern-Use-Case "Linie B hat nur Kapazitätsdaten, kein VSM": ohne
-- VSM-Prozess gibt es dann keine Quelle für die Taktrate. Line_capacity trägt deshalb eine eigene
-- Kopie von `cycle_time_minutes`/`operator_count`/`oee` — beim Anlegen einer Linie aus einer
-- Prozessbox heraus einmalig vorbelegt, danach unabhängig editierbar (siehe Migrationskommentar).
CREATE TABLE public.line_capacity (
  line_id                 uuid primary key references public.production_lines(id) on delete cascade,
  cycle_time_minutes      numeric, -- Minuten/Stück dieser Linie, eigene Kopie
  operator_count          integer not null default 1,
  oee                     numeric not null default 78,
  shift_model             smallint check (shift_model in (1,2,3)),
  monthly_demand          jsonb,   -- [Jan..Dez], Basisprognose — wie bisher auf processes
  monthly_demand_stretch  jsonb,   -- [Jan..Dez], Stress-/Upside-Szenario (siehe Abschnitt unten)
  updated_at              timestamptz not null default now()
);
-- RLS: erbt über line_id -> production_lines -> organization_id dieselbe has_org_role-Kette.

-- VSM-Modul: optionale Verlinkung einer Prozessbox auf eine bestehende Linie.
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.production_lines(id) ON DELETE SET NULL;
-- SET NULL statt CASCADE: Löscht man eine Linie, bleibt die VSM-Prozessbox bestehen, verliert nur
-- die Verknüpfung — ein VSM ist eigenständig gültig, auch ohne Kapazitätsbezug.

-- capacity_actions zeigt jetzt auf die Linie, nicht mehr auf einen VSM-Prozess.
ALTER TABLE public.capacity_actions
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.production_lines(id) ON DELETE CASCADE;
-- process_id bleibt vorerst bestehen (nullable machen), still deprecated — siehe Schritt 6.
```

**Was mit den alten `processes.shift_model`/`processes.monthly_demand` passiert:** Da die
ursprüngliche Migration (`20260914150000_vsm_cama_capacity_analysis.sql`) noch **nirgends außerhalb
des Testsystems** gelaufen ist, wird sie **direkt überschrieben**, nicht durch eine zweite
Migration ergänzt/zurückgerollt. Eine Migration, die Code beschreibt, der nie live war, braucht
keine Reparaturmigration — das widerspräche der eigenen Konvention "Migration beschreibt den
Ist-Zustand" (siehe `20260910170821_vsm_value_stream_header.sql` als Gegenbeispiel: *dort* war eine
Nachbesserung nötig, weil es schon Ist-Zustand auf Prod war). Konkret: `shift_model`/
`monthly_demand` fliegen aus der Migrationsdatei, die drei Tabellen oben treten an ihre Stelle,
Dateiname/Zeitstempel bleiben unverändert (Git-Historie zeigt die Überarbeitung, kein Grund für
einen neuen Dateinamen).

---

## Was sich in der Berechnungslogik NICHT ändert

`src/lib/vsm/capacityAnalysis.ts` bleibt unangetastet — `calcMonthlyCapacity`, `calcLoadRate`,
`getCamaColor`, `calcCamaLine` kennen ohnehin nur Zahlen, keine Tabellen. Nur der Adapter
`src/components/VSMEditor/camaLine.ts` (`computeCamaLine`) ändert seine Signatur: liest künftig aus
einer `production_lines`+`line_capacity`-Zeile statt aus `Tables<'processes'>`. Das ist der einzige
Punkt im Code, der die alte Kopplung kennt — genau der Grund, warum dieser Adapter beim ersten Bau
(Schritt 6 des alten Plans) bewusst als eigene, kleine Datei angelegt wurde statt die Umrechnung an
zwei Stellen zu duplizieren.

---

## Stresslinie (+20 %, aus dem Playbook-Diagramm)

Das Playbook zeigt zwei Kurven im selben Chart: Load Ratio mit Basisprognose und Load Ratio mit
Basisprognose **+20 % Nachfrage**. Zweck laut Diagrammbeschriftung: sichtbar machen, ob eine Linie
auch bei einem plausiblen Nachfrage-Peak noch tragfähig bleibt, nicht nur beim Punktwert.

**Umsetzung:** `line_capacity.monthly_demand_stretch` als eigenes 12er-Array, **nicht** automatisch
`monthly_demand × 1.2` — eine Firma könnte auch +10 % oder +30 % als ihren Stresstest wollen, das
pauschal auf +20 % zu verdrahten würde die Schneider-spezifische Zahl fälschlich zur allgemeinen
Regel machen. Stattdessen: Eingabefeld pro Monat wie bei `monthly_demand`, mit einem Kurzweg-Knopf
"alle Monate ×1.2 vorbelegen" (editierbar danach, keine feste Kopplung). `calcCamaLine` wird ein
zweites Mal mit dem Stretch-Array aufgerufen — keine neue Funktion nötig, nur ein zweiter Aufruf der
bestehenden reinen Funktion.

**UI:** Kapazitätsseite zeigt pro Monat zwei Ampeln/Zahlen nebeneinander (Basis / Stress) statt einer
zweiten Chart-Linie (Balkendiagramm-Konvention dieses Projekts, siehe Lean-Durchsicht im alten Plan:
"Tabelle mit Zahlen *und* Ampel je Zeile", kein Liniendiagramm-Neubau). Stretch-Werte optional (null
= "kein Stresstest hinterlegt"), zeigt dann nur die Basisampel wie bisher.

---

## UI-Änderungen

1. **Linienverwaltung wird organisationsweit**, nicht mehr projektgebunden: neue Seite
   `/[locale]/capacity` (Muster: `/settings`, org-weiter Server Component, `has_org_role`-Check wie
   dort) — Liste aller `production_lines` der Organisation, Linie anlegen/umbenennen/löschen,
   Kapazitätsdaten (Schichtmodell, 12+12 Monatsfelder Basis/Stress) direkt dort pflegen. Ersetzt
   `/editor/[projectId]/capacity` als primären Einstieg — diese Route bleibt als projektgebundene
   *Ansicht* bestehen (Linien, die im aktiven VSM verlinkt sind), leitet aber Bearbeitung an die
   neue org-weite Seite weiter statt sie zu duplizieren.
2. **`ProcessEditPanel`** (`VSMCanvas.tsx`): Die bisherigen CAMA-Eingabefelder (Schichtmodell, 12
   Monatswerte) verschwinden aus dem Prozess-Formular. Stattdessen ein Auswahlfeld "Verknüpfte
   Linie" (Dropdown aus `production_lines` der Organisation, inkl. "Neue Linie anlegen"-Kurzweg).
   Ist eine Linie verknüpft: read-only Ampel-Zusammenfassung + Link "→ Kapazitätsdaten bearbeiten"
   (führt zur neuen org-weiten Seite). Ist keine verknüpft: kein CAMA-Abschnitt sichtbar — genau das
   vom Nutzer gewünschte Verhalten für Linien ohne VSM-Bezug, umgekehrt gelesen.
3. **Canvas-Badge** (`ProcessBox`): unverändert im Zeichenverhalten, liest nur über
   `computeCamaLine` jetzt von der verlinkten Linie statt vom Prozess selbst. Kein Badge, wenn
   `line_id` null ist (heute schon so: kein Badge ohne Schichtmodell).
4. **`capacity_actions`**: Aktionsplan-Formular wird linien- statt prozessgebunden — auf der neuen
   org-weiten Seite eine Aktionsliste je Linie. Bestehendes `target_month`/`due_date`/`status`-Modell
   unverändert.

---

## Was dadurch einfacher wird

- **`scenario-actions.ts`**: Die CAMA-Kopierlogik aus Schritt 7 des alten Plans entfällt komplett —
  `processes` trägt nur noch `line_id` (ein Verweis, kein Datenfeld), der bleibt beim Kopieren
  eines Prozesses ohnehin erhalten, wenn er in der Spaltenliste steht. Weniger Code, nicht mehr.
- **`demoTransfer.ts`**: `TransferProcess.shiftModel`/`monthlyDemand` entfallen (waren dort erst
  frisch ergänzt, siehe Schritt 4 des alten Plans) — die öffentliche Demo bekommt stattdessen (falls
  gewünscht) eine eigene Demo-Linie im Übertragsformat. Kleinerer Umbau, nicht Teil von Schritt 1–6
  unten, siehe Schritt 7.

## Was dadurch schwieriger wird — offen zu klären

- **Löschen einer Linie mit VSM-Verknüpfung:** `ON DELETE SET NULL` heißt, eine Prozessbox verliert
  stillschweigend ihre CAMA-Anzeige, wenn jemand auf der Kapazitätsseite die Linie löscht. UI muss
  das beim Löschen warnen ("Diese Linie ist mit N Prozessboxen verknüpft — Verknüpfung wird
  entfernt, VSM bleibt bestehen"), sonst wirkt das Verschwinden des Badges wie ein Bug.

---

## Umsetzungsreihenfolge — Stand: alle Schritte fertig ✅ (2026-09-17)

1. ✅ **Migration überarbeitet** — `20260914150000_vsm_cama_capacity_analysis.sql` umgeschrieben:
   `production_lines`, `line_capacity`, `processes.line_id`, `capacity_actions.line_id`. Zweifach
   gegen die Wegwerf-Postgres geprüft (idempotent), im Testsystem angewendet, vorhandene Testzeile
   ("Drehen") ins neue Modell übertragen statt verworfen. **Nachbesserung noch im selben Schritt:**
   `line_capacity` bekam zusätzlich eine eigene Kopie von `cycle_time_minutes`/`operator_count`/`oee`
   — ohne die hätte eine Linie ohne verknüpftes VSM gar keine Taktrate gehabt, siehe
   Korrektur-Abschnitt oben.
2. ✅ **`camaLine.ts`-Adapter umgestellt** — `computeCamaLine` liest jetzt ausschließlich von
   `line_capacity` (kein Prozess-Parameter mehr nötig, da Taktrate/NEE dort mit hinzugekommen sind).
   `computeCamaStretchLine` als zweite, kleine Funktion für die Stresslinie ergänzt (liest
   `monthly_demand_stretch` statt `monthly_demand`, sonst identisch).
3. ✅ **Org-weite Kapazitätsseite** `/capacity` — Linien anlegen/umbenennen/löschen (mit Warnung bei
   VSM-Verknüpfungen), Taktrate/Bedienerzahl/NEE/Schichtmodell, 12 Monatswerte Basis + optionale
   Stresslinie (Kurzweg "× 1,2"), Aktionspläne. Lesend für alle Mitglieder, schreibend ab
   Editor-Rolle. Von der Dashboard-Kopfzeile aus verlinkt.
4. ✅ **`ProcessEditPanel` umgestellt** — CAMA-Eingabe raus, Dropdown "Verknüpfte Linie" rein
   (inkl. Kurzweg zu `/capacity`, ausgeblendet in der Demo ohne Organisation). Verknüpft zeigt das
   Panel die aktuelle Ampel read-only plus Link zur Bearbeitung.
5. ✅ **Canvas-Badge umgestellt** — kam beim Verdrahten von Schritt 4 praktisch gratis mit (eine
   Zeile: liest jetzt über `process.line_id` statt direkt vom Prozess), kein eigener Schritt mehr
   nötig.
6. ✅ **`/editor/[projectId]/capacity` zur Ansicht umgebaut** — zeigt nur noch die im aktiven Zustand
   verknüpften Linien (Ampel, Peak-Monat), Bearbeitung verlinkt auf `/capacity`. Die alte
   `actions.ts` dieser Route (Aktionsplan-CRUD, project_id/process_id-basiert) ist überflüssig und
   gelöscht — dieselben Handlungen gibt es linienbasiert bereits unter `app/[locale]/capacity/actions.ts`.
7. ✅ **`demoTransfer.ts`/`scenario-actions.ts` aufgeräumt** — `scenario-actions.ts` kopiert beim
   Anlegen eines neuen Szenarios jetzt nur noch `line_id` (ein Verweis, keine Daten mehr zum
   Duplizieren). `demoTransfer.ts`: `shiftModel`/`monthlyDemand` komplett aus dem Wire-Format
   entfernt (eine anonyme Demo hat nie eine Organisation, kann also nie eine Linie verknüpfen — es
   gab schlicht nichts mehr zu übertragen), `DEMO_TRANSFER_VERSION` auf 3 erhöht. Vier obsolete Tests
   entfernt, ein neuer ergänzt (übertragene Demo-Prozessbox kommt immer unverknüpft an).
8. ✅ **i18n** — neue Texte für Linienverwaltung, Verknüpfungs-Dropdown, Lösch-Warnung,
   Stresswert-Felder in `Capacity`/`Editor`/`Errors`/`Dashboard`, de/en durchgehend synchron
   gehalten; orphane Alt-Keys (Schichtmodell-Radio-Texte, alte Projektansicht-Detailseite) entfernt.

**Verifikation am Ende:** `tsc --noEmit` sauber (nur ein vorbestehender, unabhängiger `LayoutProps`-
Fehler in `layout.tsx`), volle Testsuite 475/475 grün, `eslint` sauber, vollständiger
`next build` erfolgreich — `/capacity` erscheint korrekt in der Routentabelle.
