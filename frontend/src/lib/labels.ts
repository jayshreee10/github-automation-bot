// Display names shared by the event, rule and failure views.
export const ACTION_LABELS: Record<string, string> = {
  add_label: 'Label',
  add_comment: 'Comment',
  slack_notify: 'Slack',
  ai_triage: 'AI triage',
}

// Longer names for lists and breakdowns, as in the design ("Add label", "Slack notification").
export const ACTION_NAMES: Record<string, string> = {
  add_label: 'Add label',
  add_comment: 'Post comment',
  slack_notify: 'Slack notification',
  ai_triage: 'AI triage',
}

export const EVENT_LABELS: Record<string, string> = {
  issues: 'Issue',
  pull_request: 'Pull request',
  push: 'Push',
}

export function eventLabel(event: string, action: string | null): string {
  const name = EVENT_LABELS[event] ?? event
  return action ? `${name} ${action.replaceAll('_', ' ')}` : name
}
