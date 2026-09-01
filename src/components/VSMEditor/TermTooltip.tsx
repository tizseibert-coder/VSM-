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
      {/* Visible badge stays a compact 16px circle (fits inline in running
          text/labels); the actual tap/click target is widened to ~44px via
          an absolutely-positioned ::before that extends past the visible
          box without pushing layout — same problem/fix shape as LeanPulse
          Industrial's info-tag.tsx touch-target fix (UX-Audit Phase 7a,
          finding #1: this button measured 14x14px). */}
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`Erklärung: ${entry.term}`}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-control border border-zinc-400 text-xs leading-none text-zinc-500 before:absolute before:inset-[-15px] before:content-[''] hover:border-brand-600 hover:text-brand-600"
      >
        ?
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-56 rounded-control border border-zinc-200 bg-white p-2 text-xs font-normal normal-case tracking-normal text-zinc-700 shadow-lg"
        >
          <span className="mb-0.5 block font-semibold text-zinc-900">{entry.term}</span>
          {entry.definition}
        </span>
      )}
    </span>
  )
}
