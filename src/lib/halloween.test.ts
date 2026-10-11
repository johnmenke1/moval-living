import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  addressKey,
  streetNameOnly,
  publicLocationFor,
  getContestState,
  hashIp,
  mintDeviceCookie,
  readDeviceCookie,
  insideMorenoValleyArea,
  HALLOWEEN_CONFIG,
} from './halloween'

afterEach(() => vi.useRealTimers())

describe('addressKey', () => {
  it('treats formatting/abbreviation variants as the same house', () => {
    expect(addressKey('1234 Elm Street', '92553')).toBe(addressKey('1234  elm st.', '92553-1234'))
    expect(addressKey('88 Sunnymead Boulevard')).toBe(addressKey('88 sunnymead blvd'))
  })
  it('differs for different houses', () => {
    expect(addressKey('1234 Elm St', '92553')).not.toBe(addressKey('1236 Elm St', '92553'))
  })
})

describe('public location privacy', () => {
  const lat = 33.94251234
  const lng = -117.22977777
  it('hides the house number and blurs the pin unless opted in', () => {
    const p = publicLocationFor(lat, lng, '1234 Elm St', false)
    expect(p.locationLabel).toBe('Near Elm St')
    expect(p.locationLabel).not.toMatch(/1234/)
    expect(p.publicLatitude).toBe(33.943)
    expect(p.publicLongitude).toBe(-117.23)
  })
  it('shows exact data when opted in', () => {
    const p = publicLocationFor(lat, lng, '1234 Elm St', true)
    expect(p).toEqual({ publicLatitude: lat, publicLongitude: lng, locationLabel: '1234 Elm St' })
  })
  it('streetNameOnly strips unit-style numbers', () => {
    expect(streetNameOnly('12B Pine Ct')).toBe('Pine Ct')
  })
})

describe('contest phases', () => {
  const at = (iso: string) => getContestState(new Date(iso))
  it('moves through upcoming -> open -> voting -> closed', () => {
    expect(at('2026-10-01T12:00:00-07:00').phase).toBe('upcoming')
    const open = at('2026-10-15T12:00:00-07:00')
    expect(open.phase).toBe('open')
    expect(open.submissionsOpen && !open.votingOpen).toBe(true)
    const voting = at('2026-10-22T12:00:00-07:00')
    expect(voting.phase).toBe('voting')
    expect(voting.votingOpen && voting.submissionsOpen).toBe(true)
    const late = at('2026-10-28T12:00:00-07:00')
    expect(late.votingOpen).toBe(true)
    expect(late.submissionsOpen).toBe(false)
    expect(at('2026-11-02T12:00:00-07:00').phase).toBe('closed')
  })
  it('config windows are ordered', () => {
    const c = HALLOWEEN_CONFIG
    expect(Date.parse(c.submissionsOpen)).toBeLessThan(Date.parse(c.submissionsClose))
    expect(Date.parse(c.votingOpen)).toBeLessThan(Date.parse(c.votingClose))
  })
})

describe('hashing + device cookie', () => {
  it('hashes ips deterministically without leaking them', async () => {
    const a = await hashIp('203.0.113.9')
    expect(a).toBe(await hashIp('203.0.113.9'))
    expect(a).not.toBe(await hashIp('203.0.113.10'))
    expect(a).not.toContain('203')
  })
  it('accepts its own cookie and rejects tampering', async () => {
    const { id, value } = await mintDeviceCookie()
    expect(await readDeviceCookie(value)).toBe(id)
    expect(await readDeviceCookie(value.slice(0, -1) + (value.endsWith('a') ? 'b' : 'a'))).toBeNull()
    expect(await readDeviceCookie(`${'0'.repeat(32)}.${'0'.repeat(32)}`)).toBeNull()
    expect(await readDeviceCookie(undefined)).toBeNull()
    expect(await readDeviceCookie('garbage')).toBeNull()
  })
})

describe('service area', () => {
  it('flags far-away coordinates', () => {
    expect(insideMorenoValleyArea(33.94, -117.23)).toBe(true)
    expect(insideMorenoValleyArea(34.05, -118.24)).toBe(false)
  })
})
