import { type Rule, type RuleConditions, type RuleEvent, type RuleInput, ruleInputSchema } from './schemas'

export type ConditionField = 'title' | 'body' | 'author' | 'labels' | 'branch'
export type ConditionOp = 'contains' | 'is' | 'is_not' | 'include'

export interface ConditionRow {
  id: string
  field: ConditionField
  op: ConditionOp
  values: string[]
}

type ListKey = 'titleContains' | 'bodyContains' | 'authors' | 'excludeAuthors' | 'labels' | 'branches'

// Each field + operator pair maps to one list in the stored conditions.
export const CONDITION_KINDS: { field: ConditionField; op: ConditionOp; key: ListKey }[] = [
  { field: 'title', op: 'contains', key: 'titleContains' },
  { field: 'body', op: 'contains', key: 'bodyContains' },
  { field: 'author', op: 'is', key: 'authors' },
  { field: 'author', op: 'is_not', key: 'excludeAuthors' },
  { field: 'labels', op: 'include', key: 'labels' },
  { field: 'branch', op: 'is', key: 'branches' },
]

export const FIELD_LABELS: Record<ConditionField, string> = {
  title: 'Title',
  body: 'Body',
  author: 'Author',
  labels: 'Labels',
  branch: 'Branch',
}

export const OP_LABELS: Record<ConditionOp, string> = {
  contains: 'contains',
  is: 'is',
  is_not: 'is not',
  include: 'include',
}

export interface RuleFormValues {
  repositoryId: string
  name: string
  event: RuleEvent
  // Webhook actions of an existing rule (e.g. reopened); undefined means the default "opened".
  webhookActions: string[] | undefined
  match: 'all' | 'any'
  conditions: ConditionRow[]
  addLabel: boolean
  labels: string[]
  addComment: boolean
  commentBody: string
  slack: boolean
  enabled: boolean
}

export type RuleFormSection = 'name' | 'repositoryId' | 'conditions' | 'labels' | 'commentBody' | 'actions'
export type RuleFormErrors = Partial<Record<RuleFormSection, string>>

let nextId = 0
export const rowId = () => `c${++nextId}`

export function keyFor(field: ConditionField, op: ConditionOp): ListKey | null {
  return CONDITION_KINDS.find((k) => k.field === field && k.op === op)?.key ?? null
}

// Operators offered for a field; the first is the default.
export function opsFor(field: ConditionField): ConditionOp[] {
  return CONDITION_KINDS.filter((k) => k.field === field).map((k) => k.op)
}

// Fields shown for an event: labels only on issues and PRs, branch only on push.
export function fieldsFor(event: RuleEvent): ConditionField[] {
  return event === 'push' ? ['title', 'body', 'author', 'branch'] : ['title', 'body', 'author', 'labels']
}

export function emptyRuleForm(repositoryId = ''): RuleFormValues {
  return {
    repositoryId,
    name: '',
    event: 'issues',
    webhookActions: undefined,
    match: 'all',
    conditions: [{ id: rowId(), field: 'title', op: 'contains', values: [] }],
    addLabel: false,
    labels: [],
    addComment: false,
    commentBody: '',
    slack: true,
    enabled: true,
  }
}

export function ruleToForm(rule: Rule): RuleFormValues {
  const label = rule.actions.find((a) => a.type === 'add_label')
  const comment = rule.actions.find((a) => a.type === 'add_comment')
  const conditions = CONDITION_KINDS.filter((k) => rule.conditions[k.key].length > 0).map((k) => ({
    id: rowId(),
    field: k.field,
    op: k.op,
    values: [...rule.conditions[k.key]],
  }))
  return {
    repositoryId: rule.repositoryId,
    name: rule.name,
    event: rule.event,
    webhookActions: rule.conditions.actions,
    match: rule.conditions.match,
    conditions,
    addLabel: Boolean(label),
    labels: label ? [...label.labels] : [],
    addComment: Boolean(comment),
    commentBody: comment ? comment.body : '',
    slack: rule.actions.some((a) => a.type === 'slack_notify'),
    enabled: rule.enabled,
  }
}

// Rows hidden for the event are dropped; rows for the same list merge without duplicates.
export function formConditions(v: RuleFormValues): RuleConditions {
  const lists: Record<ListKey, string[]> = {
    titleContains: [],
    bodyContains: [],
    authors: [],
    excludeAuthors: [],
    labels: [],
    branches: [],
  }
  const allowed = fieldsFor(v.event)
  for (const row of v.conditions) {
    const key = keyFor(row.field, row.op)
    if (!key || !allowed.includes(row.field)) continue
    for (const value of row.values) if (!lists[key].includes(value)) lists[key].push(value)
  }
  const push = v.event === 'push'
  return {
    ...(!push && v.webhookActions?.length ? { actions: v.webhookActions } : {}),
    match: v.match,
    ...lists,
  }
}

// Push has no issue to label or comment on, so only Slack survives.
export function formToInput(v: RuleFormValues): RuleInput {
  const push = v.event === 'push'
  const actions: RuleInput['actions'] = []
  if (!push && v.addLabel) actions.push({ type: 'add_label', labels: v.labels })
  if (!push && v.addComment) actions.push({ type: 'add_comment', body: v.commentBody })
  if (v.slack) actions.push({ type: 'slack_notify' })
  return { name: v.name, event: v.event, conditions: formConditions(v), actions, enabled: v.enabled }
}

// Maps a zod issue path to the editor section that owns it.
function sectionFor(path: PropertyKey[], input: RuleInput): RuleFormSection {
  const [root, index] = path
  if (root === 'name') return 'name'
  if (root === 'conditions') return 'conditions'
  if (root === 'actions' && typeof index === 'number') {
    const type = input.actions[index]?.type
    if (type === 'add_label') return 'labels'
    if (type === 'add_comment') return 'commentBody'
  }
  return 'actions'
}

export function validateRuleForm(
  v: RuleFormValues,
): { ok: true; input: RuleInput } | { ok: false; errors: RuleFormErrors } {
  const input = formToInput(v)
  const errors: RuleFormErrors = {}
  if (!v.repositoryId) errors.repositoryId = 'choose a repository'
  const parsed = ruleInputSchema.safeParse(input)
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      const section = sectionFor(issue.path, input)
      errors[section] ??= issue.message
    }
  if (!parsed.success || Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, input: parsed.data }
}

// Compares what would be saved, so reordering or empty rows do not count as changes.
export function isDirty(current: RuleFormValues, initial: RuleFormValues): boolean {
  return (
    current.repositoryId !== initial.repositoryId ||
    JSON.stringify(formToInput(current)) !== JSON.stringify(formToInput(initial))
  )
}
