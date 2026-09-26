import { describe, expect, it } from 'vitest'
import { groupByInstallation } from '@/features/repositories/group-by-installation'
import { repository } from '../../fixtures'

const acme = { id: '1', accountLogin: 'acme', accountType: 'User', repositorySelection: 'all' }
const octo = { id: '2', accountLogin: 'octo', accountType: 'Organization', repositorySelection: 'selected' }

describe('groupByInstallation', () => {
  it('groups repositories under their installation, keeping empty installations', () => {
    const api = repository({ id: '9', installationId: '1' })
    const groups = groupByInstallation({ installations: [acme, octo], repositories: [api] })
    expect(groups).toEqual([
      { installation: acme, repos: [api] },
      { installation: octo, repos: [] },
    ])
  })

  it('returns nothing without installations', () => {
    expect(groupByInstallation({ installations: [], repositories: [] })).toEqual([])
  })
})
