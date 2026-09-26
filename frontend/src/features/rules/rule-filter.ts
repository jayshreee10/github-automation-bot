import type { Rule } from './schemas'

export type RuleFilter = 'all' | 'enabled' | 'disabled'

// Pure: state tab plus a case-insensitive search over rule and repository names.
export function filterRules(rules: Rule[], filter: RuleFilter, query: string, repoNames: Map<string, string>): Rule[] {
  const q = query.trim().toLowerCase()
  return rules.filter(
    (r) =>
      (filter === 'all' || r.enabled === (filter === 'enabled')) &&
      (!q || r.name.toLowerCase().includes(q) || (repoNames.get(r.repositoryId) ?? '').toLowerCase().includes(q)),
  )
}
