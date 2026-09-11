import { expect, type Page } from '@playwright/test'

/**
 * Ragt auf einer Seite irgendetwas ueber den rechten Rand hinaus?
 *
 * Das ist die eine Frage, die beide Layout-Fehler dieser Anwendung mit einer
 * Zahl beantwortet haette: Der Dashboard-Kopf lief bei 390 px um 12 px aus
 * dem Bild, der bestaetigungsbereite Loeschen-Knopf bei 320 px um 76 px.
 * Beide fielen erst an einem echten Telefon auf.
 *
 * Bewusst keine Bildvergleiche: Die wuerden bei jeder Textaenderung
 * ausschlagen und waeren nach dem dritten Fehlalarm abgeschaltet. Diese
 * Zusicherung schlaegt nur an, wenn wirklich etwas nicht passt.
 */
async function findOverflowingElements(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth

    /**
     * Steckt das Element in einem Rahmen, der selbst waagerecht scrollt?
     *
     * Eine breite Tabelle in einem `overflow-x-auto` ist kein Fehler, sondern
     * die vorgesehene Loesung: Der Bogen und die Preistabelle nutzen sie
     * ausdruecklich. Hinausragen tut dann der Inhalt *im Rahmen*, nicht die
     * Seite — und der Nutzer kann ihn schieben.
     */
    const scrollsInsideAnAncestor = (el: HTMLElement): boolean => {
      let parent = el.parentElement
      while (parent && parent !== document.body) {
        const overflowX = getComputedStyle(parent).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') return true
        parent = parent.parentElement
      }
      return false
    }

    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        // Unsichtbares zaehlt nicht: Ein zugeklapptes Panel oder ein Element
        // ohne Flaeche kann niemanden stoeren, auch wenn es rechnerisch
        // hinausragt.
        if (rect.width === 0 || rect.height === 0) return false
        if (getComputedStyle(el).visibility === 'hidden') return false
        if (rect.right <= viewportWidth + 1) return false
        return !scrollsInsideAnAncestor(el)
      })
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const label = el.className?.toString().slice(0, 60) ?? ''
        return `${el.tagName.toLowerCase()}.${label} ragt bis ${Math.round(rect.right)}px`
      })
  })
}

/**
 * Die Zusicherung selbst, damit oeffentliche und angemeldete Seiten
 * buchstaeblich dieselbe pruefen. Vorher stand der Detektor nur in
 * overflow.spec.ts; ihn zu kopieren hiesse, zwei Fassungen zu pflegen, von
 * denen eine irgendwann nachlaesst.
 */
export async function erwarteKeinenUeberlauf(page: Page, pfad: string) {
  const scrollOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  const offenders = await findOverflowingElements(page)

  expect(offenders, `Herausragende Elemente auf ${pfad}`).toEqual([])
  expect(scrollOverflow, `Waagerechter Ueberlauf auf ${pfad}`).toBeLessThanOrEqual(1)
}
