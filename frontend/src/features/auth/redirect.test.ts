import { describe, expect, it } from 'vitest'
import { safeNextPath } from './redirect'

describe('safeNextPath', () => {
  it.each([
    ['/', '/'],
    ['/github/setup?installation_id=1', '/github/setup?installation_id=1'],
    ['/x?y', '/x?y'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })

  it.each([null, '', '//evil.com', '/\\evil.com', 'https://evil.com', 'evil'])(
    'falls back to / for %s',
    (input) => {
      expect(safeNextPath(input)).toBe('/')
    },
  )
})
