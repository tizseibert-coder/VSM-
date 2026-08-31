'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function currentUserOrgId(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return { error: 'Keine Organisation gefunden.' }
  return { orgId: membership.organization_id }
}

export async function createProject(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) {
    redirect('/dashboard?error=' + encodeURIComponent('Projektname darf nicht leer sein.'))
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
    redirect('/dashboard?error=' + encodeURIComponent('Projekt konnte nicht erstellt werden.'))
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

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      organization_id: orgResult.orgId,
      name: 'Beispiel: Wertstromanalyse Dreherei',
      description: 'Beispielprojekt mit Beispieldaten zum Ausprobieren — jederzeit löschbar.',
      annual_throughput: 50000,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    if (projectError) console.error('createExampleProject (project) failed:', projectError.message)
    redirect('/dashboard?error=' + encodeURIComponent('Beispiel konnte nicht erstellt werden.'))
  }

  const exampleProcesses = [
    { name: 'Sägen', cycle_time: 1.2, oee: 82, wip: 0 },
    { name: 'Drehen', cycle_time: 3.4, oee: 78, wip: 0 },
    { name: 'Fräsen', cycle_time: 2.6, oee: 85, wip: 0 },
    { name: 'Montage', cycle_time: 4.1, oee: 90, wip: 0 },
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
    redirect('/dashboard?error=' + encodeURIComponent('Beispiel-Prozesse konnten nicht angelegt werden.'))
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
      redirect('/dashboard?error=' + encodeURIComponent('Beispiel-Puffer konnten nicht angelegt werden.'))
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
    redirect('/dashboard?error=' + encodeURIComponent('Projekt konnte nicht geloescht werden.'))
  }

  // count === 0 heisst: nichts getroffen. Entweder war das Projekt schon weg
  // oder der Nutzer hat keine Schreibrechte — in beiden Faellen waere ein
  // stilles "erfolgreich" eine Luege.
  if (count === 0) {
    redirect(
      '/dashboard?error=' +
        encodeURIComponent('Projekt nicht gefunden oder keine Berechtigung zum Loeschen.')
    )
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
