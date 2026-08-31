import Link from 'next/link'
import VsmSketch from '@/components/marketing/VsmSketch'

/**
 * Die Startseite beantwortet die Fragen, die ein Lean-Praktiker in den ersten
 * Sekunden stellt — und zwar mit dem, was tatsächlich gebaut ist: Formeln,
 * Methodikprüfungen und Spaltennamen sind aus dem Produkt übernommen, nicht
 * erfunden. Wer das hier liest und danach das Werkzeug öffnet, findet exakt
 * diese Begriffe wieder.
 *
 * Nicht beantwortet, weil die Antwort nicht im Code steht: wo die Werksdaten
 * liegen. Für den deutschen Industriekunden ist das regelmäßig die Frage, an
 * der eine Beschaffung scheitert. Sie braucht belastbare Angaben zu Standort,
 * Unterauftragsverarbeitern und AVV, bevor hier ein Satz dazu stehen darf.
 */

const KPIS = [
  {
    name: 'Durchlaufzeit',
    formula: 'WIP ÷ Ausbringung',
    note: 'Little’s Law über alle Bestände der Kette.',
  },
  {
    name: 'Taktzeit',
    formula: 'Verfügbare Min/Tag ÷ Kundenbedarf',
    note: 'Aus Jahresbedarf und Schichtmodell, nicht geschätzt.',
  },
  {
    name: 'Wertschöpfungsanteil',
    formula: 'Bearbeitungszeit ÷ Durchlaufzeit',
    note: 'Die Zahl, die im Lenkungsgremium die Diskussion auslöst.',
  },
  {
    name: 'Ist-Ausbringung',
    formula: 'Verfügbare Min/Tag ÷ Engpass',
    note: 'Effektive Zykluszeit inklusive OEE, nicht die nominale.',
  },
]

const CHECKS = [
  {
    severity: 'critical' as const,
    label: 'Kennzahl betroffen',
    title: 'Kapazitätsunterdeckung',
    body: 'Deckt die Linie den Kundenbedarf nicht, wächst der Bestand unbegrenzt. Dann gilt Little’s Law nicht mehr, und das Werkzeug sagt genau das, statt eine Durchlaufzeit zu behaupten.',
  },
  {
    severity: 'warning' as const,
    label: 'Methodisch unsauber',
    title: 'Push vor dem Schrittmacher',
    body: 'Alles vor dem Schrittmacher braucht ein Pull-System. Läuft eine Verbindung noch als Push, wird sie benannt und gezählt.',
  },
  {
    severity: 'warning' as const,
    label: 'Methodisch unsauber',
    title: 'Kein Schrittmacher gesetzt',
    body: 'Ohne Schrittmacher steuert das ERP jeden Prozess einzeln. Das Diagramm zeigt es so, und der Hinweis erklärt, warum das selten gewollt ist.',
  },
]

const WORKSHOP: [string, string][] = [
  [
    'Präsentationsmodus',
    'Blendet Import und Umbenennung aus. Prozessboxen bleiben editierbar, weil ein Wertstrom im Raum mit dem Team entsteht und nicht vorher fertig ist.',
  ],
  [
    'Vollbild',
    'Ein Bewegungsraum statt drei. Für den Beamer im Besprechungsraum und das Notebook auf dem Shopfloor.',
  ],
  ['PDF-Export', 'Diagramm und Kennzahlen auf A4 quer. Das Blatt, das mit ins Gremium geht.'],
  [
    '24 Fachbegriffe im Kontext',
    'Schrittmacher, Supermarkt, FIFO, Heijunka, EPEI. Erklärt an der Stelle, an der sie auftauchen, damit Green Belts und Werker mitkommen.',
  ],
]

const COMPARISON: [string, string, string][] = [
  ['Durchlaufzeit', '18,4 Tage', '9,1 Tage'],
  ['Wertschöpfungsanteil', '0,41 %', '0,83 %'],
  ['Investition', '–', '85.000 €'],
  ['Amortisation', '–', '14 Monate'],
  ['Risiko', '–', 'Mittel'],
]

