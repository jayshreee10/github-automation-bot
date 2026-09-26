import type { Installation } from './schemas'

// Used until the App's own event list has loaded (or if it fails).
export const DEFAULT_EVENTS = ['issues', 'pull_request', 'push']

// "Personal account · installation 58213904 · selected repos"
export function installationDetail(i: Installation): string {
  const account = i.accountType === 'Organization' ? 'Organization' : i.accountType === 'User' ? 'Personal account' : 'Account'
  const selection = i.repositorySelection === 'all' ? 'all repos' : i.repositorySelection === 'selected' ? 'selected repos' : null
  return [account, `installation ${i.id}`, selection].filter(Boolean).join(' · ')
}
