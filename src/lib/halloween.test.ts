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

describe('contest phases (driven by whatever dates are configured)', () => {
  const c = HALLOWEEN_CONFIG
  const ms = (iso: string) => Date.parse(iso)
  const at = (t: number) => getContestState(new Date(t))
  const firstOpen = Math.min(ms(c.submissionsOpen), ms(c.votingOpen))
  const lastClose = Math.max(ms(c.submissionsClose), ms(c.votingClose))

  it('is upcoming before anything opens', () => {
    const s = at(firstOpen - 86_400_000)
    expect(s.phase).toBe('upcoming')
    expect(s.submissionsOpen || s.votingOpen).toBe(false)
  })
  it('reports each window independently inside the contest', () => {
    for (const t of [firstOpen + 1000, (firstOpen + lastClose) / 2, lastClose - 1000]) {
      const s = at(t)
      expect(s.submissionsOpen).toBe(t >= ms(c.submissionsOpen) && t <= ms(c.submissionsClose))
      expect(s.votingOpen).toBe(t >= ms(c.votingOpen) && t <= ms(c.votingClose))
      expect(s.phase).not.toBe('closed')
    }
  })
  it('is closed after both windows end', () => {
    const s = at(lastClose + 60_000)
    expect(s.phase).toBe('closed')
    expect(s.submissionsOpen || s.votingOpen).toBe(false)
  })
  it('config windows are ordered', () => {
    expect(ms(c.submissionsOpen)).toBeLessThan(ms(c.submissionsClose))
    expect(ms(c.votingOpen)).toBeLessThan(ms(c.votingClose))
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
