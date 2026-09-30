// Der Foto-Hintergrund der Kacheln — optional, ueber OpenAIs Bildmodell.
//
// Claude selbst kann keine Bilder erzeugen; dafuer braucht es einen eigenen
// Dienst. Erzeugt wird **hoechstens einmal pro Beitrag**: Das Ergebnis
// landet in `vsm_social_posts.card_photo_base64` und wird von dort
// wiederverwendet (siehe api/social/card/[postId]/route.tsx) — nicht bei
// jedem Aufruf neu, denn Instagram und ein Browser-Vorschau-Klick holen
// dasselbe Bild mehrfach ab.
//
// Ohne `OPENAI_API_KEY` bleibt die Kachel bei der bisherigen einfarbigen
// Gestaltung; nichts bricht.

export function hasImageCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

/**
 * Der Stil-Zusatz, der jede Bildbeschreibung begleitet.
 *
 * Der entscheidende Satz ist der zweite: Ein Bildmodell greift ohne
 * Gegensteuer zum glatten, symmetrischen "Werbefoto"-Look — genau das, was
 * eine Fachzielgruppe als KI-Stockfoto erkennt und ueberscrollt. Die
 * Anweisung, wie ein Wirtschaftsjournalist zu fotografieren (leichte
 * Koernung, unperfektes Licht, echte Abnutzung), zielt auf das Gegenteil:
 * ein Bild, das wie ein Ausschnitt aus einer echten Reportage wirkt und in
 * dem sich ein Produktionsleiter seine eigene Halle wiedererkennt.
 */
const STYLE_SUFFIX =
  'Fotorealistisch, wie von einem Fotojournalisten fuer eine Wirtschaftszeitung in einer echten Schweizer Fertigungshalle aufgenommen: leichte Koernung, unperfektes natuerliches Licht, glaubwuerdige Abnutzungsspuren an Material und Boden, kein gestellter Werbe-Look, kein glatter Hochglanz-Stockfoto-Stil. Keinerlei Text, keine Schrift, keine Logos, keine Markennamen, keine erkennbaren Gesichter im Vordergrund.'

/**
 * Erzeugt ein Hochformat-Foto (1024×1536) zu einer Bildbeschreibung.
 * Wirft bei jedem Fehler — der Aufrufer faengt das ab und faellt auf die
 * einfarbige Kachel zurueck, statt den Beitrag unbebildert zu lassen.
 */
export async function generatePhoto(prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY fehlt.')

  const fullPrompt = `${prompt}. ${STYLE_SUFFIX}`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      size: '1024x1536',
      // 'high' statt 'medium': Bei einem Bild je Beitrag (nicht je Aufruf)
      // ist der Preisunterschied gering, der Unterschied in Detailschaerfe
      // — gerade bei den vielen kleinen Gegenstaenden in den Prompts
      // (Kanban-Karte, Andon-Tafel, Stoppuhr) — aber deutlich sichtbar.
      quality: 'high',
      // b64_json statt einer URL: OpenAIs Bild-URLs laufen nach kurzer Zeit
      // ab, das gespeicherte Ergebnis soll aber dauerhaft sein.
      output_format: 'jpeg',
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenAI-Bild: ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`)
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI-Bild: keine Bilddaten in der Antwort.')
  return Buffer.from(b64, 'base64')
}
