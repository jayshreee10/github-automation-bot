import { describe, expect, it } from 'vitest'
import { INSTALL_URL, manageInstallationUrl, repositoryUrl } from './github-urls'

describe('github-urls', () => {
  it('builds the install URL from the App slug', () => {
    expect(INSTALL_URL).toBe('https://github.com/apps/test-bot/installations/new')
  })

  it('builds manage and repository URLs', () => {
    expect(manageInstallationUrl('42')).toBe('https://github.com/settings/installations/42')
    expect(repositoryUrl('acme/api')).toBe('https://github.com/acme/api')
  })
})
