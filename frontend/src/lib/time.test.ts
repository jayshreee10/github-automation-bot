import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

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
