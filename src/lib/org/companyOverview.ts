// Die "komplex genug für eine Firmenübersicht"-Regel, siehe
// docs/plan-company-overview-modules.md: Eine einfache Organisation
// (noch kein zweites Modul in Benutzung) sieht unter /dashboard weiterhin
// direkt die VSM-Projektliste — genau der Hot Path, den die Person mit der
// niedrigsten digitalen Affinität und dem größten Zeitdruck (Master Black
// Belt, moderiert live) am meisten braucht. Erst eine komplexe Organisation
// bekommt die Kachel-Übersicht.
//
// v1 hat genau zwei Module (VSM, Kapazitätsmanagement). VSM ist praktisch
// immer aktiv (jede Organisation landet über den Assistenten/die Demo fast
// sofort bei einem Projekt), Kapazitätsmanagement dagegen nicht — deshalb
// reduziert sich "mehr als ein Modul in Benutzung" für v1 auf eine einzige
// Frage: Wurde Kapazitätsmanagement schon mindestens einmal benutzt? Ein
// drittes Modul verlängert diese Funktion um eine weitere Zählung, ersetzt
// aber nicht ihre Form — deshalb keine generische Modul-Registrierung dafür,
// siehe Plan, Abschnitt "Was nicht Teil dieses Plans ist".

import { createClient } from '@/lib/supabase/server'

export async function hasMultipleModulesInUse(organizationId: string): Promise<boolean> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('production_lines')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  return (count ?? 0) > 0
}
