# Plan — Firmenübersicht mit Modul-Kacheln statt VSM-zentriertem Dashboard

**Erstellt:** 2026-09-17, auf Nutzerwunsch nach der Analyse zum Linien-Modul (docs/plan-cama-line-module.md).
Grundlage ist die Senior-UX/UI-Analyse aus derselben Sitzung — hier nur die Entscheidungen und die
Faktenbasis, aus der sie folgen, nicht die ganze Analyse noch einmal.

**Stand:** Plan, noch nicht umgesetzt.

---

## Faktenbasis (belegt, nichts erfunden)

Wichtig vorab, damit dieser Plan nicht mehr behauptet, als die Firma tatsächlich weiß: Es gibt **keine
schriftliche Persona-Doku** und **keine dokumentierte Firmengrößen-/Branchensegmentierung** im Repo. Was
folgt, stützt sich auf drei belegte Quellen:

1. **Drei informelle Personas** (`docs/ux-audit-vsm-builder-2026-08-12.md`, ausdrücklich "Beschreibung vom
   Nutzer, nicht aus Projektdokumenten"): Yellow Belt (hohe digitale Affinität, wenig Methodenwissen),
   Green Belt (mittlere Affinität, baut die Maps), **Master Black Belt (niedrigere Affinität, höchste
   Methodentiefe, moderiert Workshops mit einem Team im Raum)**.
2. **Tarifstruktur** (`messages/de.json`, Pricing-Namespace): FREE 1 Wertstrom · STARTER 5 · PROFESSIONAL
   50/25 Plätze · **ENTERPRISE „ohne Mengenbegrenzung, für mehrere Werke"**. Selbstbedienung bis
   Professional, Enterprise ausschließlich über Vertriebsgespräch.
3. **Datenmodell:** `organization_entitlements` ist bereits produktübergreifend angelegt
   (`AppProduct`+`Tier`, geteilt mit den Schwesterprodukten LeanPulse Industrial und LeanPulse Landing,
   `supabase/README.md`) — die Datenbank denkt strukturell schon in "mehrere Module pro Firma".

## Kernentscheidung: Progressive Disclosure statt Zwangsseite

Eine Firmenübersicht mit Modul-Kacheln löst ein Problem, das die meisten Konten (FREE: 1 Wertstrom,
STARTER: 5) noch gar nicht haben — für sie ist die heutige flache Projektliste bereits der schnellste
Weg, und genau diese Geschwindigkeit zählt bei der Person, die am Kauf und an der täglichen Nutzung am
meisten hängt (Master Black Belt, moderiert live vor einer Gruppe, laut Code-Kommentaren „im Workshop",
„Werkstatt-Notebook", 44px-Fingerziele).

**Deshalb, nutzerbestätigt (2026-09-17):**

- **Einfache Organisation** (noch kein zweites Modul in Benutzung — siehe Regel unten): `/dashboard`
  zeigt weiterhin **genau die heutige, flache Projektliste**, ohne Zwischenschritt. Kein Redirect, keine
  zusätzliche Ebene vor dem Hot Path.
- **Komplexe Organisation** (mehr als ein Modul aktiv): `/dashboard` wird zur **Firmenübersicht** mit
  einer Kachel je Modul (aktuell: VSM, Kapazitätsmanagement). Die VSM-Kachel führt zur bisherigen
  Projektliste, die dafür eine eigene Adresse bekommt (siehe Routing unten).

**Regel für "komplex" (v1, zwei Module):** Die Organisation hat mindestens eine Zeile in
`production_lines` — sprich: Kapazitätsmanagement wurde mindestens einmal benutzt. Eine reine
SQL-Zählung, keine neue Spalte/Tabelle nötig. Bei einem dritten Modul später gilt sinngemäß: mehr als
ein Modul hat je Daten getragen.

Das trifft sich mit der zweiten belegten Tatsache: Der Enterprise-Tarif ("mehrere Werke") ist genau der
Kunde, für den eine Übersicht einen echten Job erledigt — und das ist strukturell auch der Kunde, der
mit hoher Wahrscheinlichkeit mehrere Module in Benutzung hat, weil er die Firma größer/vollständiger
abbildet.

## Modul-Kacheln — Inhalt (v1: zwei Kacheln, keine Plugin-Architektur)

Bewusst kein generisches Modul-Registrierungssystem für v1 — zwei Module rechtfertigen keine Abstraktion,
die ein drittes vorwegnimmt. Eine kleine, feste Liste von Kachel-Definitionen im Dashboard-Code reicht;
ein drittes Modul fügt dort eine weitere Zeile hinzu, keine neue Architektur.

- **VSM-Kachel:** Zahl der Wertströme, Tarif-Verbrauchsbalken (bereits vorhanden, wandert hierher),
  Link auf `/projects` (neu, siehe unten).
- **Kapazitätsmanagement-Kachel:** Zahl der Linien, **wie viele davon orange/rot** (echtes
  Gesundheitssignal auf einen Blick, nicht nur eine Zahl), Link auf `/capacity` (existiert bereits,
  Schritt 3 des Linien-Moduls).
- Beide Kacheln bewusst *nicht* hinter dem Tarif versteckt — Kapazitätsmanagement ist tarifunabhängig
  nutzbar, eine leere Kachel mit "Jetzt starten" ist Aktivierungsfläche, kein Upsell-Zwang.
- Org-weite Verwaltung (Firma/Settings, Team, Admin, Abmelden) bleibt **außerhalb** der Modul-Kacheln,
  als Kopfzeile über der Übersicht wie heute — das ist keine Modul-Funktion, sondern Firmen-Verwaltung.

## Routing

- **`/projects`** (neu): die heutige Dashboard-Projektliste (Neues-Projekt-Formular, Beispiel-VSM laden,
  Fortschrittsanzeige "Ihr erster Wertstrom", Projektliste mit Löschen) — 1:1 der heutige Seiteninhalt,
  nur an eine eigene Adresse verschoben. Kein neuer Code, reine Extraktion.
- **`/dashboard`** wird zur "smarten" Einstiegsseite: einfache Organisation → rendert denselben Inhalt
  wie `/projects` direkt (kein Redirect, siehe Begründung oben) — komplexe Organisation → rendert die
  neue Kachel-Übersicht.
- **`/capacity`** unverändert (existiert bereits).
- Nichts an der Login-Weiterleitung (`/dashboard` als Ziel nach Anmeldung) ändert sich — nur der Inhalt
  hinter der immer gleichen Adresse ist jetzt vom Organisationszustand abhängig.

## Was **nicht** Teil dieses Plans ist

- Kein neues "Werk"/Plant-Konzept — die bestehende `production_lines`-Liste bildet Mehrstandort bereits
  ausreichend ab (viele Linien = mehrere Werke, ohne eigene Entität).
- Keine Plugin-/Registrierungsarchitektur für Module — zwei feste Kacheln, dritte per Handarbeit ergänzt,
  wenn es so weit ist.
- Keine Änderung an Tarifgrenzen, Preisseite oder Checkout.
- Keine Einbindung von LeanPulse Industrial als Kachel — das ist heute ein separates Produkt/Login, auch
  wenn die Datenbank (`organization_entitlements`) das strukturell vorbereitet. Eigene, spätere
  Entscheidung, kein Teil dieses Umbaus.

---

## Umsetzungsreihenfolge (bei Freigabe, Schritt für Schritt)

1. **`/projects` anlegen** — heutigen Dashboard-Seiteninhalt (Projektliste, Neues-Projekt-Formular,
   Beispiel-VSM-Knopf, Fortschrittsanzeige, Demo-Import-Banner) dorthin verschieben. `dashboard/actions.ts`
   bleibt, wird von beiden Seiten genutzt.
2. **"Komplex"-Erkennung** — kleine Server-seitige Abfrage `count(production_lines) > 0` für die aktive
   Organisation, an einer Stelle (`lib/org/`), damit sie später leicht um weitere Module erweiterbar ist.
3. **`/dashboard` umbauen** — einfache Organisation: rendert `/projects`-Inhalt direkt (gemeinsame
   Komponente/Funktion, kein Redirect). Komplexe Organisation: neue Kachel-Übersicht mit VSM- und
   Kapazitätsmanagement-Kachel, Kopfzeile (Firma/Team/Admin/Abmelden) bleibt gleich.
4. **Kachel-Inhalte verdrahten** — Wertstromzahl + Tarifbalken (VSM), Linienzahl + orange/rot-Anzahl
   (Kapazitätsmanagement), beide mit Links auf `/projects` bzw. `/capacity`.
5. **i18n** — neue Texte für die Übersicht (Kachel-Titel, Aktivierungs-Hinweistexte), de/en synchron.

Wie bei den vorherigen Plänen: jeder Schritt einzeln zur Freigabe, Reihenfolge ist bindend (Schritt 3
braucht 1+2, Schritt 4 braucht 3).
