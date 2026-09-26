import { describe, expect, it } from 'vitest'
import { groupByInstallation } from './group-by-installation'

const repo = (id: string, installationId: string) => ({
  id,
  fullName: `acme/${id}`,
  isPrivate: false,
  installationId,
  accountLogin: 'acme',
})

describe('groupByInstallation', () => {
  it('groups repositories under their installation, in installation order', () => {
    const groups = groupByInstallation({
      installations: [
        { id: '1', accountLogin: 'acme' },
        { id: '2', accountLogin: 'octo' },
      ],
      repositories: [repo('a', '2'), repo('b', '1'), repo('c', '2')],
    })
    expect(groups.map((g) => [g.installationId, g.repos.map((r) => r.id)])).toEqual([
      ['1', ['b']],
      ['2', ['a', 'c']],
    ])
  })

  it('keeps an installation with zero repositories', () => {
    const groups = groupByInstallation({
      installations: [{ id: '1', accountLogin: 'acme' }],
      repositories: [],
    })
    expect(groups).toEqual([{ installationId: '1', accountLogin: 'acme', repos: [] }])
  })
})
