'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type VSMCanvasType from './VSMCanvas'

// react-konva touches `window`/canvas at module-eval time, so it can only
// run client-side. ssr:false is only legal inside a Client Component,
// hence this thin wrapper around the Server Component page.
const VSMCanvas = dynamic(() => import('./VSMCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center text-sm text-zinc-500">
      Canvas wird geladen…
    </div>
  ),
})

export default function VSMCanvasLoader(props: ComponentProps<typeof VSMCanvasType>) {
  return <VSMCanvas {...props} />
}
