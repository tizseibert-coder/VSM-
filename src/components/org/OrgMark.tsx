import { brandInitials } from '@/lib/org/branding'

/**
 * Das Firmenzeichen in der Kopfleiste: Logo, sonst die Initialen.
 *
 * Bewusst nie ein leerer Platz. Ein Kasten, der erst erscheint, sobald jemand
 * ein Bild hochlaedt, verschiebt beim Erscheinen die ganze Zeile — und ein
 * Haus ohne Logo soll trotzdem seinen Namen oben stehen sehen, sonst wirkt
 * die Anwendung wie eine fremde.
 */
export default function OrgMark({
  logoUrl,
  name,
  size = 'md',
}: {
  logoUrl: string | null
  name: string
  /** `sm` fuer Listenzeilen, `md` fuer Kopfleisten, `lg` fuer die Einladungsseite. */
  size?: 'sm' | 'md' | 'lg'
}) {
  const box =
    size === 'sm' ? 'h-8 w-8 text-[0.7rem]' : size === 'lg' ? 'h-16 w-16 text-xl' : 'h-11 w-11 text-sm'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-zinc-200 bg-white ${box}`}
    >
      {/* Bewusst <img> und nicht next/image: Die Quelle ist entweder die
          eigene Bildroute (die schon das richtige Mass liefert) oder eine
          eingebettete `data:`-Adresse auf der Einladungsseite — mit der
          zweiten kann der Optimierer nichts anfangen. */}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="font-semibold text-zinc-400" aria-hidden>
          {brandInitials(name)}
        </span>
      )}
    </span>
  )
}
