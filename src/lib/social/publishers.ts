// Die Anbindung an LinkedIn und Instagram — direkt an die Plattform-APIs,
// ohne Zwischendienst.
//
// Beide Kanaele sind optional. Fehlen die Zugangsdaten eines Kanals, laeuft
// er im Handbetrieb: Der Verwaltungsbereich zeigt Text und Kachel zum
// Kopieren, und Veroeffentlichung und Messwerte werden von Hand eingetragen.
// Das ist kein Notbehelf, sondern der vorgesehene Start — die API-Freigaben
// (vor allem LinkedIns Community Management API) dauern Tage bis Wochen,
// und bis dahin sollen trotzdem Daten entstehen.
//
// Die Einrichtung steht in docs/social-agent-setup.md.
//
// Die Versionen der beiden APIs sind einstellbar, weil beide Plattformen
// alte Versionen nach etwa einem Jahr abschalten. Wenn ein Kanal ploetzlich
// mit "version not supported" scheitert, ist die Umgebungsvariable die
// Stelle, nicht dieser Code.

import type { Channel } from './config'

export type PublishInput = {
  body: string
  /** Oeffentlich abrufbare Adresse der Kachel (JPEG), oder null. */
  imageUrl: string | null
  imageAlt: string | null
}

export type PublishResult = { externalId: string; externalUrl: string | null }

export type FetchedMetrics = {
  impressions: number | null
  reach: number | null
  reactions: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  clicks: number | null
  raw: unknown
}

export class PublishError extends Error {}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  return `${res.status} ${res.statusText}: ${text.slice(0, 500)}`
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// ─────────────────────────────────────────────
// LinkedIn (Posts API, "versioned" REST)
// ─────────────────────────────────────────────

function linkedinEnv() {
  return {
    token: process.env.LINKEDIN_ACCESS_TOKEN,
    // urn:li:organization:123 (Unternehmensseite) oder urn:li:person:abc
    // (persoenliches Profil — dafuer gibt die API keine Statistiken her).
    author: process.env.LINKEDIN_AUTHOR_URN,
    version: process.env.LINKEDIN_API_VERSION || '202608',
  }
}

function linkedinHeaders(token: string, version: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': version,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  }
}

async function linkedinUploadImage(imageUrl: string): Promise<string> {
  const { token, author, version } = linkedinEnv()
  const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: linkedinHeaders(token!, version),
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  })
  if (!init.ok) throw new PublishError(`LinkedIn-Bild vorbereiten: ${await readError(init)}`)
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } }

  const image = await fetch(imageUrl)
  if (!image.ok) throw new PublishError(`Kachel laden (${imageUrl}): ${await readError(image)}`)

  const upload = await fetch(value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: await image.arrayBuffer(),
  })
  if (!upload.ok) throw new PublishError(`LinkedIn-Bild hochladen: ${await readError(upload)}`)
  return value.image
}

async function linkedinPublish(input: PublishInput): Promise<PublishResult> {
  const { token, author, version } = linkedinEnv()

  const content = input.imageUrl
    ? { media: { id: await linkedinUploadImage(input.imageUrl), altText: input.imageAlt ?? undefined } }
    : undefined

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedinHeaders(token!, version),
    body: JSON.stringify({
      author,
      // LinkedIns "little text format": Klammern, Sternchen u. a. sind
      // Steuerzeichen und muessen maskiert werden, sonst schneidet die API
      // den Text an der ersten Klammer ab.
      commentary: escapeLinkedInText(input.body),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content,
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })
  if (!res.ok) throw new PublishError(`LinkedIn-Beitrag: ${await readError(res)}`)

  // Die Kennung steht im Kopf, nicht im (leeren) Rumpf.
  const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id')
  if (!urn) throw new PublishError('LinkedIn hat den Beitrag angenommen, aber keine Kennung zurueckgegeben.')
  return { externalId: urn, externalUrl: `https://www.linkedin.com/feed/update/${urn}/` }
}

/** Maskiert die Steuerzeichen des "little text format". Ein Hashtag muss
 *  dort als `{hashtag|\#|Wort}` stehen; ein nacktes `#` ist selbst ein
 *  Steuerzeichen. */
