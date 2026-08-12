# Plan — Future-State-Wizard (alle 8 Fragen) + Phase-8-Restsymbole

**Erstellt:** 2026-08-12, am Ende der Phase-7-Session. Noch **nicht implementiert** — bewusst in eine frische Session verschoben (die Erstellungs-Session lag bei ~$129 und war kontextnah an der Kompaktierungsgrenze).

**Priorisierungsentscheidung des Nutzers (2026-08-12):** Echtzeit-Mehrbenutzer-Editing wandert ans **Ende** der Roadmap; der Future-State kommt **zuerst**. Scope-Entscheidung: **alle 8 Fragen in einem Zug**, nicht der kleinere 1–5-Zuschnitt.

---

## Methodische Grundlage

Die 8 Future-State-Fragen aus Rother/Shook, *Learning to See*. (Häufig als "7 Fragen" zitiert — es sind acht; Beleg: Karen Martin Group, "Eight Questions for Future State", https://slideshare.net/KarenMartinGroup/08-232012-value-stream-mapping/53-Eight_Questions_for_Future_State)

Marktkontext für dieses Feature: generische Diagramm-Tools (Lucidchart, Miro, Visio) liefern Formen, aber **keine methodische Führung** durch diesen Denkprozess — das ist der Differenzierungspunkt gegenüber dem Wettbewerb und trifft besonders die Yellow-Belt-Persona (hohe digitale Affinität, wenig Methodenwissen).

## Abbildung auf das bestehende Schema

| # | Frage | Datenfeld | Status |
|---|---|---|---|
| 1 | Kundenbedarf / Taktzeit? | `projects.annual_throughput`, `projects.available_minutes_per_day` → `kpis.taktTimeMinutes` | vorhanden |
| 2 | Auf Auftrag oder ins Fertigwarenlager? | terminaler Puffer (`to_process_id IS NULL`), dessen `buffer_type` | vorhanden, keine Migration |
| 3 | Wo ist kontinuierlicher Fluss möglich? | `inventory_buffers.buffer_type = 'continuous'` | vorhanden |
| 4 | Wo braucht es Pull-Systeme? | `buffer_type = 'supermarket'` / `'fifo'` | vorhanden |
| 5 | Ein einziger Schrittmacher-Punkt? | `processes.is_pacemaker` + `lib/vsm/pacemakerConsistency.ts` | vorhanden |
| 6 | Wie wird der Mix nivelliert (Heijunka)? | — | **neu** |
| 7 | Welches Steuerungs-Zeitraster (Pitch)? | — | **neu** |
| 8 | Welche Verbesserungsschritte sind nötig (Kaizen-Blitz)? | — | **neu** |

## Neue Schema-Felder (Migration nötig)

- **`processes.has_heijunka` (bool, default false)** — Heijunka-Box hängt methodisch am Schrittmacher. Auf `processes` statt `projects`, weil `processes` bereits scenario-scoped ist → Nivellierung kann sich zwischen Ist- und Soll-Zustand unterscheiden, ohne Zusatzlogik.
- **`projects.pitch_minutes` (numeric, nullable)** — Steuerungs-Zeitraster. Bewusst auf `projects`, analog zu `annual_throughput`/`available_minutes_per_day` (etablierte Konvention in diesem Schema). **Bekannte Einschränkung, offen auszuweisen:** damit nicht pro Szenario unterschiedlich. Falls das später gebraucht wird, ist ein zusätzliches `scenarios.pitch_minutes` mit Fallback auf den Projektwert der saubere Nachzug.
- **`processes.kaizen_note` (text, nullable)** — Kaizen-Blitz mit kurzem Verbesserungstext, gezeichnet über der Prozessbox. Erste Stufe bewusst nur an Prozessen; Bursts an Verbindungen (`inventory_buffers`) wären der spätere Ausbau.

## Neue Canvas-Symbole

- **Heijunka-Box** — klassisches Raster-Rechteck, gezeichnet nahe Schrittmacher/ERP-Box. Positionierung analog zur bestehenden `erpBoxPosition()` in `autoLayout.ts`.
- **Kaizen-Blitz** — gezackter Stern (Konva `Star` oder `Line` mit `closed`), über der Prozessbox, mit kurzem Text darunter.

Beide müssen die etablierte **Schwarz-Weiss-Druckkonvention** einhalten (siehe frühere Design-Pässe): schwarze Linie auf weiss, keine Farbfüllung. Akzentfarben bleiben den bestehenden semantischen Signalen vorbehalten (blau = Auswahl, rot = Engpass).

## Reine Logik (TDD zuerst)

**`lib/vsm/futureStateQuestions.ts`** — das testbare Herzstück. Pro Frage aus dem aktuellen State ableiten:
- `status`: `'answered' | 'open' | 'not_applicable'`
- `summary`: kurzer deutscher Satz mit dem Ist-Stand ("Schrittmacher noch nicht gesetzt", "3 von 4 Verbindungen laufen noch als Push", "Taktzeit 4,8 min aus 50 000 Stk/Jahr")

Wiederverwendet werden dabei die bereits vorhandenen, getesteten Module: `calculations.ts` (Takt), `pacemakerConsistency.ts` (Frage 5 + Pull-Konsistenz), `buffers.ts`, `chainOrder.ts`. **Keine dieser Berechnungen neu schreiben** — der Wizard ist eine Führungs-/Präsentationsschicht über bestehender Logik, keine zweite Rechenquelle.

## UI

Neue Route **`/editor/[projectId]/future-state?scenario=<id>`** (eigene Route statt Panel — 8 Schritte sind zu viel für die ohnehin schon dichte Editor-Seite, siehe UX-Audit Befund #7 zur Informationsdichte).

- Erfordert ein ausgewähltes Szenario. Ist keins da: direkt anbieten, eins anzulegen (`createScenario` existiert bereits und dupliziert den Ist-Zustand vollständig).
- Pro Schritt: Frage, aktueller Stand aus `futureStateQuestions.ts`, passende Bedienelemente (Dropdowns/Felder, die die **bestehenden** Server-Actions aufrufen — `setBufferWip`, `updateProcess`, `updateAnnualThroughput` …), Zurück/Weiter.
- Am Ende: Zusammenfassung + Link auf `/compare` (Ist vs. Soll steht dort bereits vollständig).
- Glossar-Anbindung (`TermTooltip`) für jeden Fachbegriff — bestehende Komponente, neue Einträge für Heijunka/Pitch/Kaizen in `glossary.ts` ergänzen.

## Iterativ, nicht linear (Nutzeranforderung 2026-08-12)

**Kernanforderung des Nutzers:** Der Future State entsteht in **mehreren Iterationen**. Man geht die acht Fragen einmal durch, sieht das Ergebnis, stellt fest "ist noch nicht gut", und geht dann **gezielt zu einer einzelnen Frage zurück** und entscheidet dort anders — oder macht einen komplett neuen Durchlauf auf Basis des bisherigen Ergebnisses.

Das ist keine Detailverfeinerung, sondern bestimmt die Architektur des Wizards. Konkrete Konsequenzen:

**1. Kein linearer Zwang, kein Fortschritts-State.**
Es darf **keinen** separat gespeicherten "Wizard-Fortschritt" geben (kein `current_step`, kein `completed`-Flag). Der Status jeder Frage wird bei jedem Aufruf frisch aus den echten Daten abgeleitet (`futureStateQuestions.ts`) — dadurch ist Wiedereintritt automatisch korrekt, und der Wizard kann nie einen Stand behaupten, der nicht mehr den Daten entspricht. Wer zwischendurch direkt auf dem Canvas etwas ändert, sieht das beim nächsten Öffnen sofort in den Frage-Status.

**2. Übersichtsseite statt erzwungener Schrittfolge.**
Einstieg ist eine **Übersicht aller acht Fragen** mit ihrem jeweiligen Status (`answered` / `open`) und Kurz-Zusammenfassung. Von dort per Klick direkt in **jede beliebige** Frage springen — Vorwärts/Rückwärts-Buttons gibt es zusätzlich für den Erstdurchlauf, aber sie sind nicht der einzige Weg. Frage 6 nachträglich ändern darf nie bedeuten, sich durch 1–5 durchklicken zu müssen.

**3. Wiedereintritt ist der Normalfall, nicht der Sonderfall.**
Der Wizard wird öfter *erneut* geöffnet als zum ersten Mal. Jede Frage zeigt beim Öffnen den aktuell gesetzten Wert als Ausgangszustand — nie ein leeres Formular, das eine bestehende Entscheidung stillschweigend überschreiben könnte.

**4. Iteration über mehrere Szenarien — hier fehlt heute etwas.**
`createScenario` (`scenario-actions.ts`) kopiert **fest verdrahtet vom Ist-Zustand** (`.is('scenario_id', null)`). Ein Szenario B als Weiterentwicklung von Szenario A anzulegen ist damit aktuell **unmöglich** — genau der "ich mache noch eine Iteration"-Fall. Nötige Änderung:
- `createScenario` bekommt einen optionalen `sourceScenarioId`-Parameter; die beiden Kopier-Queries filtern dann auf diese Quelle statt hart auf `IS NULL`. Die Kopierlogik selbst (inkl. `idMap`-Remapping der Puffer-Kanten) funktioniert unverändert — sie ist quellenagnostisch, nur die Filterbedingung ist es nicht.
- Im Wizard-Abschluss und im Szenario-Umschalter je ein "Neue Iteration aus diesem Szenario"-Einstieg.
- **Optional, empfohlen:** `scenarios.parent_scenario_id` (nullable, self-referential FK) für die Abstammung — dann ist auf der Vergleichsseite sichtbar, dass B aus A hervorgegangen ist und nicht unabhängig vom Ist-Zustand entstand. Analog zum bereits existierenden `processes.origin_process_id`. Ohne dieses Feld funktioniert die Iteration trotzdem, nur die Herkunft ist dann nicht mehr nachvollziehbar.

**5. Bewertung zwischen den Iterationen.**
Die Vergleichsseite (`/editor/[projectId]/compare`) stellt bereits **alle** Zustände nebeneinander (Ist + A + B + C) — sie ist damit schon das richtige Werkzeug für "ist meine zweite Iteration besser als die erste" und braucht dafür keine Änderung. Der Wizard-Abschluss verlinkt bewusst dorthin, statt eine eigene, zweite Auswertung zu bauen.

## Vorgeschlagene Reihenfolge

1. Migration (`has_heijunka`, `pitch_minutes`, `kaizen_note`, optional `parent_scenario_id`) + `database.ts` neu generieren
2. `futureStateQuestions.ts` mit Tests (RED → GREEN) — die Status-Ableitung ist auch die Grundlage der Übersichtsseite, also zwingend vor der UI
3. Wizard-Route: **Übersichtsseite** + Fragen 1–5 (nur bestehende Felder, kein neues Canvas nötig). Sprungnavigation von Anfang an, nicht nachgerüstet
4. `createScenario` um `sourceScenarioId` erweitern + "Neue Iteration aus diesem Szenario"-Einstieg — macht den Iterationszyklus vollständig, noch bevor die neuen Symbole existieren
5. Heijunka-Box + Kaizen-Blitz auf dem Canvas
6. Fragen 6–8 im Wizard an die neuen Felder anschliessen
7. Glossareinträge, Verifikation (tsc/ESLint/Vitest/Build)

Schritte 1–4 sind ein sinnvoller erster Commit: danach ist der **vollständige Iterationszyklus** nutzbar (durchgehen → bewerten → gezielt zurück oder neue Iteration), nur eben über die fünf Fragen, die ohne neue Symbole auskommen. Schritte 5–7 sind ein zweiter Commit. Falls die Session vorher endet, ist Zwischenstand 4 in sich abgeschlossen und methodisch sinnvoll — das war bei der ursprünglichen Reihenfolge (Iteration erst implizit am Schluss) nicht der Fall.

## Danach noch offen

Echtzeit-Mehrbenutzer-Editing (Supabase Realtime) — per Nutzerentscheidung ans Ende der Roadmap. Es existiert bis heute keinerlei Realtime-/Presence-Infrastruktur im Code; das bleibt die grösste Einzelphase und braucht eine eigene Session.
