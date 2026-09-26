import { emptyRuleForm, type RuleFormValues, rowId } from './rule-form-values'
import type { RuleEvent } from './schemas'

export interface RuleTemplate {
  id: string
  name: string
  description: string
  event: RuleEvent
  // Short previews for the card: the trigger key and the actions.
  when: string
  then: string[]
}

// Starter rules offered in the UI. Nothing is saved until the user reviews one in the editor.
export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'label-bugs',
    name: 'Label bug reports',
    description: 'Issues with "bug" in the title get the bug label.',
    event: 'issues',
    when: 'issues.opened',
    then: ['label: bug'],
  },
  {
    id: 'thank-prs',
    name: 'Thank pull request authors',
    description: 'Comment a thank-you on every new pull request.',
    event: 'pull_request',
    when: 'pull_request.opened',
    then: ['comment'],
  },
  {
    id: 'slack-on-push',
    name: 'Notify Slack on push',
    description: 'Send a Slack alert when code lands on the default branch.',
    event: 'push',
    when: 'push',
    then: ['Slack'],
  },
]

// Editor values for a template, or null for an unknown id. Push targets the repo's default branch when known.
export function templateForm(id: string, repositoryId: string, defaultBranch: string | null): RuleFormValues | null {
  const base = { ...emptyRuleForm(repositoryId), slack: false }
  if (id === 'label-bugs')
    return {
      ...base,
      name: 'Label bug reports',
      conditions: [{ id: rowId(), field: 'title', op: 'contains', values: ['bug'] }],
      addLabel: true,
      labels: ['bug'],
    }
  if (id === 'thank-prs')
    return {
      ...base,
      name: 'Thank pull request authors',
      event: 'pull_request',
      conditions: [{ id: rowId(), field: 'author', op: 'is_not', values: ['dependabot[bot]'] }],
      addComment: true,
      commentBody: 'Thanks @{author} for opening this pull request! A maintainer will review it soon.',
    }
  if (id === 'slack-on-push')
    return {
      ...base,
      name: 'Notify Slack on push',
      event: 'push',
      conditions: [{ id: rowId(), field: 'branch', op: 'is', values: [defaultBranch ?? 'main'] }],
      slack: true,
    }
  return null
}

// Link target for a template, keeping the repo filter.
export function templateSearch(id: string, repoId: string | null): string {
  const params = new URLSearchParams()
  if (repoId) params.set('repo', repoId)
  params.set('template', id)
  return `?${params}`
}
