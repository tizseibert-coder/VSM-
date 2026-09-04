'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_ORG_COOKIE, getActiveOrg, loadMemberships } from '@/lib/org/activeOrg'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Las die Mitgliedschaft frueher mit `.maybeSingle()` — das wirft, sobald
// jemand in zwei Organisationen ist, der Fehler wurde verschluckt und der
// Nutzer sah "Keine Organisation gefunden". Die Auswahl liegt jetzt in
// lib/org/activeOrg.ts; hier bleibt nur die Anmelde-Weiche.
async function currentUserOrgId(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')

  const result = await getActiveOrg()
  if ('error' in result) return result
  return { orgId: result.active.organizationId }
}

// Wechselt die aktive Organisation. Nur Benutzerfuehrung — RLS gaebe fremde
// Daten ohnehin nicht heraus. Die Mitgliedschaft wird trotzdem geprueft: eine
// leere Projektliste ohne Erklaerung waere die schlechtere Antwort auf einen
// manipulierten Cookie als eine klare Fehlermeldung.
export async function switchOrg(orgId: string) {
  const memberships = await loadMemberships()
  if (!memberships.some((m) => m.organizationId === orgId)) {
    redirect('/dashboard?error=' + encodeURIComponent('Kein Zugriff auf diese Organisation.'))
  }

  const store = await cookies()
  store.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function createProject(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('projectNameEmpty')))
  }

  const orgResult = await currentUserOrgId()
  if ('error' in orgResult) {
    redirect('/dashboard?error=' + encodeURIComponent(orgResult.error))
  }

  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ organization_id: orgResult.orgId, name })
    .select('id')
    .single()

  if (error || !project) {
    // UX-Audit Phase 7a finding #4: this used to interpolate the raw
    // Supabase/Postgres error message straight into the user-facing
    // banner — meaningless to a non-technical user mid-workshop. Logged
    // server-side for debugging, generic German text shown to the user.
    if (error) console.error('createProject failed:', error.message)
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('projectCreate')))
  }

  redirect(`/editor/${project.id}`)
}

// Seeds a small, realistic example VSM (4 processes + 3 buffers) so a new
// user sees a finished-looking result immediately instead of a blank canvas.
export async function createExampleProject() {
  const orgResult = await currentUserOrgId()
  if ('error' in orgResult) {
    redirect('/dashboard?error=' + encodeURIComponent(orgResult.error))
  }

  const supabase = await createClient()

  // [Bedienbarkeitspruefung 2026-09-03, B17] Name und Stationen standen hier
  // fest auf Deutsch. Wer sich in der englischen Fassung anmeldet und auf
  // "Beispielprojekt anlegen" drueckt, bekam ein Projekt namens "Beispiel:
  // Wertstromanalyse Dreherei" mit den Stationen Saegen, Drehen, Fraesen,
  // Montage — dieselbe halbe Uebersetzung wie in der Demo, nur diesmal als
  // Datensatz in seiner Datenbank. Die Zahlen bleiben in beiden Sprachen
  // gleich; nur die Woerter folgen der Sprache, in der er anlegt.
  const tEx = await getTranslations('Example')

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      organization_id: orgResult.orgId,
      name: tEx('projectName'),
      description: tEx('description'),
      annual_throughput: 50000,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    if (projectError) console.error('createExampleProject (project) failed:', projectError.message)
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('exampleCreate')))
  }

  const exampleProcesses = [
    { name: tEx('process1'), cycle_time: 1.2, oee: 82, wip: 0 },
    { name: tEx('process2'), cycle_time: 3.4, oee: 78, wip: 0 },
    { name: tEx('process3'), cycle_time: 2.6, oee: 85, wip: 0 },
    { name: tEx('process4'), cycle_time: 4.1, oee: 90, wip: 0 },
  ]

  // Note: no .order() here — PostgREST rejects ordering an insert's
  // RETURNING by a column outside the .select() list. Multi-row INSERT
  // preserves input order in practice, which is all we need to pair
  // consecutive processes with a buffer below.
  const { data: insertedProcesses, error: processesError } = await supabase
    .from('processes')
    .insert(exampleProcesses.map((p) => ({ ...p, project_id: project.id })))
    .select('id')

  if (processesError) {
    console.error('createExampleProject (processes) failed:', processesError.message)
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('exampleProcesses')))
  }

  if (insertedProcesses && insertedProcesses.length > 0) {
    const bufferWip = [800, 400, 600]
    // Boundary edges (supplier -> first process, last process -> customer)
    // are just as required as the internal ones — without them the canvas
    // renders no shipment arrow at either end of the chain.
    const bufferRows = [
      { project_id: project.id, from_process_id: null as string | null, to_process_id: insertedProcesses[0].id, wip_count: 0 },
      ...insertedProcesses.slice(0, -1).map((p, i) => ({
        project_id: project.id,
        from_process_id: p.id as string | null,
        to_process_id: insertedProcesses[i + 1].id as string | null,
        wip_count: bufferWip[i] ?? 300,
      })),
      {
        project_id: project.id,
        from_process_id: insertedProcesses[insertedProcesses.length - 1].id as string | null,
        to_process_id: null as string | null,
        wip_count: 0,
      },
    ]
    const { error: bufferError } = await supabase.from('inventory_buffers').insert(bufferRows)
    if (bufferError) {
      console.error('createExampleProject (buffers) failed:', bufferError.message)
      redirect('/dashboard?error=' + encodeURIComponent(await tErr('exampleBuffers')))
    }
  }

  redirect(`/editor/${project.id}`)
}

// Loescht ein VSM samt allem, was daran haengt. Die Kindtabellen (processes,
// inventory_buffers, scenarios, reports, benchmark_data, historical_metrics,
// spaghetti_layouts) haengen mit ON DELETE CASCADE am Projekt, activity_logs
// mit ON DELETE SET NULL — das Protokoll ueberlebt das Projekt bewusst.
//
// Unwiderruflich, deshalb die zweistufige Bestaetigung im Button (dasselbe
// Muster wie DeleteScenarioButton, UX-Audit Phase 7a Befund #6).
export async function deleteProject(projectId: string) {
  const orgResult = await currentUserOrgId()
  if ('error' in orgResult) {
    redirect('/dashboard?error=' + encodeURIComponent(orgResult.error))
  }

  const supabase = await createClient()

  // Zusaetzlich zur RLS-Policy explizit auf die eigene Organisation
  // eingegrenzt: ein veraltetes Formular soll ins Leere laufen, nicht
  // stillschweigend etwas anderes treffen.
  const { error, count } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', projectId)
    .eq('organization_id', orgResult.orgId)

  if (error) {
    console.error('deleteProject failed:', error.message)
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('projectDelete')))
  }

  // count === 0 heisst: nichts getroffen. Entweder war das Projekt schon weg
  // oder der Nutzer hat keine Schreibrechte — in beiden Faellen waere ein
  // stilles "erfolgreich" eine Luege.
  if (count === 0) {
    redirect(
      '/dashboard?error=' +
        encodeURIComponent(await tErr('projectNotFound'))
    )
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
