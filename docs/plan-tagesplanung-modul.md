# Plan — Modul Tagesplanung (Nachfolger des 414 Produktionsplanungstools)

**Erstellt:** 2026-10-03, auf Nutzerwunsch. Grundlage ist das Konzept „414 Produktionsplanungstool —
Konzept für Web-Applikation" (Tizian Seibert, 03.10.2026) und die Planungsrunde aus derselben Sitzung.
Hier stehen die Entscheidungen und die Faktenbasis, aus der sie folgen — das Fachkonzept selbst
(Workflow-Stepper, Leitfragen, Ampel-Schwellen, Importformate) wird nicht wiederholt, sondern
vorausgesetzt.

**Stand:** Plan, noch nicht umgesetzt. Phase 0 und die Vorbedingungen (Abschnitt „Bevor echte Daten
fliessen") gehen jedem Code mit echten Daten voraus.

---

## Faktenbasis

1. **Das Konzept gehört dem Nutzer.** Der erste Einsatz ist ein interner Pilot bei Feller (Arbeitgeber
   des Nutzers, Teil von Schneider Electric), mit der Absicht, das Modul danach über Taktane zu
   vermarkten.
2. **Taktane ist das Einzelunternehmen und die einzige Website des Nutzers.** Kein weiteres Hosting.
   Deshalb kommt das Modul nach Taktane und nicht nach LeanPulse Industrial, obwohl LeanPulse ein
   fachlich näheres Datenmodell hat (`Machine`, `Shift`, `ShiftAssignment`, `StandardTime`, `Queue`,
   `Escalation`). Ein zweites Produkt mit eigenem Deployment (Vercel + Railway, Next 14, eigene
   Fastify-API) wiegt für eine Person schwerer als ein paar doppelte Stammdaten.
3. **Es gibt kein separates Testsystem für die Datenbank** (`docs/plan-cama-capacity-analysis.md`,
   „Testsystem, nicht Prod"). Test und Prod trennen sich über Branch und Vercel-Preview; die
   Datenbank ist die eine, geteilte. Was im „Testsystem" gespeichert wird, liegt in der
   Produktionsdatenbank.
4. **Die beiden Feller-Konstanten sind eine Zahl:** `1 / 0.40105915 = 2.4934`. Das Kmix-Ziel ist genau
   der Punkt, an dem `DLP = UT × f − OT = 0` wird. Ein Kunde muss also nur **einen** Wert festlegen:
   wie viele Personalstunden eine Maschinenstunde trägt (`f`); Kmix-Ziel = `1 / f`.
5. **Kmix braucht keine Historie.** Es ist ein Tagesverhältnis (`UT / OT`). Historie brauchen nur die
   Prognose, ein sinnvolles Zielniveau und die Mustererkennung — daraus folgen die Reifestufen unten.

## Kernentscheidungen

- **Drittes Modul neben VSM und Kapazitätsmanagement**, mit eigener Kachel in der Firmenübersicht
  (`docs/plan-company-overview-modules.md` sieht die dritte Kachel als „eine weitere Zeile" vor).
- **Maschinen hängen an `production_lines`.** Damit stehen CAMA-Monatskapazität und Tagesplan auf
  derselben Linie — ein Zusammenhang, den kein reines Shopfloor-Tool hat.
- **Eigene Tabellen mit Präfix `pp_`**, nach Taktane-Konvention in `supabase/migrations/`, additiv,
  RLS über `has_org_role`. Keine Kopplung an LeanPulse-Tabellen in v1 (Regel 1 aus
  `supabase/README.md`; ausserdem liegt LeanPulse seit dem 24.08. still und hat eine offene
  Datenmodell-Konsolidierung `TrackingLog`/`QualityHourlyEntry`).
- **Kein Prisma, kein Express, kein Puppeteer** (anders als im Konzept vorgeschlagen): Server Actions
  und supabase-js wie im Rest von Taktane, Wochenbericht mit `jspdf` wie `pdfSummary.ts`.
- **Werkskonstanten sind Einstellungen, nie Code.** DLP-Faktor, Schichtzeiten, Schichtcodes,
  Ampel-Schwellen und die Spaltenzuordnung des SAP-Imports liegen in `pp_settings` je Organisation.
  Feller-Werte stehen nur in Fellers Zeile — nicht als Vorgabe, nicht in Tests, nicht im Marketing.
- **Rollen:** viewer = Werksleitung (lesen), editor = Planer/Schichtleiter, admin = Teamleiter
  (Status von Massnahmen und Kein-Programm-Fällen). Das Kürzel bleibt Anzeigefeld neben dem Login.
- **Tarif:** neues Merkmal `productionPlanning` in `PlanLimits` (`src/lib/billing/plans.ts`) — kein
  neuer `AppProduct`-Wert, denn das Enum gehört Prisma.
- **Begriff DLP:** LeanPulse nennt einen Leistungsgrad in Prozent ebenfalls „DLP"
  (`line-day-aggregation.ts:57`). In Taktane gilt die Definition des Konzepts (Stunden). Falls die
  Produkte je zusammenwachsen, muss einer der beiden Begriffe umbenannt werden.

## Datenmodell (Entwurf)

| Tabelle | Inhalt |
|---|---|
| `pp_settings` | je Organisation: `dlp_factor`, Schichtzeiten, Nachtschicht-Split, Schichtcodes, Ampel-Schwellen, Import-Zuordnung |
| `pp_machines` | Maschine, Team, Farbe, `line_id → production_lines` |
| `pp_plans`, `pp_plan_items` | Tagesplan aus dem Rüstplan; Plandatum und Produktionstag getrennt geführt |
| `pp_day_snapshots` | UT/OT Ist, Ist-Rüstzeiten, **Datenquelle je Wert** (manuell / Import / Schnittstelle) |
| `pp_reflections`, `pp_day_comments` | d1..d4, Kürzel, `closed_at` |
| `pp_week_fazit` | Wochenfazit je KW |
| `pp_shift_roster` | Person (Kürzel), Team, Woche, Codes |
| `pp_no_program` | eindeutig über Organisation + Artikel + Maschine, mit Zähler |
| `pp_learnings` | Erkenntnisse-Log |
| `capacity_actions` | wird zum gemeinsamen Massnahmen-Register: + `module`, `origin`, Status `in_progress` |

Die Datenquelle je Wert ist von Anfang an im Schema, damit die spätere MES-Anbindung (unten) keine
Migration bestehender Zeilen braucht.

**Datensparsamkeit im Schichtplan:** `k` (krank), `h` (Ferien) und `a` (abwesend) werden als ein Code
„abwesend" gespeichert. Für die Planung zählt nur, dass jemand fehlt — der Grund ist eine
Gesundheitsangabe und gehört nicht in das Tool. Unbekannte Codes werden weiterhin gezählt und gemeldet.

## Reifestufen — Nutzen ab Tag 1, Kennzahlen wachsen mit

Ein KMU hat selten Produktivitätsdaten. Das Modul darf deshalb nicht erst nach einem Jahr Sammeln
etwas zeigen. Jede Stufe hat ab dem Tag, an dem ihre Eingabe vorliegt, einen eigenen Nutzen:

| Stufe | Eingabe | Ergebnis | Verfügbar |
|---|---|---|---|
| 0 Planen | Rüstplan (Import oder von Hand), Schichtplan | Gantt, Konfliktwarnung, Kein-Programm-Liste, Reflexion, Massnahmen | Tag 1 |
| 1 Plantreue | je Rüstung „erledigt" + Uhrzeit | Ausführungsrate, Ø Startversatz, ungeplante Umrüstungen | Tag 1 |
| 2 Personal | Präsenzstunden | PV-Stunden Soll/Ist | Tag 1 |
| 3 Produktivität | UT: Betriebsstundenzähler **oder Ersatzwert** gute Teile × Zykluszeit ÷ Kavitäten | Kmix, DLP je Tag | ab der ersten UT-Eingabe |
| 4 Prognose | — | UT-Prognose mit Konfidenz | ab ca. 5 Tagen, Konfidenz sichtbar |
| 5 Muster | — | Vorschläge der Aktions-Engine | je Regel, sobald ihr Fenster gefüllt ist |

- **Prognose ohne Kaltstart:** Anfangs aus Vorgabewerten des Plans (Zykluszeit × Menge), mit jedem
  Ist-Tag stärker aus der eigenen Historie. Das Gewicht ist der Datenmengen-Anteil der bestehenden
  Konfidenzformel (Wurzelkurve, volle Wirkung ab ca. 30 Tagen) — keine zweite Formel.
- **Zielniveau ohne Vorwissen:** Wer `f` nicht aus Kostensätzen rechnen kann, startet mit dem eigenen
  Median der ersten 10 erfassten Tage als Ausgangswert; das Ziel wird danach bewusst angehoben.
- **Anzeige „Datenreife":** zeigt, was schon gerechnet wird, was fehlt und was die nächste Eingabe
  freischaltet („Noch 6 Tage bis zur Mustererkennung").
- **Vergangenheit nachladen:** Import von Wochen-/Monatswerten aus Excel verkürzt die Anlaufzeit.
- **Täglicher Aufwand unter 5 Minuten:** zwei Zahlen, Häkchen, vier Fragen.
- **Tarif-Logik (Hypothese):** Stufe 0–2 als niederschwelliger Einstieg, Produktivitätsauswertung ab
  Stufe 3 als bezahlter Teil.

## MES-Schnittstellen (nach dem Pilot)

Import/Export von Dateien ist der Einstieg, nicht das Ziel. Wo ein MES oder Leitrechner läuft, sollen
UT, Stückzahlen, Aufträge und Rüstzeiten automatisch kommen — dann entfällt die manuelle Eingabe aus
Stufe 3, und die Reifestufen füllen sich von selbst.

**Die Randbedingung, die alles bestimmt:** Taktane läuft serverlos auf Vercel. Ein MES steht im
Werksnetz hinter der Firewall; Taktane kann es nicht von aussen abfragen. Daten müssen deshalb **zu**
Taktane geschickt werden, nicht von Taktane geholt.

**Stufenweise:**

1. **Eigene Eingangs-API (Grundlage für alles Weitere).** `POST /api/pp/ingest/...` mit einem
   API-Schlüssel je Organisation (nur als Hash gespeichert, wie die Einladungstoken), widerrufbar,
   mit Protokoll. Ein normiertes Format für die drei Dinge, die das Modul braucht:
   - Maschinenzeit je Maschine und Zeitraum (UT, Stillstände),
   - Aufträge/Rüstungen (Artikel, Maschine, Werkzeug, Menge, Start/Ende),
   - Stückzahlen (gut/schlecht).
   Jeder Wert trägt seine Quelle; eine Schnittstelle überschreibt keine manuelle Korrektur stillschweigend.
2. **Geplante Datei-Übergabe** für Systeme, die nur exportieren können: das MES legt einen Export ab,
   ein kleines Skript beim Kunden (oder dessen eigener Export-Job) schickt ihn an die Eingangs-API.
   Gleiche Formaterkennung wie beim manuellen Upload.
3. **Hersteller-Anbindungen**, je eine schmale Adapter-Datei pro System, die auf das normierte Format
   übersetzt — nach dem Muster von `camaLine.ts` (eine Stelle kennt das Fremdformat, die Rechenlogik
   nie). Kandidaten im Spritzguss:
   - **ARBURG Leitrechnersystem (ALS)**
   - **MPDV HYDRA** (bzw. die Integrationsplattform MIP)
   - herstellerneutral über **EUROMAP 77** (OPC UA zwischen Spritzgiessmaschine und MES) und
     **EUROMAP 63** (älterer, dateibasierter Standard, an vielen Bestandsmaschinen noch verbreitet)

   Welche Exporte, APIs und Lizenzen die einzelnen Systeme tatsächlich anbieten, ist **vor dem Bau
   beim Hersteller und beim jeweiligen Kunden zu prüfen** — dieser Plan legt nur die Architektur fest,
   nicht die Details fremder Schnittstellen.
4. **Direkt an der Maschine (OPC UA)** braucht ein Gateway im Werksnetz. Das ist Hardware/Software beim
   Kunden und kein Teil von Taktane-Hosting; bewusst ausserhalb dieses Plans.

**Reihenfolge:** Die Eingangs-API kommt zuerst, weil sie jede spätere Anbindung trägt und auch ohne
Hersteller-Adapter schon nutzbar ist (Kunde oder Integrator schreibt direkt dagegen). Welcher
Hersteller-Adapter zuerst gebaut wird, entscheidet der erste zahlende Kunde mit diesem System — nicht
eine Marktvermutung.

## Testdaten statt echter Daten

Für Entwicklung und Preview werden **keine Daten aus Feller-Systemen exportiert**, auch nicht
verfremdet — auch ein verfremdeter Export kann nach Konzernrichtlinie schon eine Datenweitergabe sein.
Stattdessen ein **Generator** (`src/lib/pp/fixtures/`), der erzeugt:

- Rüstpläne im echten SAP-xlsx-Format, inklusive Streaming-ZIP-Headern (Grösse/CRC = 0),
- Schichtpläne mit Sheet „Schichtplan", 53 Wochen, allen Codes und einigen unbekannten,
- UT/OT-Verläufe mit realistischer Streuung, Ausreissern und Lücken, über wählbar viele Tage,
- erfundene Artikel-, Maschinen- und Werkzeugnummern im Muster der echten (`T035-A02`).

Damit lassen sich alle Reifestufen mit 0, 5, 14 und 60 Tagen Daten durchtesten. Später dient derselbe
Generator als Demo-Firma für Interessenten, wie das Beispiel-VSM.

## Bevor echte Daten fliessen (Vorbedingungen)

Das ist keine Rechtsberatung, sondern die Liste, die vor dem Pilot mit echten Feller-Daten erledigt
sein muss:

1. **Offenlegung bei Feller, vor dem Pilot.** Arbeitsvertrag und Personalreglement prüfen, dann mit
   der vorgesetzten Person sprechen. Die Pflicht hängt nicht am Umsatz: Sobald das eigene Produkt beim
   Arbeitgeber läuft, besteht ein Interessenkonflikt (Treuepflicht, Art. 321a OR).
2. **Schriftliche Bestätigung zu den Rechten.** Nach Art. 17 URG liegen die Nutzungsrechte an
   Software, die in Ausübung der Arbeit entsteht, beim Arbeitgeber. Gewünschter Inhalt etwa:
   „Taktane darf das Modul vermarkten, Feller nutzt es als Pilot."
3. **Freigabe durch Feller-IT und Datenschutz** für Produktionsdaten auf einem externen SaaS mit
   US-Anbietern dahinter (Supabase, Vercel), dazu ein AVV. Deckt sich mit den offenen Punkten 4 und 9
   aus `docs/saas-audit-2026-10-02.md` (Export/Löschung, AVV-Seite, TOMs).
4. **Betriebsreife der Datenbank:** Supabase Pro mit Backup, eigenes `pg_dump`, getesteter Restore
   (Audit, Punkt 2), Schema-Drift behoben (Audit, Punkt 3). Ein Werkzeug für den täglichen Betrieb
   ohne Backup ist nicht vertretbar.

Unabhängig von Feller, je nach Umsatz: AHV-Anmeldung als Selbständiger bei Aufnahme der Tätigkeit
(kleiner Nebenerwerb auf Antrag beitragsbefreit), MWST- und Handelsregisterpflicht ab
CHF 100'000 Jahresumsatz.

## Umsetzungsreihenfolge (bei Freigabe, Schritt für Schritt)

Zeiten sind grobe Schätzungen für eine Person mit Claude Code.

0. **Voraussetzungen (ca. 1 Woche):** Audit-Punkte 2 und 3, CI mit Lint/Test/Build und Drift-Check.
   Parallel: Gespräch mit Feller (Vorbedingungen 1–3).
1. **Fundament (1–2 Wochen):** Migration mit RLS, `pp_settings`, Maschinen an Linien,
   `src/lib/pp/` als reine Funktionen mit vitest — DLP/Kmix, Nachtschicht-Split, Konfidenz,
   Prognose-Gewichtung, Ampeln, Regeln der Aktions-Engine, Formaterkennung, ZIP-Reparatur.
   Die Rechenregeln werden gegen das bestehende HTML-Tool geprüft. Dazu der Testdaten-Generator.
2. **Planung (ca. 2 Wochen):** Rüstplan- und Schichtplan-Import (SheetJS serverseitig; vorher in
   `node_modules/next/dist/docs/` die Grössengrenze für Server-Action-Uploads nachlesen; SheetJS über
   das Tarball von cdn.sheetjs.com, nicht das veraltete npm-Paket), Workflow-Stepper ohne
   Export-Schritt, Gantt mit Konfliktwarnung, Prognosekarte.
3. **Tageserfassung und Reflexion (ca. 2 Wochen):** Ist-Erfassung mit Datumsprüfung, UT-Ersatzwert
   aus Stückzahl × Zykluszeit, vier Leitfragen mit Daten-Hinweisen, Abschlussregel, Kein-Programm.
4. **Woche und Handeln (ca. 2 Wochen):** KPI-Matrix, KW-Kacheln, Wochenfazit, Aktions-Engine,
   gemeinsames Massnahmen-Register, Erkenntnisse-Log, Excel- und PDF-Export, Anzeige „Datenreife",
   Modul-Kachel, i18n de/en.
5. **Pilot (2–4 Wochen):** einmaliger Import der localStorage-Daten aus dem alten Tool, Parallelbetrieb
   bis die Tageswerte übereinstimmen, dann Umstellung.
6. **Nach dem Pilot:** Eingangs-API, danach der erste Hersteller-Adapter nach Kundenbedarf.

Wie bei den vorherigen Plänen: jeder Schritt einzeln zur Freigabe. Code nur auf einem eigenen Branch,
kein Merge nach `master` und keine Migration auf die geteilte Datenbank ohne ausdrückliche Freigabe.

## Was **nicht** Teil dieses Plans ist

- Keine Integration in oder Kopplung an LeanPulse Industrial.
- Kein Maschinen-Gateway und kein OPC-UA-Client im Taktane-Hosting.
- Keine Echtzeit-Zusammenarbeit (WebSockets) in v1 — „letzter Schreibvorgang gewinnt" mit Zeitstempel.
- Keine Preisangaben auf der Preisseite, bevor 3–5 Gespräche mit anderen Spritzgiessern den Preis
  bestätigt haben.
