'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LOGO_MIME_TYPES, MAX_LOGO_BYTES, brandInitials, isLogoMime } from '@/lib/org/branding'

/**
 * Das Logofeld: auswaehlen, ansehen, entfernen.
 *
 * Client-Komponente aus zwei Gruenden, die beide mit dem Server Action zu tun
 * haben, in dessen Formular sie sitzt:
 *
 *  1. Die Absage muss vor dem Absenden kommen. Next begrenzt den Rumpf einer
 *     Server Action; eine 4-MB-Datei aus der Bildbearbeitung liefe in diese
 *     Grenze und ergaebe einen Fehler der Rahmenwerks-Ebene, den wir nicht
 *     uebersetzen und nicht erklaeren koennen. Hier steht die Grenze *vor*
 *     dem Absenden, mit einem Satz, der sagt, was zu tun ist.
 *  2. Wer ein Logo hochlaedt, will es sehen, bevor er speichert. Die Vorschau
 *     ist der einzige Ort, an dem auffaellt, dass die Datei ein Foto der
 *     Werkshalle ist und nicht das Logo.
 */
export default function LogoPicker({
  currentLogoUrl,
  displayName,
}: {
  /** Das gespeicherte Logo, oder null. */
  currentLogoUrl: string | null
  /** Fuer die Ersatzmarke, solange keins da ist. */
  displayName: string
}) {
  const t = useTranslations('Settings')
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [rejected, setRejected] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const shown = preview ?? (removing ? null : currentLogoUrl)

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-surface border border-zinc-200 bg-white">
        {/* Bewusst <img> und nicht next/image: Die Quelle ist mal eine
            `blob:`-Adresse aus der Vorschau, mal die eigene Bildroute. Mit der
            ersten kann der Optimierer nichts anfangen, und die zweite wuerde
            er durchreichen — ein 80-px-Logo macht er nicht kleiner. */}
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-lg font-semibold text-zinc-400">{brandInitials(displayName)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept={LOGO_MIME_TYPES.join(',')}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            setRejected(null)
            if (!file) {
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old)
                return null
              })
              return
            }
            if (!isLogoMime(file.type)) {
              setRejected(t('logoErrType'))
              event.currentTarget.value = ''
              setPreview(null)
              return
            }
            if (file.size > MAX_LOGO_BYTES) {
              setRejected(t('logoErrSize', { limit: Math.round(MAX_LOGO_BYTES / 1024) }))
              event.currentTarget.value = ''
              setPreview(null)
              return
            }
            setRemoving(false)
            // Die vorige Vorschau freigeben: Jede `createObjectURL` haelt das
            // Bild im Speicher, bis die Seite verlassen wird — wer sich durch
            // fuenf Logos klickt, haelt fuenf.
            setPreview((old) => {
              if (old) URL.revokeObjectURL(old)
              return URL.createObjectURL(file)
            })
          }}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-control file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-100"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {t('logoHint', { limit: Math.round(MAX_LOGO_BYTES / 1024) })}
        </p>
        {rejected && (
          <p className="mt-2 rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">{rejected}</p>
        )}

        {/* Das Entfernen faehrt als verstecktes Feld mit dem Speichern mit,
            statt als eigene Action zu laufen: Sonst waere „Logo weg" schon
            geschehen, waehrend die uebrigen Aenderungen im Formular noch
            ungespeichert danebenstehen. */}
        <input type="hidden" name="remove_logo" value={removing ? '1' : '0'} />
        {(currentLogoUrl || preview) && (
          <button
            type="button"
            onClick={() => {
              setRemoving(true)
              setPreview((old) => {
                if (old) URL.revokeObjectURL(old)
                return null
              })
              setRejected(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="mt-3 text-xs font-medium text-zinc-600 underline hover:text-red-700"
          >
            {t('logoRemove')}
          </button>
        )}
        {removing && <p className="mt-2 text-xs text-amber-700">{t('logoRemovePending')}</p>}
      </div>
    </div>
  )
}
