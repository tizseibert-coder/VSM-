# Plan — CAMA (Kapazitätsanalyse / Load-Rate-Ampel)

**Erstellt:** 2026-09-14. Reine Planungssession auf Nutzerwunsch ("nur als Plan") — **nichts hiervon ist implementiert.** Grundlage ist die vom Nutzer eingefügte CAMA-Beschreibung (Formeln, Ampellogik, Scope-Tabelle). Dieses Dokument bildet sie auf das bestehende Schema und die bestehenden Editor-Muster ab, bevor eine Migration geschrieben wird.

---

## Testsystem, nicht Prod (Nutzeranforderung 2026-09-14)

Geklärt: Taktane, Prisma/LeanPulse und die Landing-Page teilen sich **ein einziges** Supabase-Projekt/Postgres (`supabase/README.md`) — es gibt kein separates Test-Supabase-Projekt. Die Trennung Test/Prod läuft also über **Branch und Deployment**, nicht über die Datenbank. Daraus folgt für die Umsetzung:

- **Code:** ausschließlich auf `claude/planning-session-s247kr` (dieser Branch), wie schon jetzt. Kein Merge nach `master` und kein Deploy auf die Produktionsdomain durch mich — das bleibt eine bewusste, separate Entscheidung, die der Nutzer trifft, nicht ein Nebeneffekt dieser Umsetzung.
- **Migration:** Da es nur die eine, geteilte Datenbank gibt, landet eine spätere Migration zwangsläufig in derselben Datenbank, die auch Prod bedient — genau wie jede bisherige Migration in diesem Repo. Das ist ungefährlich, **solange sie derselben additiven Konvention folgt wie alle bestehenden Migrationen hier** (neue Spalten `nullable`/mit Vorgabewert, keine `NOT NULL` ohne Default, keine Umbenennung/kein Entfernen bestehender Spalten): Prod-Code, der diese neuen Spalten/Tabellen nicht kennt, ist davon unberührt — genau das Muster, das `piece_value`, `currency`, `has_heijunka` etc. schon vorleben. Der Plan oben hält sich bereits daran.
- **Ausführung der Migration:** Diese Session hat aktuell **keine** Datenbankverbindung (keine `SUPABASE_SERVICE_ROLE_KEY`/Projekt-Referenz gesetzt) — ich kann also ohnehin nichts anwenden, ohne dass mir ein Zugang gegeben wird. Wenn es so weit ist, wende ich die Migration nur nach ausdrücklicher Freigabe an (welches Projekt/welche Verbindung), nicht automatisch als Teil eines Commits.
- **Sichtbarkeit für echte Nutzer:** Neue Seiten/Panels (Kapazitätsseite, Eingabemaske, Canvas-Badge) sind nur über Code erreichbar, der auf diesem Branch/seiner Preview-Umgebung läuft — auf der Produktionsdomain (Deploy von `master`) taucht nichts davon auf, solange nicht gemerged wird.

---

## Was CAMA methodisch ist

Eine Kapazitätsampel pro Linie und Monat:

```
Tageskapazität   = Stunden/Tag × Taktrate × NEE
Monatskapazität  = Tageskapazität × Arbeitstage/Monat
Load Rate        = Nachfrage/Monat ÷ Monatskapazität
```

Ampel (Load Rate) — **Grenzwerte vom Nutzer bestätigt (2026-09-14): der Schwellwert selbst gehört noch zur günstigeren Farbe**, also `1.00` ist die letzte grüne Stufe, `1.20` die letzte orange:

| Bereich | Farbe | Bedeutung |
|---|---|---|
| `< 0.50` | 🔵 Blau | unterausgelastet |
| `0.50 ≤ x ≤ 1.00` | 🟢 Grün | ok |
| `1.00 < x ≤ 1.20` | 🟠 Orange | Achtung |
| `x > 1.20` | 🔴 Rot | überlastet |

Gerechnet für alle 12 Monate; der **schlechteste Monat** bestimmt die Ampelfarbe der Linie.

