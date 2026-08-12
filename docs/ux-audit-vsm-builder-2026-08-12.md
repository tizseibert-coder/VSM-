# UX-Audit — VSM Builder (2026-08-12, Phase 7a)

Systematischer Durchgang aller Dateien in `src/components` und `src/app` gegen sieben Kategorien — die ersten fünf im selben Format wie der LeanPulse-Industrial-Audit (`ux-audit-2026-08-01.md`), plus zwei VSM-Builder-spezifische Kategorien. Kontrastwerte sind über die tatsächlichen Tailwind-Zinc-Hexwerte nach der WCAG-Relativluminanz-Formel berechnet, nicht geschätzt.

Bewertet gegen drei Personas (Beschreibung vom Nutzer, nicht aus Projektdokumenten — es existiert aktuell keine schriftliche Persona-Doku für VSM Builder):
- **20 J., Yellow Belt** — hohe digitale Affinität, wenig Lean-Methodenwissen.
- **35 J., Green Belt** — mittlere Affinität, baut Maps, berichtet nach oben.
- **60 J., Master Black Belt** — eher niedrigere Affinität, höchste Methodentiefe, **moderiert Workshops mit einem Team im Raum** statt allein am Bildschirm zu arbeiten.

---

## 1. Touch-/Klick-Ziele < 48px

| Datei | Element | Ist-Grösse |
|---|---|---|
| `TermTooltip.tsx:26` | Glossar-"?"-Button (auf KPI-Tiles & Formularlabels verteilt, Phase 5) | **14×14px** (`h-3.5 w-3.5`) — schwerster Fund im ganzen Audit |
| `VSMCanvas.tsx:1420/1466` | "✕ trennen" (Verbindung lösen, Mehrstrang-Panel, Phase 6) | reiner Textlink ohne Padding, ~16–18px |
| `VSMCanvas.tsx:657–681` | Zoom −/+/Einpassen-Buttons | `py-1` → ~28–30px |
| `VSMCanvas.tsx:1547` | "Prozess löschen" | `py-1.5` → ~26–28px |
| `BenchmarkPanel.tsx:70/81` | Branche/Grösse-Selects | `py-1.5` → ~26–28px |
| `ScenarioSwitcher.tsx`, `ScenarioMetaPanel.tsx`, `NewScenarioDisclosure.tsx` | alle Tabs/Inputs/Buttons | durchgängig `py-1.5` → ~26–28px |

Gemeinsamkeit: **der gesamte Szenario-Bereich und das neue Mehrstrang-Panel (Phase 6)** liegen systematisch unter 48px — genau die Stellen, an denen ein Master Black Belt im Workshop schnell und ohne Fehlklick arbeiten müsste. Der 14px-Glossar-Button trifft zusätzlich genau die Persona (Yellow Belt), die ihn am meisten braucht.

## 2. Kontrast-Probleme (< 4.5:1) — real berechnet

Zwei wiederkehrende Klassenkombinationen, **22 Fundstellen in 8 Dateien**:

**a) `text-zinc-400 dark:text-zinc-600`** (2 Stellen: `VSMCanvas.tsx:645` Zoom-Hinweistext, `dashboard/page.tsx:120` "Öffnen →")
- Hell: `#a1a1aa` auf `#fafafa` → **~2,45:1**
- Dunkel: `#52525b` auf `#000000` → **~2,71:1**
- Beide klar unter WCAG-AA. Der Zoom-Hinweistext ("Strg/Cmd + Mausrad zum Zoomen") ist echte Instruktion, keine Dekoration.

**b) `text-zinc-500 dark:text-zinc-500`** (20 Stellen, u. a. Vergleichstabelle `compare/page.tsx` — Spaltenköpfe "Kennzahl"/"Business Case" und alle Zeilenlabels wie "Investition", "Payback", "Risiko" — genau die Seite, die ein Master Black Belt für den Business Case präsentiert)
- Hell: `#71717a` auf `#fafafa` → **~4,63:1** (besteht knapp)
- Dunkel: `#71717a` auf `#000000` → **~4,35:1** (**fällt knapp durch** AA)

Beide Kombinationen konvergieren auf denselben Fix: **`text-zinc-500 dark:text-zinc-400`** (Hell bleibt bei ~4,6:1, Dunkel springt auf ~8,2:1) — ein Hebel für alle 22 Stellen, analog zum `--lp-ghost`-Fund bei LeanPulse.

