import Link from 'next/link'
import { buttonPrimary, buttonSecondary } from '@/components/ui/buttons'

/**
 * Zielseite fuer Fehler, die eine Server-Action nicht am Ort melden kann.
 *
 * Vorher stand hier ein Satz ohne Ausweg ("Etwas ist schiefgelaufen"). Das
 * ist die schlechteste Stelle fuer eine Sackgasse: Wer sie sieht, hat gerade
 * etwas verloren und muss selbst herausfinden, wohin jetzt. Ein Weg zurueck
 * und die Einordnung, dass die Daten nicht betroffen sind, kosten nichts und
 * nehmen die Sorge, die man an dieser Stelle tatsaechlich hat.
 */
export default function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-surface border border-zinc-200 bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          VSM Builder
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
          Die Aktion ist fehlgeschlagen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Der letzte Schritt konnte nicht abgeschlossen werden. Deine Wertströme sind davon
          nicht betroffen, gespeichert ist alles bis zur letzten erfolgreichen Änderung.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className={buttonPrimary}
          >
            Zurück zum Dashboard
          </Link>
          <Link
            href="/login"
            className={buttonSecondary}
          >
            Neu anmelden
          </Link>
        </div>
        <p className="mt-5 text-xs text-zinc-600">
          Tritt der Fehler wiederholt auf, hilft meist eine neue Anmeldung: Abgelaufene
          Sitzungen sind die häufigste Ursache.
        </p>
      </div>
    </div>
  )
}
