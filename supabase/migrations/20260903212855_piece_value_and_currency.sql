-- Gebundenes Kapital: der Wert eines Stuecks und die Waehrung, in der
-- gerechnet wird (2026-09-03).
--
-- Aus der Bedienbarkeitspruefung vom selben Tag: Das Werkzeug zeigt 9 300
-- Stueck Bestand — eine Stueckzahl. Fuer den Menschen, der ueber die
-- Investition entscheidet, wird daraus erst dann eine Aussage, wenn daneben
-- steht, wie viel Geld darin liegt. Die Rechnung ist eine Multiplikation; es
-- fehlte nur der Faktor.
--
-- Auf `projects` und nicht auf `scenarios`: Der Wert eines Stuecks gehoert zum
-- Erzeugnis und aendert sich nicht dadurch, dass man den Wertstrom anders
-- organisiert. Genau deshalb traegt der Vergleich zweier Szenarien ueberhaupt
-- etwas aus — dieselbe Bewertung, unterschiedlicher Bestand. Nullable wie
-- annual_throughput: "nicht hinterlegt" ist ein echter Zustand und nicht
-- dasselbe wie "null Euro".
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS piece_value numeric;

-- Die Waehrung stand bisher ausschliesslich im Spaltennamen
-- `scenarios.investment_chf` und fest im Quelltext (`CHF`, `de-CH`) — waehrend
-- die Startseite mit "85.000 €" wirbt. Fuer ein Werkzeug, das in Deutschland
-- verkauft wird, war der Franken der falsche Vorgabewert.
--
-- Die Spalte investment_chf behaelt ihren Namen: Umbenennen waere eine
-- Migration, die nichts kann, was diese hier nicht kann, und jede Zeile
-- Anwendungscode dazu zwingen, beide Namen zu kennen. Ihre *Anzeige* richtet
-- sich ab jetzt nach diesem Feld.
--
-- Bewusst ohne CHECK-Einschraenkung: Welche Waehrungen die Oberflaeche
-- anbietet, entscheidet die Oberflaeche (dieselbe Linie wie beim
-- Schrittmacher, siehe updateProcess in actions.ts). Eine Einschraenkung hier
-- wuerde jede weitere Waehrung zu einer Migration machen.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';
