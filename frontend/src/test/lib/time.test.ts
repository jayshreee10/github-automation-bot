import { describe, expect, it } from 'vitest'
import { timeAgo } from '@/lib/time'

const now = Date.parse('2026-09-26T12:00:00Z')
const ago = (secs: number) => new Date(now - secs * 1000).toISOString()

describe('timeAgo', () => {
  it('says just now under a minute', () => {
    expect(timeAgo(ago(0), now)).toBe('just now')
    expect(timeAgo(ago(59), now)).toBe('just now')
  })

  it('uses minutes, hours and days', () => {
    expect(timeAgo(ago(3 * 60), now)).toMatch(/3 minutes ago/)
    expect(timeAgo(ago(2 * 3600), now)).toMatch(/2 hours ago/)
    expect(timeAgo(ago(86_400), now)).toMatch(/yesterday/)
  })

  it('handles times in the future', () => {
    expect(timeAgo(ago(-5 * 60), now)).toMatch(/in 5 minutes/)
  })
})

describe('compact time formats', () => {
  it('shortAge uses the largest whole unit', async () => {
    const { shortAge } = await import('@/lib/time')
    expect(shortAge(ago(12), now)).toBe('12s')
    expect(shortAge(ago(3 * 60 + 10), now)).toBe('3m')
    expect(shortAge(ago(2 * 3600), now)).toBe('2h')
    expect(shortAge(ago(4 * 86_400), now)).toBe('4d')
    expect(shortAge(ago(-30), now)).toBe('0s')
  })

  it('shortUntil counts down and says now once passed', async () => {
    const { shortUntil } = await import('@/lib/time')
    expect(shortUntil(ago(-38), now)).toBe('in 38s')
    expect(shortUntil(ago(-120), now)).toBe('in 2m')
    expect(shortUntil(ago(5), now)).toBe('now')
  })

  it('clockTime is a 24h time of day', async () => {
    const { clockTime } = await import('@/lib/time')
    expect(clockTime('2026-09-26T12:00:00Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