**Methodischer Vorbehalt aus der Lean-Durchsicht (2026-09-14): Rüstzeit.** `processes.changeover_time` existiert im Schema bereits (erfasst, in der PDF-Kopfzeile gezeigt), fließt aber **in keiner** bestehenden VSM-Rechnung ein (Takt, Kapazitätsprüfung, CAMA) — kein CAMA-spezifisches Defizit, sondern eine bestehende Lücke des ganzen Werkzeugs. CAMA übernimmt hier bewusst dieselbe Vereinfachung wie `capacityCycleTime` in `calculations.ts`: NEE gilt als ein bereits verdichteter Verfügbarkeits-/Leistungs-/Qualitätsfaktor. Ist Rüstzeit in der gemessenen NEE schon enthalten, ist das korrekt; misst die NEE nur ungeplante Störungen, unterschätzt CAMA bei rüstintensiven Linien (viele Produktwechsel/Monat) die reale Auslastung. Eine sauberere Lösung bräuchte eine eigene Rüstzeit-Eingabe je Monat (Anzahl Rüstungen × Rüstzeit) — das sprengt die 5-Eingangsgrößen-Vorlage bewusst und ist **nicht** Teil dieses Plans, gehört aber als bekannte Grenze in die spätere Nutzerdokumentation der Kapazitätsseite.

---

## Kernentscheidung: Was ist eine "Linie"?

Die Nutzer-Vorlage nennt als Kern-Use-Case ausdrücklich die VSM-Integration ("die Ampel sitzt direkt im VSM-Fluss") statt eines separaten Tools. Ich plane entlang dieser Option:

**Eine CAMA-Linie = ein VSM-Prozess (`processes`-Zeile).**

Begründung: Ein Prozess trägt bereits drei der fünf CAMA-Eingangsgrößen exakt in der gebrauchten Bedeutung:

| CAMA-Eingangsgröße | Quelle |
|---|---|
| Taktrate (Stk/h) | **neu abgeleitet:** `60 / cycle_time` (cycle_time ist bereits Minuten/Stück, siehe `calculations.ts`) |
| NEE/KER (0–1) | `processes.oee` (bereits 0–100 %, gleiche Definition — Skalierung, keine neue Spalte) |
| Stunden/Tag | **neu:** aus Schichtmodell abgeleitet (siehe unten) |
| Arbeitstage/Monat | **neu:** projektweiter Kalender (siehe unten) |
| Monatliche Nachfrage ×12 | **neu:** pro Prozess |

Das ist zugleich der USP aus der Vorlage: Die Ampel kann als kleines Badge auf der bestehenden Prozessbox im Canvas erscheinen, ohne dass der Nutzer Daten doppelt pflegt.

**Verworfene Alternative:** eine von VSM losgelöste "Linie"-Entität (eigene Tabelle, eigenes Formular, kein Bezug zu `processes`). Das wäre näher am Excel-Original, verdoppelt aber Taktrate/NEE-Pflege und liefert nicht den in der Vorlage gewünschten USP. Für v1 verworfen, als spätere Option offen (z. B. für Nutzer, die CAMA ohne VSM-Diagramm nutzen wollen).

**`operator_count` in der Taktrate — vom Nutzer bestätigt (2026-09-14), mit Bedingung:** Zählt nur, wenn die parallelen Arbeitsplätze **wirklich identisch** sind (flexible Linie / gleichartige Arbeitsplatzgruppen) — dann `Taktrate = 60 / (cycle_time / operator_count)`, weil jeder Arbeitsplatz unabhängig ein volles Stück fertigt. Ist das nicht der Fall (unterschiedliche Arbeitsplätze, die zufällig an derselben Prozessbox liegen), zählt `operator_count` nicht in die Taktrate.

Das deckt sich exakt mit der bestehenden Definition von `operator_count` im Schema (`calculations.ts`: "each operator independently finishes a full unit") — es ist also **keine neue Regel**, sondern die Übernahme der bereits geltenden Konvention. Wichtig für die Eingabemaske: `operator_count` darf nur erhöht werden, wenn dieser Vorbedingung ("wirklich identisch") tatsächlich zutrifft — das ist heute schon so gemeint, aber nirgends im UI-Text erklärt. **Ergänzung fürs UI:** ein Hinweistext/Tooltip direkt am `operator_count`-Feld im `ProcessEditPanel`, der genau das sagt (heute steht dort nur eine nackte Zahl ohne Erklärung der Identitätsbedingung) — kleine, aber wichtige Nachschärfung, die aus dieser Planung folgt und unabhängig von CAMA Bestand hat.

---

## RF1/RF2/RF3-Forecastvergleich — Wiederverwendung statt Neubau

Die Vorlage nennt den Forecast-Vergleich (RF1/RF2/RF3) explizit als gewollt ("das war unser heutiges Thema"). Statt eines dritten Mechanismus schlage ich vor, den **bestehenden Szenario-Mechanismus** (`scenarios`, `createScenario`, `/compare`) zu nutzen:

