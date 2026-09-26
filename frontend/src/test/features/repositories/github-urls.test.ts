import { describe, expect, it } from 'vitest'
import { configureInstallationUrl, INSTALL_URL, repositoryUrl } from '@/features/repositories/github-urls'

describe('github-urls', () => {
  it('builds the install URL from the App slug', () => {
    expect(INSTALL_URL).toBe('https://github.com/apps/test-bot/installations/new')
  })

  it('configures a personal installation under the user settings', () => {
    expect(configureInstallationUrl({ id: '42', accountLogin: 'alice', accountType: 'User' })).toBe(
      'https://github.com/settings/installations/42',
    )
    expect(configureInstallationUrl({ id: '42', accountLogin: 'alice', accountType: null })).toBe(
      'https://github.com/settings/installations/42',
    )
  })

  it('configures an organisation installation under the org settings', () => {
    expect(configureInstallationUrl({ id: '7', accountLogin: 'acme', accountType: 'Organization' })).toBe(
      'https://github.com/organizations/acme/settings/installations/7',
    )
  })

  it('builds repository URLs', () => {
    expect(repositoryUrl('acme/api')).toBe('https://github.com/acme/api')
  })
})
