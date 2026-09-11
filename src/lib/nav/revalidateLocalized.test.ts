import { beforeEach, describe, expect, it, vi } from 'vitest'

// next/cache laeuft nur im Server-Kontext von Next. Hier zaehlt ohnehin nur,
// *womit* revalidatePath gerufen wird — genau daran ist die alte Fassung
// gescheitert.
// next-intl zieht ueber @/i18n/navigation das echte next/navigation nach,
// das ausserhalb von Next nicht aufloesbar ist. Eine Attrappe genuegt: Von
// diesem Modul wird hier nur getPathname benutzt, und das ist reine Rechnung.
// Bewusst nicht @/i18n/navigation selbst nachgebaut — dann prueefte dieser
// Test die Attrappe statt der Praefixbildung, um die es geht.
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('nicht erwartet')
  },
  permanentRedirect: () => {
    throw new Error('nicht erwartet')
  },
  useRouter: () => {
    throw new Error('nicht erwartet')
  },
  usePathname: () => {
    throw new Error('nicht erwartet')
  },
}))

const gerufen: Array<string> = []
vi.mock('next/cache', () => ({
  revalidatePath: (pfad: string) => {
    gerufen.push(pfad)
  },
}))

const { revalidateLocalized } = await import('./revalidateLocalized')

describe('revalidateLocalized', () => {
  beforeEach(() => {
    gerufen.length = 0
  })

  it('nimmt die Seite in jeder Sprache aus dem Zwischenspeicher', () => {
    revalidateLocalized('/dashboard')
    expect(gerufen).toEqual(['/de/dashboard', '/en/dashboard'])
  })

  it('setzt den Praefix auch vor eine Adresse mit Kennung', () => {
    // Der haeufigste Fall: 31 der Aufrufe im Editor sehen so aus. Ohne
    // Praefix trifft die Marke weder das Routenmuster
    // (/[locale]/editor/[projectId]/page) noch die echte Adresse.
    revalidateLocalized('/editor/abc-123')
    expect(gerufen).toEqual(['/de/editor/abc-123', '/en/editor/abc-123'])
  })

  it('haengt den Praefix nicht an eine tiefere Ebene an', () => {
    revalidateLocalized('/editor/abc-123/future-state')
    expect(gerufen).toEqual([
      '/de/editor/abc-123/future-state',
      '/en/editor/abc-123/future-state',
    ])
  })
})