## 3. Zu viele Schritte für eine Aktion (> 3)

- Erste VSM anlegen: Dashboard → "✨ Beispiel-VSM laden" ist bereits vorhanden und löst genau das Yellow-Belt-Einstiegsproblem (nicht als Lücke zu werten — bestehende Stärke).
- Szenario anlegen: 1 Klick öffnen → 2 Felder → Anlegen = im Rahmen.
- Kein Flow überschreitet 3 Schritte.

## 4. Fehlende Fehlerzustände

- `BenchmarkPanel.tsx:50`: `if (references.length === 0) return null` — Panel verschwindet kommentarlos, kein Hinweis warum.
- `dashboard/actions.ts`: Fehlermeldungen geben teils rohe Supabase-Fehlertexte direkt durch (`Beispiel-Prozesse konnten nicht angelegt werden: ${processesError.message}`) — für einen nicht-technischen Nutzer mitten im Workshop wenig hilfreich.
- Die meisten Formulare zeigen Fehler aber immerhin sichtbar an (`text-red-700` + Query-Param-Pattern) — kein stummes Verschlucken wie bei LeanPulses `derived-hours.tsx`.

## 5. Unklare Texte für nicht-technische Nutzer

- Keine gefundenen internen Platzhalter-Codes (kein Pendant zu "SIM1 Eskalieren"). Deutsche Beschriftungen sind durchgehend klar.
- Rohe DB-Fehlertexte (siehe Punkt 4) sind der einzige Fund in dieser Kategorie.

## 6. NEU — Fehlende Bestätigung bei destruktiven Aktionen

- **"Prozess löschen"** (`VSMCanvas.tsx:1543`, `handleDelete`) und **"Szenario löschen"** (`ScenarioMetaPanel.tsx`) lösen sofort beim ersten Klick aus — kein `confirm()`, kein zweistufiger Button, kein Undo. Kaskadiert in der DB (Prozess reisst angrenzende `inventory_buffers`-Kanten mit).
- Im Präsentations-/Workshop-Kontext (Phase 7b) besonders riskant: ein Wischer auf einem Laptop-Trackpad vor dem Beamer, während der Facilitator eigentlich etwas anderes zeigen wollte, löscht unwiederbringlich einen Prozessschritt.
- "✕ trennen" (Verbindung lösen) ist weniger kritisch — die Verbindung lässt sich über die Predecessor/Successor-Picker sofort wiederherstellen, daher hier bewusst keine Bestätigung vorgeschlagen.

## 7. NEU — Informationsdichte pro Rolle (ISA-101-Prinzip)

- Das `ProcessEditPanel` zeigt in einem einzigen Formular: Name, CT, OEE, Operator-Count, Changeover, Pacemaker-Checkbox, Klassifizierung, **plus** das komplette Verbindungen-Panel (Vorgänger/Nachfolger mit Add/Remove) — alles gleichzeitig sichtbar, keine Sektionstrennung zwischen "Kernwerte, die man oft ändert" und "Struktur, die man selten anfasst".
- Für den schnellen Blick eines Green Belt beim Datenerfassen ist das viel auf einmal; für den Master Black Belt im Workshop (Publikum schaut mit) ist die Fläche potenziell überladen. Kein harter Fehler, aber ein Kandidat für Phase 7b (Präsentationsmodus blendet ohnehin Edit-Chrome aus — löst dieses Problem dort automatisch mit).

---

## Priorisierung (Top 4)

1. **Kontrast-Fix `text-zinc-500 dark:text-zinc-400`** — ein Klassen-Swap, 22 Fundstellen, 8 Dateien, betrifft auch die Business-Case-Vergleichstabelle.
2. **Touch-Targets: Glossar-"?"-Button, Zoom-Buttons, "✕ trennen"** — auf ≥ 44px Hit-Fläche via Padding (gleiche Technik wie LeanPulses `info-tag.tsx`-Fix: Padding + Negativ-Margin, sichtbare Grösse bleibt kompakt).
3. **Bestätigung vor "Prozess löschen" / "Szenario löschen"** — zweistufiger Button statt Sofort-Löschung.
4. **Rohe DB-Fehlertexte in `dashboard/actions.ts` abfangen** — generische deutsche Meldung statt Postgres-Rohtext (kleinerer Fix, niedrigere Priorität als 1–3).

Punkt 7 (Informationsdichte) wird nicht separat gefixt, sondern fliesst in den Zuschnitt von Phase 7b ein.
