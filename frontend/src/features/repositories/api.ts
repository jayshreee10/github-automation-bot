import { apiFetch } from '@/lib/api'
import { type AppInfo, appInfoSchema, type RepositoryList, repositoryListSchema } from './schemas'

export function fetchRepositories(): Promise<RepositoryList> {
  return apiFetch('/repositories', repositoryListSchema)
}

export function fetchAppInfo(signal?: AbortSignal): Promise<AppInfo> {
  return apiFetch('/app', appInfoSchema, { signal })
}

export function syncInstallation(installationId: string): Promise<RepositoryList> {
  return apiFetch(`/installations/${installationId}/sync`, repositoryListSchema, { method: 'POST' })
}

// The backend verifies the installation belongs to the caller's GitHub account.
export function connectInstallation(installationId: string): Promise<RepositoryList> {
  return apiFetch('/installations', repositoryListSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installationId }),
  })
}
