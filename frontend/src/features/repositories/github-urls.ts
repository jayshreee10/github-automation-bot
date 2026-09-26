import { env } from '@/lib/env'
import type { Installation } from './schemas'

export const INSTALL_URL = `https://github.com/apps/${env.VITE_GITHUB_APP_SLUG}/installations/new`

// GitHub keeps organisation installations under the org's settings, personal ones under the user's.
export function configureInstallationUrl(installation: Pick<Installation, 'id' | 'accountLogin' | 'accountType'>): string {
  const id = encodeURIComponent(installation.id)
  return installation.accountType === 'Organization'
    ? `https://github.com/organizations/${encodeURIComponent(installation.accountLogin)}/settings/installations/${id}`
    : `https://github.com/settings/installations/${id}`
}

export const repositoryUrl = (fullName: string) => `https://github.com/${fullName}`
