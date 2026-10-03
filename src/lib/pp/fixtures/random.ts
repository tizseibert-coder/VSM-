// Testdaten — ein Zufallsgenerator mit Startwert (mulberry32).
//
// Gleicher Startwert, gleiche Firma: Ein Test, der an „Tag 14" scheitert, muss
// beim naechsten Lauf an denselben Daten scheitern.

export interface Random {
  next(): number
  between(min: number, max: number): number
  int(min: number, max: number): number
  normal(mean: number, sd: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    between: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    normal: (mean, sd) => {
      // Box-Muller; 1 − next() vermeidet log(0).
      const u = 1 - next()
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  }
}
