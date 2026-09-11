'use client'

import { buttonSecondary } from '@/components/ui/buttons'
import { buildCsvTemplate, CSV_TEMPLATE_FILENAME } from '@/lib/vsm/csvTemplate'

/**
 * Laedt den Erhebungsbogen als Datei herunter.
 *
 * Client-seitig und ohne Route: Der Inhalt haengt an nichts, was der Server
 * wuesste — buildCsvTemplate() liefert fuer jeden dieselbe Zeichenkette. Eine
 * Route dafuer waere ein Netzweg fuer eine Konstante.
 *
 * `text/csv;charset=utf-8` zusammen mit der BOM aus csvTemplate.ts: Erst
 * beides zusammen bringt Excel dazu, Umlaute richtig zu lesen.
 */
export default function CsvTemplateButton({ label }: { label: string }) {
  function download() {
    const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = CSV_TEMPLATE_FILENAME
    link.click()
    // Ohne das Freigeben bleibt der Blob bis zum Verlassen der Seite im
    // Speicher — bei einer Datei dieser Groesse belanglos, aber es ist die
    // Haelfte des Aufrufs und gehoert dazu.
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" onClick={download} className={buttonSecondary}>
      {label}
    </button>
  )
}
