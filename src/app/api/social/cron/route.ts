import { NextResponse } from 'next/server'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase/admin'
import { runDaily } from '@/lib/social/runner'

/**
 * Der taegliche Lauf des Social-Media-Agenten (Zeitplan in vercel.json).
 *
 * Postet Freigegebenes, holt Messwerte, und freitags: auswerten und die
 * naechste Woche entwerfen. Was genau passiert, steht in
 * lib/social/runner.ts → runDaily().
 *
 * Vercel schickt bei Cron-Aufrufen `Authorization: Bearer <CRON_SECRET>`,
 * sobald die Variable gesetzt ist. Ohne gesetztes Geheimnis laeuft hier
 * nichts: Eine offene Adresse, die auf Zuruf postet und Claude aufruft,
 * waere eine Einladung.
 *
 * Kein `[locale]`-Segment und unter `/api`, damit die Sprachweiche in
 * proxy.ts nicht umleitet (siehe dort, `matcher`).
 */

// Das Entwerfen einer Woche braucht einen Claude-Aufruf mit Nachdenken,
// das Posten auf Instagram wartet auf die Bildverarbeitung. Beides zusammen
// passt nicht in die Vorgabe von wenigen Sekunden.
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  if (!hasAdminCredentials()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY fehlt.' }, { status: 500 })
  }

  const log = await runDaily(createAdminClient(), new Date())
  console.log('social cron:', JSON.stringify(log))
  return NextResponse.json(log)
}
