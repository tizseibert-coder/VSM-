import { describe, expect, it } from 'vitest'
import { median, scorePosts, type MetricSnapshot, type PostForScoring } from './scoring'
import { armKey, chooseArm, collectArmStats, sampleBeta, seededRng } from './bandit'
import { nextMonday, planWeek, weekSlots } from './plan'
import { WEEKLY_SCHEDULE } from './config'

function snapshot(age_hours: number, impressions: number | null, extra: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    age_hours,
    impressions,
    reach: null,
    reactions: null,
    comments: null,
    shares: null,
    saves: null,
    clicks: null,
    ...extra,
  }
}

function post(id: string, overrides: Partial<PostForScoring>): PostForScoring {
  return {
    id,
    channel: 'linkedin',
    topic: 'kpi_explained',
    format: 'text',
    hook: 'question',
    explore: false,
    metrics: [],
    ...overrides,
  }
}

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('scorePosts', () => {
  it('skips posts that are too young or have no visibility figure', () => {
    const scored = scorePosts([
      post('young', { metrics: [snapshot(24, 500)] }),
      post('blind', { metrics: [snapshot(100, null)] }),
      post('ok', { metrics: [snapshot(100, 300)] }),
    ])
    expect(scored.map((s) => s.id)).toEqual(['ok'])
  })

  it('uses the oldest snapshot, falls back to reach, and compares within the channel only', () => {
    const scored = scorePosts([
      post('li-a', { metrics: [snapshot(24, 50), snapshot(168, 1000)] }),
      post('li-b', { metrics: [snapshot(168, 200)] }),
      post('li-c', { metrics: [snapshot(168, 400)] }),
      // Instagram mit viel kleineren Zahlen darf nicht gegen LinkedIn verlieren.
      post('ig-a', { channel: 'instagram', format: 'quote_card', metrics: [snapshot(168, null, { reach: 90 })] }),
      post('ig-b', { channel: 'instagram', format: 'quote_card', metrics: [snapshot(168, 30)] }),
    ])
    const byId = Object.fromEntries(scored.map((s) => [s.id, s]))
    expect(byId['li-a'].score).toBe(1000)
    expect(byId['li-a'].relative).toBeCloseTo(2.5)
    expect(byId['li-a'].win).toBe(true)
    expect(byId['li-b'].win).toBe(false)
    // Der Median-Beitrag selbst ist kein Treffer.
    expect(byId['li-c'].win).toBe(false)
    expect(byId['ig-a'].score).toBe(90)
    expect(byId['ig-a'].win).toBe(true)
  })

  it('computes the engagement rate from all interactions', () => {
    const [scored] = scorePosts([
      post('x', { metrics: [snapshot(100, 1000, { reactions: 30, comments: 5, shares: 5 })] }),
    ])
    expect(scored.engagementRate).toBeCloseTo(0.04)
  })
})

describe('bandit', () => {
  it('samples Beta values inside (0, 1) with the right mean', () => {
    const rng = seededRng(1)
    let sum = 0
    for (let i = 0; i < 4000; i++) {
      const v = sampleBeta(8, 2, rng)
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(1)
      sum += v
    }
    expect(sum / 4000).toBeCloseTo(0.8, 1)
  })

  it('prefers an arm with a strong track record', () => {
    const winner = { channel: 'linkedin' as const, topic: 'lean_myth', format: 'text' }
    const stats = new Map([[armKey(winner), { wins: 12, losses: 1 }]])
    // Alle anderen Arme sind schwach belegt, damit der Vorsprung nicht nur
    // aus der Unsicherheit ungetesteter Arme kommt.
    for (const other of ['kpi_explained', 'vsm_howto', 'quick_win']) {
      stats.set(armKey({ channel: 'linkedin', topic: other, format: 'text' }), { wins: 1, losses: 12 })
    }
    const rng = seededRng(42)
    let hits = 0
    for (let i = 0; i < 200; i++) {
      if (armKey(chooseArm('linkedin', stats, rng)) === armKey(winner)) hits++
    }
    // Deutlich ueber dem Zufall (1/16), aber nicht immer: Ungetestete Arme
    // bekommen weiterhin ihre Gelegenheit.
    expect(hits).toBeGreaterThan(40)
    expect(hits).toBeLessThan(200)
  })

  it('collects wins and losses per arm', () => {
    const scored = scorePosts([
      post('a', { metrics: [snapshot(100, 1000)] }),
      post('b', { metrics: [snapshot(100, 10)] }),
      post('c', { metrics: [snapshot(100, 500)] }),
    ])
    const stats = collectArmStats(scored)
    expect(stats.get('linkedin|kpi_explained|text')).toEqual({ wins: 1, losses: 2 })
  })
})

describe('plan', () => {
  it('finds the Monday of next week from any weekday, Sunday included', () => {
    expect(nextMonday(new Date('2026-09-28T07:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-05')
    expect(nextMonday(new Date('2026-10-02T07:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-05')
    expect(nextMonday(new Date('2026-10-04T23:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-05')
  })

  it('lays out the weekly schedule per channel', () => {
    const slots = weekSlots(new Date('2026-10-05T00:00:00Z'))
    expect(slots).toHaveLength(WEEKLY_SCHEDULE.linkedin.length + WEEKLY_SCHEDULE.instagram.length)
    expect(slots.filter((s) => s.channel === 'instagram').map((s) => s.date)).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
    ])
  })

  it('marks at least one exploration slot per channel and never repeats a topic within a week', () => {
    const slots = weekSlots(new Date('2026-10-05T00:00:00Z'))
    const planned = planWeek(slots, new Map(), seededRng(7))
    for (const channel of ['linkedin', 'instagram'] as const) {
      const mine = planned.filter((p) => p.channel === channel)
      expect(mine.some((p) => p.explore)).toBe(true)
      expect(new Set(mine.map((p) => p.topic)).size).toBe(mine.length)
    }
  })
})

describe('escapeLinkedInText', () => {
  it('escapes reserved characters and turns hashtags into hashtag templates', async () => {
    const { escapeLinkedInText } = await import('./publishers')
    expect(escapeLinkedInText('Taktzeit (Beispiel) *wichtig* #Lean #Wertstrom_Analyse'))
      .toBe('Taktzeit \\(Beispiel\\) \\*wichtig\\* {hashtag|\\#|Lean} {hashtag|\\#|Wertstrom_Analyse}')
    expect(escapeLinkedInText('Platz # 1')).toBe('Platz \\# 1')
  })
})
