import type { Installation, Repository, RepositoryList } from './schemas'

export type InstallationGroupData = { installation: Installation; repos: Repository[] }

// Every installation gets a group, even with zero repos, so Configure stays reachable.
export function groupByInstallation(data: RepositoryList): InstallationGroupData[] {
  return data.installations.map((installation) => ({
    installation,
    repos: data.repositories.filter((r) => r.installationId === installation.id),
  }))
}
