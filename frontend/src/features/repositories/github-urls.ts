import { env } from '@/lib/env'

export const INSTALL_URL = `https://github.com/apps/${env.VITE_GITHUB_APP_SLUG}/installations/new`

export const manageInstallationUrl = (installationId: string) =>
  `https://github.com/settings/installations/${installationId}`

export const repositoryUrl = (fullName: string) => `https://github.com/${fullName}`