- Eine "Forecast-Revision" ist technisch ein Szenario (Typ z. B. frei benennbar "RF1", "RF2", "RF3").
- `createScenario` kopiert bereits alle Prozesszeilen inkl. `cycle_time`/`oee` per expliziter Spaltenliste (`scenario-actions.ts:66-81`) — die neue `monthly_demand`-Spalte (s. u.) muss dort **einmalig ergänzt** werden, dann funktioniert "RF2 aus RF1 ableiten und Nachfrage anpassen" ohne weiteren Code.
- Die bestehende Vergleichsseite (`/editor/[projectId]/compare`) zeigt heute schon N Zustände nebeneinander — eine CAMA-Spalte (Peak-Ampel pro Linie und Szenario) ist dort eine Ergänzung, keine neue Seite.

Das spart eine ganze Datenstruktur gegenüber einem CAMA-eigenen Revisionskonzept.

---

## Neue Schema-Felder (eine Migration)

Bewusst minimal gehalten — jede neue Spalte nur, wenn sie keine bestehende ersetzen kann:

```sql
-- processes: Schichtmodell und Monatsnachfrage pro Linie/Szenario
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS shift_model smallint,              -- 1, 2 oder 3; null = nicht erfasst
  ADD COLUMN IF NOT EXISTS monthly_demand jsonb;               -- [Jan..Dez], null = nicht erfasst

-- vsm_org_settings: Arbeitstage/Monat, firmenweiter Jahreskalender (nutzerbestätigt 2026-09-14).
-- Nicht auf `projects`, sondern auf `vsm_org_settings` — dieselbe Tabelle, die schon
-- default_currency/default_available_minutes als firmenweite Vorgaben trägt (orgSettings.ts).
-- `organizations` selbst gehört Prisma/LeanPulse, nicht Taktane (siehe orgSettings.ts-Kommentar) —
-- genau deshalb existiert `vsm_org_settings` als Taktane-eigene 1:1-Nebentabelle.
ALTER TABLE public.vsm_org_settings
  ADD COLUMN IF NOT EXISTS capacity_workdays jsonb;             -- {"1":21,"2":20,...,"12":22}, null = Vorgabekalender

-- Aktionspläne zu roten/orangen Linien (Owner/Termin — laut Vorlage "wertvoll")
CREATE TABLE public.capacity_actions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  description text not null,
  owner text,
  due_date date,             -- Fälligkeit der Umsetzung
  target_month smallint,     -- welcher CAMA-Monat (1-12) adressiert wird, optional
  status text not null default 'open',   -- 'open' | 'done', UI-Enum wie is_pacemaker/buffer_type
  created_at timestamptz not null default now()
);
-- RLS: gleiche Autorisierungskette wie inventory_buffers (über processes -> project -> org),
-- siehe 20260830160000_vsm_authorization_layer.sql als Vorlage.
```

**Nachtrag aus der Lean-Durchsicht (2026-09-14): `target_month`.** Eine Kapazitätsmaßnahme ist in der Praxis oft an einen Zeitpunkt gebunden ("ab Monat 7 Zusatzschicht"), nicht nur an ein Fälligkeitsdatum für ihre Umsetzung. Beides ist unabhängig sinnvoll — eine SMED-Werkstatt muss bis 15. Juni abgeschlossen sein (`due_date`), damit sie im Juli (`target_month`) wirkt. Nullable, weil nicht jede Maßnahme monatsgebunden ist ("Rüstzeiten grundsätzlich senken" betrifft die ganze Linie). Bereits in der Migration nachgezogen (sie war zu diesem Zeitpunkt noch nirgends angewendet, siehe Abschnitt "Testsystem, nicht Prod").

`monthly_demand` als `jsonb`-Array statt zwölf eigener Spalten oder einer Kindtabelle: eine Zeile pro Prozess bleibt lesbar, keine zusätzliche RLS-Policy nötig (erbt die von `processes`), und der Zugriff ist immer "alle 12 Monate auf einmal" — genau das Zugriffsmuster von CAMA. Nachteil, bewusst in Kauf genommen: keine SQL-seitige Aggregation "welche Linie ist im Juli rot" über Projekte hinweg. Für v1 ausreichend (Vorlage: "Synthese mehrerer Standorte" ist explizit "später").

`capacity_workdays` als `jsonb` auf `vsm_org_settings`, nicht auf `projects`: **ein** Jahreskalender pro Firma, gilt für alle Projekte/Linien dieser Organisation — Nutzerentscheidung 2026-09-14. Praktische Folgen dieser Wahl:

