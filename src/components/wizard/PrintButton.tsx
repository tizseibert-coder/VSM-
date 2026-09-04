'use client'

import { buttonSecondary } from '@/components/ui/buttons'

/**
 * Der Druckknopf des Erhebungsbogens.
 *
 * Die einzige Zeile Client-JavaScript auf dieser Seite. Sie koennte auch
 * fehlen — Strg+P kann jeder — aber der Bogen ist fuer jemanden gedacht, der
 * ihn zum ersten Mal sieht und gleich losgeht; ein sichtbarer Knopf sagt
 * ausserdem, dass diese Seite zum Ausdrucken da ist und nicht zum Ausfuellen
 * am Bildschirm.
 */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonSecondary}>
      {label}
    </button>
  )
}
