import { revalidatePath } from 'next/cache'
import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Nimmt eine Seite in *allen* Sprachen aus dem Zwischenspeicher.
 *
 * `revalidateLocalized('/dashboard')` traf hier nichts, und das laesst sich in Next
 * nachlesen statt vermuten (server/lib/implicit-tags.js): Eine Seite
 * verschlagwortet sich mit ihrem Routenmuster (`/[locale]/dashboard/page`,
 * plus je ein `…/layout` je Segment) *und* mit ihrer echten Adresse
 * (`/de/dashboard`). `revalidatePath` baut daraus die Marke
 * `_N_T_/dashboard` — die steht in keiner der beiden Listen.
 *
 * Warum trotzdem nie jemandem etwas auffiel, steht ebenfalls im Quelltext, in
 * server/web/spec-extension/revalidate.js, mitsamt Merkzettel des
 * Next-Teams:
 *
 *     // TODO: only revalidate if the path matches
 *     store.pathWasRevalidated = ActionDidRevalidateStaticAndDynamic
 *
 * Diese Zeile laeuft unabhaengig davon, ob die Marke etwas getroffen hat, und
 * sie ist es, die den Zwischenspeicher des Browser-Routers leert. Der
 * fehlende Praefix faellt also heute nicht auf — er faellt auf, sobald Next
 * diesen Merkzettel abarbeitet. Die Dokumentation kuendigt das an: "This
 * behavior is temporary and will be updated in the future to apply only to
 * the specific path."
 *
 * Beide Sprachen, weil ein gespeicherter Wertstrom unter /de und /en dieselbe
 * Zeile ist. Ueber die echte Adresse und nicht ueber das Routenmuster: Bei
 * `/editor/<id>` naehme `/[locale]/editor/[projectId]` die Seite *jedes*
 * Projekts aus dem Zwischenspeicher, nicht nur die geaenderte.
 */
export function revalidateLocalized(href: string): void {
  for (const locale of routing.locales) {
    revalidatePath(getPathname({ href, locale }))
  }
}
