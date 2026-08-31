import { describe, expect, it } from 'vitest'
import { pickActiveOrg, type Membership } from './pickActiveOrg'

const feller: Membership = { organizationId: 'b-222', organizationName: 'Feller AG', role: 'editor' }
const admin: Membership = { organizationId: 'a-111', organizationName: 'Admin', role: 'owner' }
const testfirma: Membership = { organizationId: 'c-333', organizationName: 'Testfirma', role: 'viewer' }

describe('pickActiveOrg', () => {
  it('returns null when the user belongs to no organization', () => {
    expect(pickActiveOrg([], null)).toBeNull()
  })

  it('returns the only membership regardless of the stored preference', () => {
    expect(pickActiveOrg([feller], null)).toEqual(feller)
    expect(pickActiveOrg([feller], 'some-other-org')).toEqual(feller)
  })

  it('honours a stored preference that the user is actually a member of', () => {
    expect(pickActiveOrg([admin, feller, testfirma], 'c-333')).toEqual(testfirma)
  })

  it('ignores a stored preference the user is not a member of', () => {
    // A cookie surviving a revoked membership must not grant access, and must
    // not strand the user on an error page either — it falls back silently.
    expect(pickActiveOrg([admin, feller], 'c-333')).toEqual(admin)
  })

  it('ignores a stored preference that is empty or malformed', () => {
    expect(pickActiveOrg([admin, feller], null)).toEqual(admin)
    expect(pickActiveOrg([admin, feller], '')).toEqual(admin)
  })

  it('falls back deterministically, sorted by organisation name', () => {
    // Whatever order the database returns, the same user must land in the same
    // organisation on every request — otherwise the project list would appear
    // to change on its own between page loads.
    expect(pickActiveOrg([testfirma, feller, admin], null)).toEqual(admin)
    expect(pickActiveOrg([feller, admin, testfirma], null)).toEqual(admin)
  })

  it('breaks ties on identical names by id, so the order is still stable', () => {
    const first: Membership = { organizationId: 'a-111', organizationName: 'Muster AG', role: 'owner' }
    const second: Membership = { organizationId: 'b-222', organizationName: 'Muster AG', role: 'viewer' }

    expect(pickActiveOrg([second, first], null)).toEqual(first)
    expect(pickActiveOrg([first, second], null)).toEqual(first)
  })

  it('sorts case-insensitively, so casing does not decide the default', () => {
    const lower: Membership = { organizationId: 'x', organizationName: 'aabb AG', role: 'owner' }
    const upper: Membership = { organizationId: 'y', organizationName: 'ZZ AG', role: 'owner' }

    expect(pickActiveOrg([upper, lower], null)).toEqual(lower)
  })

  it('does not mutate the array it was given', () => {
    const input = [testfirma, admin, feller]
    pickActiveOrg(input, null)

    expect(input).toEqual([testfirma, admin, feller])
  })
})
