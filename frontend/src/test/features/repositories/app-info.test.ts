import { describe, expect, it } from 'vitest'
import { permissionRows } from '@/features/repositories/app-info'

describe('permissionRows', () => {
  it('orders known permissions and labels access levels', () => {
    const rows = permissionRows({ metadata: 'read', pull_requests: 'write', issues: 'write' })
    expect(rows.map((r) => [r.name, r.access, r.tone])).toEqual([
      ['Issues', 'Read & write', 'outline'],
      ['Pull requests', 'Read & write', 'outline'],
      ['Metadata', 'Read', 'muted'],
      ['Contents', 'No access', 'muted'],
    ])
  })

  it('shows contents access GitHub reports, and lists unknown permissions after the known ones', () => {
    const rows = permissionRows({ contents: 'write', checks: 'read' })
    expect(rows.map((r) => [r.key, r.access])).toEqual([
      ['contents', 'Read & write'],
      ['checks', 'Read'],
    ])
    expect(rows[1].name).toBe('Checks')
  })
})
