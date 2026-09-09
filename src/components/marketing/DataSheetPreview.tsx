/**
 * Miniaturansicht des Erhebungsbogens fuer die Startseite.
 *
 * Bewusst kein Bildschirmfoto der echten Seite — dieselbe Begruendung wie bei
 * VsmSketch.tsx: Ein Bildschirmfoto veraltet still bei der naechsten
 * Gestaltungsaenderung an /data-sheet. Diese Nachbildung zeigt nur die
 * Spaltenkoepfe, die den Bogen inhaltlich ausmachen (dieselben Kuerzel wie in
 * DataSheet.colCycleTime usw.) — die aendern sich nur, wenn sich der Bogen
 * selbst aendert, nicht bei jedem Facelift.
 */

const COLUMNS = ['C/T', 'C/O', 'OEE', 'Bediener', 'Bestand']

export default function DataSheetPreview() {
  return (
    <div
      aria-hidden
      className="rounded-surface border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-zinc-300 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Erhebungsbogen
        </span>
        <span className="text-xs text-zinc-400">1 Blatt</span>
      </div>

      <div className="mt-3 grid grid-cols-[1.5rem_repeat(5,1fr)] gap-px overflow-hidden rounded-control border border-zinc-300 bg-zinc-300 text-[10px]">
        <div className="bg-zinc-100 px-1.5 py-1.5 font-medium text-zinc-600">Nr.</div>
        {COLUMNS.map((col) => (
          <div key={col} className="bg-zinc-100 px-1.5 py-1.5 font-medium text-zinc-600">
            {col}
          </div>
        ))}
        {[1, 2, 3].map((row) => (
          <div key={row} className="contents">
            <div className="bg-white px-1.5 py-2.5 tabular-nums text-zinc-400">{row}</div>
            {COLUMNS.map((col) => (
              <div key={`${row}-${col}`} className="bg-white px-1.5 py-2.5" />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 h-2 w-2/3 rounded-full bg-zinc-100" />
      <div className="mt-1.5 h-2 w-1/2 rounded-full bg-zinc-100" />
    </div>
  )
}