export default function Home() {
  return (
    <main className="bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-widest text-brand-600">
            VSM Builder
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-control px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Anmelden
            </Link>
            <Link
              href="/signup"
              className="rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
              Wertstromanalyse, die rechnet.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-700">
              Symbolik nach Rother und Shook, Durchlaufzeit und Taktzeit live aus den
              Prozessdaten, Future-State-Szenarien mit Amortisation. Kein Zeichenprogramm mit
              VSM-Formen, sondern ein Rechenwerkzeug, das nebenbei ein normgerechtes Diagramm
              zeichnet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-control bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700"
              >
                Kostenlos starten
              </Link>
              <Link
                href="/login"
                className="rounded-control border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Anmelden
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-600">
              Nach der Anmeldung liegt ein vollständiges Beispiel-VSM bereit: fünf Prozesse,
              Bestände, gerechnete Kennzahlen. Ein Klick, keine Dateneingabe.
            </p>
          </div>

          {/* Das charakteristischste Bild des Fachs steht am Anfang, statt es
              zu beschreiben. */}
          <div className="rounded-surface border border-zinc-200 p-4 sm:p-6">
            <VsmSketch />
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Ausschnitt eines Ist-Zustands: Prozessboxen mit C/T und OEE, Bestände als Dreieck,
              darunter die Zeitleiter aus Warte- und Bearbeitungszeit.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Jede Zahl zeigt ihren Rechenweg
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-700">
            Unter jeder Kennzahl steht die Formel mit den Werten, die tatsächlich eingesetzt
            wurden. Eine überraschende Zahl erklärt sich damit aus ihren eigenen Eingaben, statt
            wie ein Fehler auszusehen.
          </p>

          <dl className="mt-8 border-y border-zinc-200">
            {KPIS.map((kpi) => (
              <div
                key={kpi.name}
                className="grid gap-1 border-b border-zinc-200 py-4 last:border-b-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,17rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
              >
                <dt className="font-medium text-zinc-950">{kpi.name}</dt>
                <dd className="font-mono text-sm text-brand-700">{kpi.formula}</dd>
                <dd className="text-sm text-zinc-600">{kpi.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Das Werkzeug widerspricht
            </h2>
            <p className="mt-3 text-zinc-700">
              Ein Wertstrom kann methodisch falsch sein und trotzdem gut aussehen. Die
              Methodikprüfung läuft bei jeder Änderung mit und ordnet nach Schwere: zuerst das,
              was eine Kennzahl entwertet, danach das, was nur die Darstellung betrifft.
            </p>
          </div>
          <ul className="space-y-px overflow-hidden rounded-surface border border-zinc-200 bg-zinc-200">
            {CHECKS.map((check) => (
              <li key={check.title} className="flex gap-3 bg-white px-5 py-4">
                <span
                  aria-hidden
                  className={`mt-2 h-2 w-2 shrink-0 rounded-control ${
                    check.severity === 'critical' ? 'bg-red-600' : 'bg-amber-500'
                  }`}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                    {check.label}
                  </p>
                  <p className="mt-0.5 font-medium text-zinc-950">{check.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{check.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Vom Ist-Zustand zum Business Case
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-700">
            Jedes Future-State-Szenario ist eine eigene Kopie des Wertstroms. Der Vergleich
            stellt sie nebeneinander und übersetzt die Lean-Kennzahlen in die Sprache, in der
            über Budgets entschieden wird.
          </p>

          <div className="mt-8 overflow-x-auto rounded-surface border border-zinc-200 bg-white">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="px-5 py-3 text-left font-medium text-zinc-600">Kennzahl</th>
                  <th className="px-5 py-3 text-left font-medium text-zinc-950">Ist-Zustand</th>
                  <th className="px-5 py-3 text-left font-medium text-zinc-950">Szenario A</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {COMPARISON.map(([label, ist, soll]) => (
                  <tr key={label} className="border-b border-zinc-100 last:border-0">
                    <td className="px-5 py-3 text-zinc-600">{label}</td>
                    <td className="px-5 py-3 text-zinc-950">{ist}</td>
                    <td className="px-5 py-3 font-medium text-zinc-950">{soll}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Beispielwerte zur Veranschaulichung der Spalten.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Gebaut für den Raum, in dem der Wertstrom entsteht
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-700">
          Ein VSM wird nicht am Schreibtisch ausgefüllt, sondern vor der Gruppe erarbeitet.
          Danach muss es auf ein Blatt passen, das jemand anders liest.
        </p>
        <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {WORKSHOP.map(([name, body]) => (
            <div key={name}>
              <dt className="font-medium text-zinc-950">{name}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-zinc-600">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-14">
          <div>
            <p className="text-xl font-semibold tracking-tight text-zinc-950">
              Mit dem Beispiel-VSM anfangen
            </p>
            <p className="mt-2 max-w-lg text-zinc-700">
              Eine vollständige Dreherei mit fünf Prozessen und Beständen. Anlegen, einen Wert
              ändern, zusehen, wie die Durchlaufzeit reagiert.
            </p>
          </div>
          <Link
            href="/signup"
            className="rounded-control bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            Kostenlos starten
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-3 gap-y-1 px-6 py-8 text-sm text-zinc-600">
          <span className="font-semibold uppercase tracking-widest text-brand-600">
            VSM Builder
          </span>
          <span>Wertstromanalyse mit Live-Berechnung.</span>
        </div>
      </footer>
    </main>
  )
}
