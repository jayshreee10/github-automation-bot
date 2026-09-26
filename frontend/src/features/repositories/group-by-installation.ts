import type { Repository, RepositoryList } from './schemas'

export type InstallationGroupData = { installationId: string; accountLogin: string; repos: Repository[] }

// Every installation gets a group, even with zero repos, so Sync / Manage stay reachable.
export function groupByInstallation(data: RepositoryList): InstallationGroupData[] {
  return data.installations.map((i) => ({
    installationId: i.id,
    accountLogin: i.accountLogin,
    repos: data.repositories.filter((r) => r.installationId === i.id),
  }))
}
