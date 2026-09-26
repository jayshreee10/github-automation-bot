import type { RuleAction, RuleConditions, RuleEvent } from './schemas'

const DEFAULT_ACTIONS = ['opened']

const quote = (values: string[]) => values.map((v) => `"${v}"`).join(' or ')
const plain = (values: string[]) => values.join(' or ')

// Webhook event names a rule reacts to, e.g. ["issues.opened"] or ["push"].
export function ruleEventKeys(event: RuleEvent, conditions: Pick<RuleConditions, 'actions'>): string[] {
  if (event === 'push') return ['push']
  return (conditions.actions ?? DEFAULT_ACTIONS).map((a) => `${event}.${a}`)
}

// Shown when a rule has no conditions and matches every event of its type.
export function anyEventText(event: RuleEvent): string {
  if (event === 'issues') return 'Any issue'
  if (event === 'pull_request') return 'Any pull request'
  return 'Any push'
}

// The positive conditions as phrases. With match "any", identical title and body lists read "title or body contains".
function positiveParts(c: RuleConditions): string[] {
  const parts: string[] = []
  const sameText =
    c.match === 'any' && c.titleContains.length > 0 && c.titleContains.join('\n') === c.bodyContains.join('\n')
  if (sameText) parts.push(`title or body contains ${quote(c.titleContains)}`)
  else {
    if (c.titleContains.length) parts.push(`title contains ${quote(c.titleContains)}`)
    if (c.bodyContains.length) parts.push(`body contains ${quote(c.bodyContains)}`)
  }
  if (c.authors.length) parts.push(`author is ${plain(c.authors)}`)
  if (c.labels.length) parts.push(`labels include ${plain(c.labels)}`)
  if (c.branches.length) parts.push(`branch is ${plain(c.branches)}`)
  return parts
}

// Readable conditions, e.g. 'title contains "bug" or "crash" and author is not dependabot[bot]'. Empty when none.
export function conditionSentence(event: RuleEvent, conditions: RuleConditions): string {
  const parts = positiveParts({ ...conditions, branches: event === 'push' ? conditions.branches : [] })
  const joined = parts.join(conditions.match === 'any' ? ' or ' : ' and ')
  const excluded = conditions.excludeAuthors.length ? `author is not ${plain(conditions.excludeAuthors)}` : ''
  if (!excluded) return joined
  if (!joined) return excluded
  return parts.length > 1 && conditions.match === 'any' ? `(${joined}) and ${excluded}` : `${joined} and ${excluded}`
}

// Compact chips for the rules table: "label: bug", "comment", "Slack".
export function actionChips(actions: RuleAction[]): string[] {
  return actions.map((a) => {
    if (a.type === 'add_label') return `label: ${a.labels.join(', ')}`
    if (a.type === 'add_comment') return 'comment'
    return 'Slack'
  })
}

const WHEN: Record<RuleEvent, string> = {
  issues: 'an issue is',
  pull_request: 'a pull request is',
  push: 'code is pushed',
}

function whenText(event: RuleEvent, actions: string[] | undefined): string {
  if (event === 'push') return WHEN.push
  return `${WHEN[event]} ${(actions ?? DEFAULT_ACTIONS).join(' or ')}`
}

function actionText(a: RuleAction): string {
  if (a.type === 'add_label') return `add ${a.labels.length === 1 ? 'label' : 'labels'} ${a.labels.join(', ')}`
  if (a.type === 'add_comment') return 'post a comment'
  return 'send a Slack notification'
}

function listText(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

// Editor summary, e.g. "When an issue is opened in test-bot, and the title contains "bug": add label bug."
export function ruleSummary(rule: {
  event: RuleEvent
  conditions: RuleConditions
  actions: RuleAction[]
  repoName: string | null
}): string {
  const where = rule.repoName ? ` in ${rule.repoName}` : ''
  const cond = conditionSentence(rule.event, rule.conditions)
  const then = rule.actions.length ? listText(rule.actions.map(actionText)) : 'do nothing yet'
  return `When ${whenText(rule.event, rule.conditions.actions)}${where}${cond ? `, and the ${cond}` : ''}: ${then}.`
}

// "acme/api" → "api": the design shows the short repo name under each rule.
export function shortRepoName(fullName: string): string {
  return fullName.split('/').at(-1) ?? fullName
}
