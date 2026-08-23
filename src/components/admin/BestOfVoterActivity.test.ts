/**
 * BestOfVoterActivity tests — pure timeAgo helper.
 */

import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { timeAgo } from './best-of-voter-activity-helpers'

describe('timeAgo', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-22T12:00:00Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('returns seconds for recent timestamps', () => {
    expect(timeAgo('2026-08-22T11:59:30Z')).toBe('30s ago')
  })

  it('returns minutes for under-an-hour timestamps', () => {
    expect(timeAgo('2026-08-22T11:55:00Z')).toBe('5m ago')
  })

  it('returns hours for under-a-day timestamps', () => {
    expect(timeAgo('2026-08-22T09:00:00Z')).toBe('3h ago')
  })

  it('returns days for older timestamps', () => {
    expect(timeAgo('2026-08-20T12:00:00Z')).toBe('2d ago')
  })
})