- **Laden:** Die CAMA-Seite lädt den Kalender einmalig über `loadOrgProfile`/`orgSettings.ts` (wie heute schon `defaultAvailableMinutes`), nicht mehr pro Projekt — ein Join/Read weniger pro Linie, weil alle Linien einer Firma denselben Kalender teilen.
- **Pflege:** Der Kalender wird auf der Organisations-/Settings-Seite (`src/app/[locale]/settings/page.tsx`, `settings/actions.ts`) gepflegt, analog zu den anderen `vsm_org_settings`-Feldern — **nicht** im Editor. Das ist eine kleine, bewusste UI-Ergänzung dort (12 Zahlenfelder "Arbeitstage" oder ein Kurzformular, das den Vorgabekalender vorbelegt).
- **RLS:** `vsm_org_settings` hat schon eine Policy für "Mitglied der Organisation darf lesen/schreiben" (aus der Migration, die `default_currency` etc. eingeführt hat) — für `capacity_workdays` reicht dieselbe Policy, keine neue nötig.
- Fehlt der Wert (keine `vsm_org_settings`-Zeile oder `capacity_workdays` null — der Normalzustand jeder bestehenden Firma), greift ein Vorgabekalender (Konstante im Code, z. B. 21 Arbeitstage/Monat) statt eines stillen `0`.

---

## Berechnungslogik (reine Funktionen, TDD zuerst — Projektkonvention)

Neue Datei `src/lib/vsm/capacityAnalysis.ts` (nicht `capacity.ts` erweitern — das ist die bestehende Takt-vs-Zykluszeit-Engpassprüfung, ein anderes Konzept mit ähnlichem Namen; beide sollen nebeneinander bestehen, siehe eigener Abschnitt unten zur Abgrenzung):

```ts
export type ShiftModel = 1 | 2 | 3
export function shiftHoursPerDay(shift: ShiftModel): number // 8.2 / 16.4 / 24

export interface CamaLineInput {
  cycleTimeMinutes: number
  operatorCount?: number
  neeFraction: number        // oee/100, bereits skaliert vor dem Aufruf
  shiftModel: ShiftModel
}

export function calcMonthlyCapacity(input: CamaLineInput, workdays: number): number
export function calcLoadRate(demand: number, monthlyCapacity: number): number
export type CamaColor = 'blue' | 'green' | 'orange' | 'red'
export function getCamaColor(loadRate: number): CamaColor

export interface CamaMonthResult { month: number; demand: number; capacity: number; loadRate: number; color: CamaColor }
export interface CamaLineResult { months: CamaMonthResult[]; peakMonth: CamaMonthResult; color: CamaColor }
export function calcCamaLine(input: CamaLineInput, monthlyDemand: number[], workdaysByMonth: number[]): CamaLineResult
```

Tests zuerst (`capacityAnalysis.test.ts`), analog zum Stil von `capacity.test.ts`: Grenzwerte exakt auf 0.5/1.0/1.2, `oee = 0` als „keine Kapazität“ (Infinity-Fall wie in `calculations.ts:119`), `operatorCount` verdoppelt Kapazität, Rechenbeispiel aus der Vorlage (16.4 h × 50 × 0.68 × 21 ≈ 11.700, Load Rate 11.500/11.700 ≈ 0,98 → grün) als Regressionstest.

**Abgrenzung zu `capacity.ts`:** Die bestehende `checkCapacity` beantwortet "ist diese Station *gerade jetzt* der Engpass gegen die eine Kundentaktzeit des Projekts" (eine Zahl, Ist-Zustand). CAMA beantwortet "reicht die Kapazität dieser Linie über 12 Monate für die jeweilige Monatsnachfrage" (12 Zahlen, saisonal, pro Szenario). Beide dürfen unterschiedliche Ampeln für dieselbe Station zeigen — das ist kein Widerspruch, sondern zwei verschiedene Fragen. Das muss in der UI benannt werden, sonst wirkt es wie ein Bug (zwei rote Marker mit unterschiedlicher Bedeutung an derselben Box).

---

## UI

