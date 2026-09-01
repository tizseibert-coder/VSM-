import type { Metadata } from 'next'
import Link from 'next/link'
import DemoCanvas from '@/components/VSMEditor/DemoCanvas'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'

export const metadata: Metadata = {
  title: 'Demo',
  description:
    'Ein vollständiger Wertstrom zum Ausprobieren, ohne Anmeldung. Zykluszeiten ändern und zusehen, wie Durchlaufzeit, Taktzeit und Wertschöpfungsanteil reagieren.',
}

/**
 * Die Demo ohne Anmeldung.
 *
 * Der staerkste Verkaufshebel lag bisher hinter der Registrierung: Ein Black
 * Belt gibt seine Firmenadresse nicht heraus, um herauszufinden, ob ein
 * Werkzeug seine Symbolik beherrscht. Hier ist alles bedienbar, nichts wird
 * gespeichert, und es gibt keinen Datenbankzugriff — also auch nichts, was
 * jemand missbrauchen koennte.
 */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-widest text-brand-600 hover:underline"
            >
              VSM Builder
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
              Demo · Dreherei Musterwerk
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/login" className={buttonSecondary}>
              Anmelden
            </Link>
            <Link href="/signup" className={buttonPrimary}>
              Kostenlos starten
            </Link>
          </div>
        </div>
      </header>

      {/* Der Hinweis steht oben und nicht als Fusszeile: Wer gleich Zahlen
          aendert, soll vorher wissen, dass sie nicht bleiben. */}
      <div className="border-b border-zinc-200 bg-brand-50">
        <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-zinc-700">
          <span className="font-medium text-zinc-950">Alles ist bedienbar.</span> Ändere eine
          Zykluszeit, verschiebe einen Prozess, setze einen Bestand — die Kennzahlen rechnen
          live mit. Nichts davon wird gespeichert; ein Neuladen setzt die Demo zurück.
        </p>
      </div>

      <DemoCanvas />
    </div>
  )
}
