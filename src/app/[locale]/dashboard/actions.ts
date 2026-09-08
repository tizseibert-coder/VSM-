'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_ORG_COOKIE, getActiveOrg, loadMemberships } from '@/lib/org/activeOrg'
import { loadPlan, loadPlanUsage } from '@/lib/billing/entitlement'
import { noteUserActivity } from '@/lib/crm/leads'
import { projectDefaults } from '@/lib/org/orgSettings'
import { parseSerializedTransfer } from '@/lib/vsm/demoTransfer'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Las die Mitgliedschaft frueher mit `.maybeSingle()` — das wirft, sobald
// jemand in zwei Organisationen ist, der Fehler wurde verschluckt und der
// Nutzer sah "Keine Organisation gefunden". Die Auswahl liegt jetzt in
// lib/org/activeOrg.ts; hier bleibt nur die Anmelde-Weiche.
async function currentUserOrgId(): Promise<
  { orgId: string; orgName: string } | { error: string }
> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')

  const result = await getActiveOrg()
  if ('error' in result) return result
  return { orgId: result.active.organizationId, orgName: result.active.organizationName }
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

  // Tarifgrenze. Geprueft wird *vor* dem Anlegen, nicht per Datenbank-
  // Constraint: Die Grenze haengt an der Organisation, nicht an der Zeile, und
  // eine Fehlermeldung, die den Tarif nennt, ist die einzige, mit der jemand
  // etwas anfangen kann. Solange VSM_PLAN_ENFORCEMENT nicht auf `on` steht,
  // zaehlt das nur mit (siehe lib/billing/entitlement.ts).
  const limitError = await projectLimitError(orgResult.orgId)
  if (limitError) {
    redirect('/dashboard?error=' + encodeURIComponent(limitError))
  }

  // Waehrung, Firmenname und verfuegbare Minuten aus dem Firmenprofil, soweit
  // dort gesetzt. Der Unterschied zwischen "einmal einstellen" und "bei jedem
  // Wertstrom wieder eintippen" ist das erste, was ein Erprober bemerkt —
  // und was nicht gesetzt ist, bleibt bei den Vorgaben der Tabelle.
  const defaults = await projectDefaults(orgResult.orgId, orgResult.orgName)

  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ organization_id: orgResult.orgId, name, ...defaults })
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

  // Das erste angelegte Projekt ist im Vertrieb das aussagekraeftigste
  // Signal ueberhaupt: Wer sich registriert, hat Interesse; wer einen
  // Wertstrom anlegt, arbeitet. Ohne Eintrag in `vsm_leads` passiert nichts.
  const { data: claimsData } = await supabase.auth.getClaims()
  if (claimsData?.claims?.sub) {
    await noteUserActivity(claimsData.claims.sub, 'project_created', {
      projectId: project.id,
      organizationId: orgResult.orgId,
    })
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

  // Dieselbe Grenze wie beim leeren Projekt: Das Beispiel ist ein Projekt wie
  // jedes andere, es faellt nur schneller vom Himmel.
  const limitError = await projectLimitError(orgResult.orgId)
  if (limitError) {
    redirect('/dashboard?error=' + encodeURIComponent(limitError))
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

  // Dasselbe Firmenprofil wie beim leeren Projekt: Das Beispiel ist ein
  // Projekt wie jedes andere, es faellt nur schneller vom Himmel.
  const exampleDefaults = await projectDefaults(orgResult.orgId, orgResult.orgName)

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      organization_id: orgResult.orgId,
      name: tEx('projectName'),
      description: tEx('description'),
      annual_throughput: 50000,
      ...exampleDefaults,
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

/**
 * Uebernimmt den Wertstrom aus der Demo in ein eigenes Projekt.
 *
 * [Marketing-Audit 2026-09-07, A2] Die Demo verwarf ihren Zustand beim
 * Neuladen. Damit ging genau die Investition verloren, die den Anmeldegrund
 * traegt: Wer zehn Minuten an einem Wertstrom gearbeitet hat, meldet sich
 * an, um ihn zu behalten — nicht wegen einer Funktionsliste.
 *
 * Der Zustand kommt aus dem `localStorage` des Nutzers und damit als
 * **fremde Eingabe** an den Server, auch wenn wir ihn selbst geschrieben
 * haben. `parseSerializedTransfer` prueft ihn vollstaendig (Groesse vor dem
 * Parsen, Fassung, Ablauf, Wertebereiche) und gibt entweder etwas
 * Vollstaendiges zurueck oder nichts — siehe lib/vsm/demoTransfer.ts.
 *
 * Dieselbe Tarifgrenze wie beim leeren Projekt: Ein uebernommener Wertstrom
 * ist ein Projekt wie jedes andere.
 *
 * Firmenprofil und Uebernahme koennen sich widersprechen, und dann gilt eine
 * Reihenfolge: Der Firmenname aus einem gesetzten Profil hat Vorrang vor dem
 * Namen aus der Demo-Beschriftung ("Musterwerk GmbH") — der gehoert nicht auf
 * das Blatt eines echten Kunden. Waehrung und Schichtzeit dagegen bleiben die
 * des Nutzers aus der Demo: Das sind Rechenparameter, mit denen er gerade
 * experimentiert hat, und die im Abschluss unter der Demo genannten Zahlen
 * gelten fuer genau diese Werte — sie stillschweigend zu aendern wuerde das
 * uebernommene Projekt von dem loesen, was er gesehen hat.
 */
export async function importDemoProject(formData: FormData) {
  const orgResult = await currentUserOrgId()
  if ('error' in orgResult) {
    redirect('/dashboard?error=' + encodeURIComponent(orgResult.error))
  }

  const transfer = parseSerializedTransfer(formData.get('transfer') as string | null)
  if (!transfer) {
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('demoImportUnreadable')))
  }

  const limitError = await projectLimitError(orgResult.orgId)
  if (limitError) {
    redirect('/dashboard?error=' + encodeURIComponent(limitError))
  }

  const defaults = await projectDefaults(orgResult.orgId, orgResult.orgName)
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      organization_id: orgResult.orgId,
      name: transfer.projectName,
      description: transfer.description,
      company: defaults.company ?? transfer.company,
      product_name: transfer.productName,
      customer_name: transfer.customerName,
      supplier_name: transfer.supplierName,
      erp_label: transfer.erpLabel,
      annual_throughput: transfer.annualThroughput,
      available_minutes_per_day: transfer.availableMinutesPerDay,
      piece_value: transfer.pieceValue,
      currency: transfer.currency,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    if (projectError) console.error('importDemoProject (project) failed:', projectError.message)
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('demoImportFailed')))
  }

  // Wie beim Beispielprojekt: kein .order() auf dem RETURNING — PostgREST
  // lehnt eine Sortierung nach einer Spalte ausserhalb der .select()-Liste ab.
  // Die Reihenfolge eines mehrzeiligen INSERT bleibt erhalten, und genau die
  // brauchen wir, um die Bestaende ueber ihre Position zuzuordnen.
  const { data: insertedProcesses, error: processesError } = await supabase
    .from('processes')
    .insert(
      transfer.processes.map((p) => ({
        project_id: project.id,
        name: p.name,
        cycle_time: p.cycleTime,
        changeover_time: p.changeoverTime,
        oee: p.oee,
        operator_count: p.operatorCount,
        wip: p.wip,
        lane: p.lane,
        is_pacemaker: p.isPacemaker,
        has_heijunka: p.hasHeijunka,
        classification: p.classification,
        x: p.x,
        y: p.y,
      }))
    )
    .select('id')

  if (processesError || !insertedProcesses) {
    if (processesError) {
      console.error('importDemoProject (processes) failed:', processesError.message)
    }
    redirect('/dashboard?error=' + encodeURIComponent(await tErr('demoImportFailed')))
  }

  const idAt = (index: number | null): string | null =>
    index === null ? null : (insertedProcesses[index]?.id ?? null)

  if (transfer.buffers.length > 0) {
    const { error: bufferError } = await supabase.from('inventory_buffers').insert(
      transfer.buffers.map((b) => ({
        project_id: project.id,
        from_process_id: idAt(b.fromIndex),
        to_process_id: idAt(b.toIndex),
        wip_count: b.wipCount,
        buffer_type: b.bufferType,
        flow_style: b.flowStyle,
        kanban_type: b.kanbanType,
        x: b.x,
        y: b.y,
      }))
    )

    if (bufferError) {
      // Das Projekt und seine Stationen stehen schon. Ein Wertstrom ohne
      // Bestandsdreiecke ist unvollstaendig, aber brauchbar — ihn deswegen
      // wieder zu loeschen waere die schlechtere Antwort.
      console.error('importDemoProject (buffers) failed:', bufferError.message)
    }
  }

  // Das erste angelegte Projekt ist im Vertrieb das aussagekraeftigste
  // Signal ueberhaupt — dieselbe Zeile wie bei createProject.
  const { data: claimsData } = await supabase.auth.getClaims()
  if (claimsData?.claims?.sub) {
    await noteUserActivity(claimsData.claims.sub, 'project_created', {
      projectId: project.id,
      organizationId: orgResult.orgId,
      source: 'demo',
    })
  }

  // `demoImported` sagt der Editor-Seite, dass sie den Zwischenstand im
  // Browser wegraeumen soll — eine Server Action kann das nicht selbst, sie
  // laeuft nicht dort. Erst hier, nicht schon beim Absenden: Scheitert die
  // Uebernahme oben, ist der Zwischenstand noch da.
  redirect(`/editor/${project.id}?demoImported=1`)
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

/**
 * Die Projektgrenze des Tarifs, als fertige Fehlermeldung oder null.
 *
 * Steht hier und nicht in lib/billing, weil sie eine *uebersetzte* Meldung
 * ergibt: Die Grenze selbst ist eine Zahl, der Satz darum gehoert zur
 * Oberflaeche.
 */
async function projectLimitError(organizationId: string): Promise<string | null> {
  const plan = await loadPlan(organizationId)
  if (!plan.enforced) return null

  const usage = await loadPlanUsage(organizationId, plan)
  if (usage.projects.allowed) return null

  const t = await getTranslations('Errors')
  return t('planProjectLimit', {
    limit: usage.projects.limit ?? 0,
    tier: plan.tier,
  })
}

// Fehlermeldungen der Actions landen ueber ?error= in der Oberflaeche und
// muessen deshalb der Sprache folgen. getTranslations() liest sie hier aus
// dem Cookie, das die Middleware gesetzt hat.
async function tErr(key: string): Promise<string> {
  const t = await getTranslations('Errors')
  return t(key)
}
