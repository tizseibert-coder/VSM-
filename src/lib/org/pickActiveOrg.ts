// Waehlt die aktive Organisation eines Nutzers aus seinen Mitgliedschaften.
//
// Warum es das braucht: bis 31.08.2026 las die App die Mitgliedschaft mit
// `.maybeSingle()`. Das wirft, sobald *zwei* Zeilen zurueckkommen — der Fehler
// wurde verschluckt, `membership` blieb null, und der Nutzer sah "Keine
// Organisation gefunden". Wer in zwei Organisationen ist, fuer den war der VSM
// Builder damit tot. Ueber `POST /onboarding/join` auf der MES-Seite laesst
// sich dieser Zustand heute schon herstellen, und mit Einladungen wird er zum
// Normalfall.
//
// Bewusst rein: die Auswahlregel ist die Stelle, an der man sich irren kann
// (abgelaufene Cookies, entzogene Mitgliedschaften, wechselnde Sortierung aus
// der Datenbank). Cookie-Zugriff und Datenbank liegen in activeOrg.ts.

export interface Membership {
  organizationId: string
  organizationName: string
  role: string
}

/**
 * @param memberships alle Organisationen, in denen der Nutzer Mitglied ist
 * @param preferredId zuletzt gewaehlte Organisation (aus dem Cookie), falls vorhanden
 */
export function pickActiveOrg(
  memberships: Membership[],
  preferredId: string | null
): Membership | null {
  if (memberships.length === 0) return null

  // Der Wunsch zaehlt nur, wenn die Mitgliedschaft noch besteht. Ein Cookie,
  // das eine entzogene Mitgliedschaft ueberlebt hat, darf weder Zugriff geben
  // noch den Nutzer auf einer Fehlerseite stranden lassen — er faellt still
  // auf die Standardauswahl zurueck. (Die eigentliche Absicherung ist ohnehin
  // RLS; das hier ist die Benutzerfuehrung davor.)
  if (preferredId) {
    const preferred = memberships.find((m) => m.organizationId === preferredId)
    if (preferred) return preferred
  }

  // Ohne gueltigen Wunsch muss die Wahl *stabil* sein: dieselbe Person soll bei
  // jedem Seitenaufruf in derselben Organisation landen. Die Reihenfolge aus
  // der Datenbank ist ohne ORDER BY nicht garantiert, deshalb wird hier
  // sortiert statt einfach [0] genommen. Kopie, um die Eingabe nicht zu
  // veraendern.
  return [...memberships].sort(
    (a, b) =>
      a.organizationName.localeCompare(b.organizationName, 'de', { sensitivity: 'base' }) ||
      a.organizationId.localeCompare(b.organizationId)
  )[0]
}
