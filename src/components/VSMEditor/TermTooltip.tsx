'use client'

// Wraps a form/KPI label with a small "?" affordance that reveals a Lean/VSM
// term definition on click (works for touch and keyboard, not just mouse
// hover — a plain CSS :hover tooltip would exclude both). Click-to-toggle +
// blur-to-close, no external popover library — the definitions are short
// enough that a plain absolutely-positioned panel is all this needs.

import { useId, useState, type ReactNode } from 'react'
import { getGlossaryEntry, type GlossaryKey } from '@/lib/vsm/glossary'

export function TermTooltip({ term, children }: { term: GlossaryKey; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const entry = getGlossaryEntry(term)

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`Erklärung: ${entry.term}`}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-zinc-400 text-[9px] leading-none text-zinc-500 hover:border-blue-600 hover:text-blue-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:text-blue-500"
      >
        ?
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2 text-xs font-normal normal-case tracking-normal text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <span className="mb-0.5 block font-semibold text-zinc-900 dark:text-zinc-100">{entry.term}</span>
          {entry.definition}
        </span>
      )}
    </span>
  )
}