**1. Eingabe** — nicht im ohnehin dichten `ProcessEditPanel` (siehe Begründung der Future-State-Seite zur Informationsdichte), sondern ein eigener Button dort ("Kapazitätsdaten…") öffnet ein Panel mit: Schichtmodell (1/2/3, Radiogruppe), 12 Nachfragefelder (oder Quartalsraster mit „auf 12 Monate verteilen"-Kurzweg), Live-Vorschau der Ampel pro Monat während der Eingabe.

**2. Ampel auf der Prozessbox** — kleines farbiges Badge (Kreis, obere Ecke), gespeist aus `peakMonth.color`. Optisch getrennt vom bestehenden roten Engpass-Rahmen aus `capacity.ts`/`isBottleneck`, mit eigenem Tooltip ("Kapazitätsampel: schlechtester Monat Juli, Load Rate 1.34").

**3. Neue Seite `/editor/[projectId]/capacity`** (Muster: `/compare`) — Tabelle aller Linien (Prozesse) des aktiven Zustands/Szenarios, sortiert nach Load Rate absteigend (rot oben), Spalten: Linie, Peak-Monat, Load Rate, Ampel, Handlungsempfehlung. Klick auf eine Zeile → Detailansicht mit 12-Monats-Verlauf (Balken, farbig nach Ampel je Monat — Wiederverwendung des Zeichenmusters aus `BalanceChartPanel.tsx`) und der Aktionsplan-Liste (`capacity_actions`) dieser Linie mit Owner/Termin/`target_month`/Status.

**Handlungsempfehlungen je Farbe (Lean-Durchsicht 2026-09-14, ersetzt den Platzhalter "Textbaustein je Farbe"):** Text lebt in `messages/de.json`/`en.json` unter `Capacity.recommendation.<farbe>`, **nicht** in `capacityAnalysis.ts` — die reine Logik liefert nur die Farbe, wie an anderer Stelle in diesem Schema (kein Fachtext in `lib/vsm/*`, das würde die next-intl-Trennung von Logik und Text unterlaufen, die dieses Projekt sonst durchgehend einhält). Inhaltlich, damit „Handlungsempfehlung" mehr ist als eine Wiederholung der Ampelfarbe:

| Farbe | Empfehlung |
|---|---|
| 🔵 Blau (`< 0.5`) | Unterausgelastet — vor einer Investition in weitere Kapazität prüfen, ob die freie Zeit dieser Linie anderswo genutzt werden kann (Rüstzeiten senken lohnt sich hier am wenigsten, weil ungenutzte Kapazität ohnehin da ist). |
| 🟢 Grün (`0.5–1.0`) | Im Zielkorridor — keine Maßnahme nötig, Nachfrageentwicklung weiter beobachten. |
| 🟠 Orange (`> 1.0–1.2`) | Kapazität eng — kurzfristig wirksame Hebel prüfen: Rüstzeiten senken (SMED), Zusatzschicht/Überstunden im Peak-Monat, Produktion in Monate mit freier Kapazität vorziehen (siehe Nachbarmonate in der 12-Monats-Ansicht). |
| 🔴 Rot (`> 1.2`) | Kapazitätsproblem, Maßnahme Pflicht — strukturelle Hebel: dauerhafte Zusatzkapazität (Schichtausbau, Investition), Fremdvergabe, oder Nachfrage/Produktmix verschieben, bevor die Liefertreue leidet. |

Die orange/rote Empfehlung ist bewusst die Vorbelegung für eine neu angelegte `capacity_actions`-Zeile (Textvorschlag im Eingabefeld `description`), nicht nur Anzeige — der Unterschied zwischen "hier steht, was zu tun wäre" und "hier ist ein Massnahmenentwurf, den ich nur noch bestätigen muss" ist genau der, den `newProcess`/andere Vorbelegungen in diesem Projekt schon nutzen.

**4. i18n** — neuer Namespace `Capacity` in `messages/de.json`/`en.json` (Titel, Ampel-Labels, Handlungsempfehlungstexte, Schichtmodell-Labels). Bestehendes `TermTooltip`/`glossary.ts` um "NEE", "Load Rate", "CAMA" ergänzen — gleiche Konvention wie bei Heijunka/Pitch/Kaizen in der Future-State-Planung.

---

## Scope v1 (nach Vorlagen-Tabelle)

| Aus der Vorlage | v1 | Begründung |
|---|---|---|
| Aktionspläne mit Owner/Termin | **ja** | eigene Tabelle oben, geringer Aufwand |
| RF1/RF2/RF3-Vergleich | **ja** | kostenlos über bestehenden Szenario-Mechanismus |
| 4-Jahres-Vorschau (N…N+3) | **nein** | eigene Vorlage sagt "optional" — v1 nur laufendes Jahr |
| Backlog-Analyse | **nein** | eigene Vorlage sagt "weglassen für v1" |
| Synthese über mehrere Standorte | **nein** | kein Mehrstandort-Modell im Schema; später |

---

## Entscheidungen des Nutzers (2026-09-14)

1. **Ampel-Grenzen:** Schwellwert selbst zählt zur günstigeren Farbe (1.00 → noch grün, 1.20 → noch orange). Übernommen oben.
2. **`operator_count` in der Taktrate:** ja, aber nur bei wirklich identischen parallelen Arbeitsplätzen (flexible Linie/gleichartige Gruppen). Übernommen oben, inkl. UI-Hinweis am Feld.
3. **Kalender:** organisationsweit (ein Jahreskalender pro Firma), nicht projektweit. Übernommen oben — Migration und Ladepfad entsprechend geändert.

## Noch offen: Frage 4, anders gefragt

Die vierte Frage war zu knapp formuliert — hier konkreter:

Die Ampel als **kleines farbiges Symbol direkt auf der Prozessbox im Canvas** (Punkt "2. Ampel auf der Prozessbox" oben) ist zeichnerisch der aufwendigste Teil dieses Plans — Konva-Code auf der bestehenden Zeichenfläche, plus Sorgfalt, damit er nicht mit dem schon vorhandenen roten Engpass-Rahmen (der eine andere Frage beantwortet, siehe Abgrenzungs-Abschnitt) verwechselt wird. Die **Tabellenseite** (`/editor/[projectId]/capacity` mit Ampel-Spalte, Peak-Monat, Handlungsempfehlung) liefert praktisch denselben Nutzen ohne dieses Zeichenrisiko.

Zwei Wege, beide sauber machbar:

- **A — alles in einem Zug:** Tabellenseite **und** Canvas-Badge kommen zusammen in der ersten Umsetzung.
- **B — gestaffelt:** zuerst nur die Tabellenseite (Schritte 1–4 unten), das Canvas-Badge als eigener, kleiner Nachzug danach (Schritt 5), sobald die Tabellenseite im Alltag bestätigt hat, dass die Ampel-Logik stimmt.

Für diesen Plan reicht keine der beiden Varianten eine Entscheidung voraus, die ich nicht selbst treffen kann — falls keine Präferenz genannt wird, setze ich bei der Umsetzung **B** um (kleinere, prüfbare Schritte, der Reihenfolge weiter unten folgend), das Canvas-Badge lässt sich jederzeit gefahrlos nachziehen.

---

## Umsetzungsreihenfolge (falls freigegeben)

1. ✅ Migration (`processes.shift_model`, `processes.monthly_demand`, `vsm_org_settings.capacity_workdays`, `capacity_actions` + RLS) — `supabase/migrations/20260914150000_vsm_cama_capacity_analysis.sql`, geschrieben, **noch nicht angewendet** (siehe Abschnitt "Testsystem, nicht Prod" oben). Gegen eine lokale Wegwerf-Postgres (nicht Supabase, weder Test noch Prod) mit `supabase/tests/leere-datenbank-pruefen.sh` geprüft: läuft zweimal fehlerfrei durch (Idempotenz), die neuen CHECK-Constraints (`shift_model` nur 1/2/3, `capacity_actions.status` nur open/done) weisen ungültige Werte zurück, `ON DELETE CASCADE` räumt Aktionen mit auf, wenn die Linie gelöscht wird. `src/types/database.ts` von Hand nachgezogen (wie beim Firmenprofil-Commit üblich) und `tsc --noEmit` bestätigt keine neuen Typfehler — zwei bestehende Prozess-Konstruktoren (`vsmStore.ts`, `demoProject.ts`) mussten die zwei neuen Felder wie jedes andere optionale Feld auf `null` setzen.
2. ✅ `capacityAnalysis.ts` + Tests — `src/lib/vsm/capacityAnalysis.ts`, `src/lib/vsm/capacityAnalysis.test.ts`. 23 Tests, alle grün (Grenzwerte exakt auf 0.5/1.0/1.2, das Rechenbeispiel aus der Vorlage als Regressionstest, `operatorCount` verdoppelt Kapazität, 0 % NEE/ungültige Zykluszeit/0 Arbeitstage ergeben 0 Kapazität statt Infinity/NaN, saisonaler Kalender pro Monat). Dazu zwei kleine Hilfsfunktionen, die im Sketch noch fehlten, aber für den Übergang von den rohen jsonb-Spalten zu den 12-Monats-Arrays nötig sind: `resolveMonthlyValues` (processes.monthly_demand → 12 Zahlen, fehlende/ungültige Werte werden zum übergebenen Fallback statt still zu 0) und `resolveWorkdaysCalendar` (vsm_org_settings.capacity_workdays → 12 Zahlen, fehlende Monate → `DEFAULT_WORKDAYS_PER_MONTH`). Volle Testsuite (470 Tests) und `tsc --noEmit` bestätigt unauffällig.
3. ✅ Kalenderpflege in den Organisations-Settings (`vsm_org_settings.capacity_workdays`) — `/settings`, neue Sektion "Kapazitätskalender (CAMA)": 12 Felder (Platzhalter zeigt `DEFAULT_WORKDAYS_PER_MONTH` aus `capacityAnalysis.ts`, leer = "Vorgabe gilt"). Nur Inhaber dürfen schreiben (bestehendes `fieldset disabled`/RLS-Muster dieser Seite, keine neue Regel). `orgSettings.ts` liest den Kalender jetzt als 12er-Array mit `null` für nicht gesetzte Monate (bewusst nicht über `resolveWorkdaysCalendar` aus Schritt 2, das für die *Berechnung* schon den Vorgabewert einsetzt — hier soll das Formular den echten Leerzustand zeigen, nicht die Vorgabe als vermeintlich gesetzten Wert). `de.json`/`en.json` synchron ergänzt (Monatsnamen + Hinweistext). Volle Suite weiterhin grün, `tsc`/`eslint` sauber.
4. ✅ Kapazitätsdaten-Eingabepanel am Prozess — eingeklappter Abschnitt in `ProcessEditPanel` (`VSMCanvas.tsx`, kein eigenes Panel: teilt sich `mutate()`/`startTransition()` mit dem Rest des Formulars). Schichtmodell als Radiogruppe, 12 Monatsfelder mit Live-Ampel je Monat (rechnet mit den noch ungespeicherten Zykluszeit-/Bediener-/NEE-Werten desselben Formulars) und Peak-Monat-Hinweis. Identitäts-Hinweis am `operator_count`-Feld ergänzt (erscheint ab Bediener > 1). Kalender-Prop `capacityWorkdays` von der Editor-Seite bis zu `ProcessEditPanel` durchgereicht (`page.tsx` → `VSMCanvasLoader` → `VSMCanvas`), aus `loadOrgProfile` aufgelöst.

   **Nebenbefund beim Verdrahten, direkt behoben:** `ProcessEditPanel` ist dieselbe Komponente, die auch die öffentliche Demo (`DemoCanvas.tsx`) zeichnet — und die Demo hat ein eigenes, strenges Wire-Format für die Kontoübernahme (`demoTransfer.ts`, `DEMO_TRANSFER_VERSION`). Ohne Anpassung dort hätte eine Demo-Nutzerin, die CAMA-Daten einträgt und sich danach anmeldet, sie beim Übertrag stillschweigend verloren — dieselbe Art Lücke wie die zwei Prozess-Konstruktoren in Schritt 1, nur eine Ebene weiter draußen. `TransferProcess` um `shiftModel`/`monthlyDemand` ergänzt, Parser defensiv gegen fremde Eingabe (nur 1/2/3 als Schicht, nur ein exaktes 12er-Zahlen-Array), `DEMO_TRANSFER_VERSION` auf 2 erhöht (Formatänderung, wie im Modul selbst dokumentiert). 4 neue Tests dafür.

   Volle Suite: 477/477 grün, `tsc`/`eslint` sauber, `de.json`/`en.json` synchron (154/154 Editor-Keys).
5. ✅ `/editor/[projectId]/capacity`-Seite (Tabelle + Detail + Aktionspläne) — `capacity/page.tsx` + `capacity/actions.ts`, nach dem Muster von `/compare` (reiner Server Component, kein Client-State ausser den Formularen selbst). Zustand wechselbar wie im Editor (`?scenario=`), Klick auf eine Zeile → `?process=<id>` mit 12-Monats-Tabelle (Zahlen zuerst, Ampel als zusätzliches Signal — nie nur Farbe, siehe unten) und Aktionsplan (Hinzufügen/Erledigt/Löschen über Server-Actions, `description` mit der farbabhängigen Handlungsempfehlung vorbelegt). Linien ohne Schichtmodell erscheinen getrennt unter "Noch nicht erfasst" statt mit einer erfundenen Ampel. Link von der Editor-Kopfzeile aus ergänzt (neben "Szenarien vergleichen").

   **Farbgestaltung nach der `dataviz`-Skill-Prüfung:** Ampelfarben sind hier ein *Status*-Signal (gut/Achtung/kritisch + "unterausgelastet" als vierte, produktspezifische Stufe), kein kategoriales/sequenzielles Encoding — deshalb reserviert, nie als Serienfarbe wiederverwendet, und nirgends Farbe allein: jede Ampel trägt immer Emoji (🔵🟢🟠🔴, aus der Nutzer-Vorlage selbst übernommen) und Text/Zahl daneben. Die generische Platzhalter-Palette der Skill wurde bewusst **nicht** übernommen — dieses Produkt hat schon eine eigene, durchgängige Tailwind-Farbsprache (u. a. Rot = Engpass, Amber = Warnhinweis, siehe bestehende Kommentare im Code); eine zweite, fremde Palette wäre Inkonsequenz. Die Farb-/Emoji-Zuordnung liegt jetzt an einer Stelle (`components/VSMEditor/camaColors.ts`), von `ProcessEditPanel` (Schritt 4) und dieser Seite gemeinsam genutzt — vorher hätte sonst dieselbe Ampel an zwei Stellen zufällig unterschiedliche Farbtöne bekommen können. Statt eines separaten Balkendiagramms ist die 12-Monats-Ansicht eine Tabelle mit Zahlen *und* Ampel je Zeile — erfüllt "Tabellenansicht existiert" und "nie nur Farbe" gleichzeitig, ohne ein zweites Chart-Bauteil.

   Volle Suite weiterhin 477/477 grün, `tsc`/`eslint` sauber, vollständiger Produktions-Build (`next build`) erfolgreich — die neue Route erscheint korrekt neben `/compare` und `/future-state`. `de.json`/`en.json` synchron (neuer Namespace `Capacity`, 44 Keys je Sprache).
6. ✅ Ampel-Badge auf der Canvas-Box — kleiner farbiger Punkt unterhalb der Prozessbox (`ProcessBox` in `VSMCanvas.tsx`), erscheint **nur bei Orange/Rot**, dieselbe "Stille heisst in Ordnung"-Konvention wie beim bestehenden Engpass-Marker. Alle vier Ecken der Box waren schon belegt (Engpass, Bedienerzahl, Klassifizierung, Kaizen-Blitz) — der freie Streifen unterhalb (LANE_GAP = 40 Einheiten) hatte noch Platz. Gemeinsame Adapter-Funktion `computeCamaLine` (neu: `components/VSMEditor/camaLine.ts`) jetzt von der Kapazitätsseite *und* dem Canvas genutzt statt zweimal geschrieben.

   **Echter Fund beim Prüfen, nicht nur vermutet:** Der erste Entwurf zeigte hier dasselbe Emoji wie im Eingabepanel/auf der Kapazitätsseite (🟠/🔴). Vor dem Commit lokal geprüft — eine kleine Konva-Testseite gegen das bereits installierte `node_modules/konva` (kein Netzwerk, kein Supabase) mit Playwright gescreenshottet — und dabei festgestellt: **farbige Emoji rendern auf einem `<canvas>` nicht zuverlässig** (fehlende Farb-Emoji-Schriftart, je nach System — leere Kreise statt 🔴 im Screenshot). Anders als im DOM (Eingabepanel, Kapazitätsseite), wo derselbe Emoji-Text gewöhnlicher HTML-Text ist und zuverlässig funktioniert. Ersetzt durch die tatsächliche Peak-Load-Rate als Zahl auf dem farbigen Punkt (z. B. "1.1") — geprüft, dass das zuverlässig rendert, und informativer als ein Symbol: derselbe Rendering-Pfad, den Zahlen auf diesem Canvas ohnehin schon nehmen (Bedienerzahl, C/T, OEE), kein neues Risiko.

   Versuch, die Editor-Seite selbst per Playwright zu öffnen scheiterte erwartungsgemäß an der fehlenden Supabase-Verbindung (Middleware ruft `auth.getClaims()` auf jeder Route auf, auch `/demo`) — dieselbe Grenze wie beim Rest dieser Session, nicht spezifisch für diesen Schritt. Verifiziert stattdessen wie gewohnt: `tsc`/`eslint` sauber, volle Suite 477/477 grün, vollständiger `next build` erfolgreich, plus der gezielte, entkoppelte Konva-Rendering-Test oben.
7. `createScenario` um `monthly_demand`/`shift_model` beim Kopieren ergänzen (sonst verliert jede neue RF-Revision die Nachfragedaten der Quelle).
8. i18n + Glossar.
