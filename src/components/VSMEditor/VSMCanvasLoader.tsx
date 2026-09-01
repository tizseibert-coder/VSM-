'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type VSMCanvasType from './VSMCanvas'

/**
 * Platzhalter waehrend react-konva nachgeladen wird.
 *
 * Vorher stand hier eine Textzeile in einem 500 px hohen Kasten. Zwei
 * Probleme: Die Hoehe passte nicht zu der, die der Canvas danach einnimmt,
 * also sprang die Seite beim Erscheinen; und eine blosse Textzeile sagt
 * nicht, was gleich kommt. Das Skelett nimmt ungefaehr die spaetere Hoehe
 * ein und deutet die Form an, die folgt: Prozesskette und Zeitleiter.
 */
function CanvasSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="rounded-surface border border-zinc-200 bg-white p-6">
        <div className="animate-pulse" aria-hidden>
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-1 items-center gap-3">
                <div className="h-16 flex-1 rounded-control bg-zinc-100" />
                {i < 4 && <div className="h-px w-6 shrink-0 bg-zinc-200" />}
              </div>
            ))}
          </div>
          <div className="mt-10 h-8 rounded-control bg-zinc-100" />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600" role="status">
          Diagramm wird geladen…
        </p>
      </div>
    </div>
  )
}

// react-konva touches `window`/canvas at module-eval time, so it can only
// run client-side. ssr:false is only legal inside a Client Component,
// hence this thin wrapper around the Server Component page.
const VSMCanvas = dynamic(() => import('./VSMCanvas'), {
  ssr: false,
  loading: () => <CanvasSkeleton />,
})

export default function VSMCanvasLoader(props: ComponentProps<typeof VSMCanvasType>) {
  return <VSMCanvas {...props} />
}
