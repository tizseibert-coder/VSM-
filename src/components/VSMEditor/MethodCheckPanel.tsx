import type { ReactNode } from 'react'

/**
 * Ein Methodikbefund am aktuellen Wertstrom.
 *
 * `severity` ist die Rangfolge, nicht nur die Farbe: `critical` heisst, dass
 * eine angezeigte Kennzahl dadurch ihre Aussagekraft verliert; `warning`
 * heisst, dass die Darstellung methodisch unsauber ist, die Zahlen aber
 * stimmen.
 */
export type MethodFinding = {
  id: string
  severity: 'critical' | 'warning'
  /** Eine Zeile, die im zugeklappten Zustand allein tragen muss. */
  title: ReactNode
  /** Die Begruendung. Wird erst beim Aufklappen gelesen. */
  detail: ReactNode
}

const SEVERITY_ORDER: Record<MethodFinding['severity'], number> = {
  critical: 0,
  warning: 1,
}

const SEVERITY_DOT: Record<MethodFinding['severity'], string> = {
  critical: 'bg-red-600',
  warning: 'bg-amber-500',
}

const SEVERITY_LABEL: Record<MethodFinding['severity'], string> = {
  critical: 'Kennzahl betroffen',
  warning: 'Methodisch unsauber',
}

function countLabel(n: number): string {
  return n === 1 ? '1 Hinweis' : `${n} Hinweise`
}

/**
 * Fasst die Methodikbefunde zu einer Leiste zusammen.
 *
 * Vorher stand jeder Befund als eigenes, gleich grosses Banner ueber der
 * Werkzeugleiste — bis zu drei uebereinander, unterschieden nur durch
 * Bernstein oder Rot. Das ist undifferenzierter Alarm: Es war nicht
 * erkennbar, was zuerst zaehlt, und bei drei Bannern verschob sich die
 * Zeichenflaeche merklich nach unten.
 *
 * Jetzt eine Zeile mit Anzahl und Rangfolge, aufklappbar. `<details>` statt
 * eigenem Zustand: kein Client-JavaScript, funktioniert ohne Hydration und
 * ist ueber die Tastatur bedienbar, ohne dass wir etwas dafuer tun.
 */
export function MethodCheckPanel({ findings }: { findings: MethodFinding[] }) {
  if (findings.length === 0) return null

  const ranked = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )
  const criticalCount = ranked.filter((f) => f.severity === 'critical').length

  return (
    <details className="group mt-3 rounded-surface border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-control ${
            criticalCount > 0 ? SEVERITY_DOT.critical : SEVERITY_DOT.warning
          }`}
        />
        <span className="font-medium text-zinc-950">Methodikprüfung</span>
        <span className="text-zinc-600">{countLabel(ranked.length)}</span>
        <span className="ml-auto text-xs text-zinc-600 group-open:hidden">Anzeigen</span>
        <span className="ml-auto hidden text-xs text-zinc-600 group-open:inline">Zuklappen</span>
      </summary>
      <ol className="border-t border-zinc-200">
        {ranked.map((finding) => (
          <li
            key={finding.id}
            className="flex gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0"
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-control ${SEVERITY_DOT[finding.severity]}`}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                {SEVERITY_LABEL[finding.severity]}
              </p>
              <p className="mt-0.5 text-sm font-medium text-zinc-950">{finding.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{finding.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
