// Tagesplanung — Namen aus dem Schichtplan auf Kuerzel abbilden.
//
// Der Schichtplan traegt Namen, das Werkzeug fuehrt Kuerzel. Die Zuordnung
// pflegt die Organisation einmal (pp_person_aliases); danach laeuft jeder
// Import ohne Rueckfrage. Neue Namen bleiben offen, bis jemand ihnen ein
// Kuerzel gibt — der Import speichert sie nicht unter einem geratenen.
//
// Gespeichert wird nicht der Name, sondern sein Hash (SHA-256 ueber
// Organisation + normalisierten Namen) — dieselbe Idee wie bei den
// Einladungstoken. Die Datenbank kann damit einen Namen *wiedererkennen*,
// ohne ihn zu enthalten. Wer „Wer ist ABC?" fragt, fragt die Planung, nicht
// die Datenbank. Die Organisation steckt im Hash, damit derselbe Name in zwei
// Firmen nicht denselben Wert ergibt.

export function normalizeName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export async function hashName(organizationId: string, name: string): Promise<string> {
  const data = new TextEncoder().encode(`${organizationId}\u0000${normalizeName(name)}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Vorschlag fuer ein neues Kuerzel: die ersten drei Buchstaben, gross; ist es
 * vergeben, die ersten zwei plus Ziffer. Nur ein Vorschlag fuer das Feld in
 * der Oberflaeche — gespeichert wird, was die Person bestaetigt.
 */
export function suggestKuerzel(name: string, taken: ReadonlySet<string>): string {
  const letters = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
  const base = (letters || 'XXX').padEnd(3, 'X').slice(0, 3)
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 2)}${i}`
    if (!taken.has(candidate)) return candidate
  }
  return base
}

export interface MappedPeople<P extends { name: string }> {
  /** Personen mit bekanntem Kuerzel, der Name ist entfernt. */
  mapped: (Omit<P, 'name'> & { kuerzel: string })[]
  /** Namen ohne Zuordnung — die Oberflaeche fragt danach, gespeichert wird nichts. */
  unmapped: { name: string; hash: string; suggestion: string }[]
}

export async function mapPeopleToKuerzel<P extends { name: string }>(
  organizationId: string,
  people: readonly P[],
  aliases: ReadonlyMap<string, string>,
): Promise<MappedPeople<P>> {
  const taken = new Set(aliases.values())
  const mapped: MappedPeople<P>['mapped'] = []
  const unmapped: MappedPeople<P>['unmapped'] = []
  for (const person of people) {
    const hash = await hashName(organizationId, person.name)
    const kuerzel = aliases.get(hash)
    if (kuerzel) {
      const { name: _name, ...rest } = person
      void _name
      mapped.push({ ...rest, kuerzel })
    } else {
      const suggestion = suggestKuerzel(person.name, taken)
      taken.add(suggestion)
      unmapped.push({ name: person.name, hash, suggestion })
    }
  }
  return { mapped, unmapped }
}