export function escapeLinkedInText(text: string): string {
  return text
    .split(/(#[\p{L}\p{N}_]+)/u)
    .map((part, i) =>
      i % 2 === 1
        ? `{hashtag|\\#|${part.slice(1)}}`
        : part.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`)
    )
    .join('')
}

async function linkedinMetrics(externalId: string): Promise<FetchedMetrics | null> {
  const { token, author, version } = linkedinEnv()
  // Statistiken gibt es nur fuer Unternehmensseiten.
  if (!author?.startsWith('urn:li:organization:')) return null

  const kind = externalId.startsWith('urn:li:ugcPost:') ? 'ugcPosts' : 'shares'
  const url =
    'https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity' +
    `&organizationalEntity=${encodeURIComponent(author)}` +
    `&${kind}=List(${encodeURIComponent(externalId)})`

  const res = await fetch(url, { headers: linkedinHeaders(token!, version) })
  if (!res.ok) throw new PublishError(`LinkedIn-Statistik: ${await readError(res)}`)
  const json = (await res.json()) as { elements?: { totalShareStatistics?: Record<string, unknown> }[] }
  const s = json.elements?.[0]?.totalShareStatistics
  if (!s) return null

  return {
    impressions: num(s.impressionCount),
    reach: num(s.uniqueImpressionsCount),
    reactions: num(s.likeCount),
    comments: num(s.commentCount),
    shares: num(s.shareCount),
    saves: null,
    clicks: num(s.clickCount),
    raw: s,
  }
}

// ─────────────────────────────────────────────
// Instagram (Graph API ueber eine verknuepfte Facebook-Seite)
// ─────────────────────────────────────────────

function instagramEnv() {
  return {
    token: process.env.INSTAGRAM_ACCESS_TOKEN,
    userId: process.env.INSTAGRAM_USER_ID,
    version: process.env.INSTAGRAM_GRAPH_VERSION || 'v23.0',
  }
}

function graphUrl(path: string, params: Record<string, string>): string {
  const { token, version } = instagramEnv()
  const qs = new URLSearchParams({ ...params, access_token: token! })
  return `https://graph.facebook.com/${version}/${path}?${qs}`
}

async function instagramPublish(input: PublishInput): Promise<PublishResult> {
  const { userId } = instagramEnv()
  if (!input.imageUrl) throw new PublishError('Instagram braucht immer ein Bild.')

  // 1) Container anlegen — Instagram laedt das Bild dabei selbst von der
  //    angegebenen Adresse. Sie muss oeffentlich erreichbar sein (also nicht
  //    localhost) und ein JPEG liefern.
  const create = await fetch(graphUrl(`${userId}/media`, { image_url: input.imageUrl, caption: input.body }), {
    method: 'POST',
  })
  if (!create.ok) throw new PublishError(`Instagram-Container: ${await readError(create)}`)
  const { id: containerId } = (await create.json()) as { id: string }

  // 2) Warten, bis Instagram das Bild verarbeitet hat. Bei Bildern dauert
  //    das Sekunden; wer vorher veroeffentlicht, bekommt "media not ready".
  for (let attempt = 0; attempt < 10; attempt++) {
    const status = await fetch(graphUrl(containerId, { fields: 'status_code' }))
    if (status.ok) {
      const { status_code } = (await status.json()) as { status_code?: string }
      if (status_code === 'FINISHED') break
      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        throw new PublishError(`Instagram konnte das Bild nicht verarbeiten (${status_code}).`)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  // 3) Veroeffentlichen.
  const publish = await fetch(graphUrl(`${userId}/media_publish`, { creation_id: containerId }), { method: 'POST' })
  if (!publish.ok) throw new PublishError(`Instagram-Veroeffentlichung: ${await readError(publish)}`)
  const { id: mediaId } = (await publish.json()) as { id: string }

  const details = await fetch(graphUrl(mediaId, { fields: 'permalink' }))
  const permalink = details.ok ? ((await details.json()) as { permalink?: string }).permalink ?? null : null
  return { externalId: mediaId, externalUrl: permalink }
}

async function instagramMetrics(externalId: string): Promise<FetchedMetrics | null> {
  const basics = await fetch(graphUrl(externalId, { fields: 'like_count,comments_count' }))
  if (!basics.ok) throw new PublishError(`Instagram-Beitrag lesen: ${await readError(basics)}`)
  const b = (await basics.json()) as { like_count?: number; comments_count?: number }

  // Meta benennt Insights-Metriken regelmaessig um oder schafft sie ab
  // ("impressions" → "views"). Scheitert die volle Liste, wird es mit der
  // kleinsten sinnvollen Menge noch einmal versucht, statt gar nichts zu
  // messen.
  const insights: Record<string, number | null> = {}
  let raw: unknown = null
  for (const metrics of ['reach,views,saved,shares', 'reach,saved,shares', 'reach']) {
    const res = await fetch(graphUrl(`${externalId}/insights`, { metric: metrics }))
    if (!res.ok) continue
    const json = (await res.json()) as { data?: { name: string; values?: { value?: unknown }[] }[] }
    raw = json
    for (const entry of json.data ?? []) insights[entry.name] = num(entry.values?.[0]?.value)
    break
  }

  return {
    impressions: insights.views ?? null,
    reach: insights.reach ?? null,
    reactions: num(b.like_count),
    comments: num(b.comments_count),
    shares: insights.shares ?? null,
    saves: insights.saved ?? null,
    clicks: null,
    raw: { basics: b, insights: raw },
  }
}

// ─────────────────────────────────────────────
// Gemeinsame Schnittstelle
// ─────────────────────────────────────────────

/** Ob der Kanal automatisch postet. Sonst Handbetrieb. */
export function channelConfigured(channel: Channel): boolean {
  if (channel === 'linkedin') {
    const { token, author } = linkedinEnv()
    return Boolean(token && author)
  }
  const { token, userId } = instagramEnv()
  return Boolean(token && userId)
}

/** Ob der Kanal Messwerte automatisch liefert. LinkedIn nur fuer
 *  Unternehmensseiten. */
export function channelHasMetrics(channel: Channel): boolean {
  if (!channelConfigured(channel)) return false
  if (channel === 'linkedin') return Boolean(linkedinEnv().author?.startsWith('urn:li:organization:'))
  return true
}

export function publishTo(channel: Channel, input: PublishInput): Promise<PublishResult> {
  return channel === 'linkedin' ? linkedinPublish(input) : instagramPublish(input)
}

export function fetchMetrics(channel: Channel, externalId: string): Promise<FetchedMetrics | null> {
  return channel === 'linkedin' ? linkedinMetrics(externalId) : instagramMetrics(externalId)
}
