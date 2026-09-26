import type { RuleConditions } from '@/features/rules/schemas'
import { ACTION_LABELS } from '@/lib/labels'
import type { EventDetail, EventItem, EventSummary } from './schemas'

// "#42 bug: crash" for issues and PRs; the commit message (or branch) for a push.
export function subjectTitle(summary: EventSummary): string {
  const title = summary.title ?? (summary.ref ? `Push to ${summary.ref}` : '(no title)')
  return summary.number ? `#${summary.number} ${title}` : title
}

// GitHub logins get an @; bot accounts ("dependabot[bot]") are shown as-is, like the design.
export function authorHandle(author: string | null): string | null {
  if (!author) return null
  return author.endsWith('[bot]') ? author : `@${author}`
}

export function repoShortName(fullName: string): string {
  return fullName.split('/').at(-1) ?? fullName
}

// Chip text for one action: "label: bug", "comment", "Slack".
export function actionChipText(action: EventItem['actions'][number]): string {
  if (action.type === 'add_label') return action.labels?.length ? `label: ${action.labels.join(', ')}` : 'label'
  if (action.type === 'add_comment') return 'comment'
  return ACTION_LABELS[action.type] ?? action.type
}

export interface Segment {
  text: string
  value?: boolean
}

const quoted = (words: string[]) => words.map((w) => `"${w}"`)

// Readable rule conditions as text/value segments, e.g. title contains "bug" and author is not dependabot[bot].
export function conditionSegments(c: RuleConditions): Segment[] {
  const clauses: Segment[][] = []
  const clause = (lead: string, values: string[], joiner = ' or ') => {
    if (!values.length) return
    const parts: Segment[] = [{ text: `${lead} ` }]
    values.forEach((v, i) => {
      if (i > 0) parts.push({ text: joiner })
      parts.push({ text: v, value: true })
    })
    clauses.push(parts)
  }
  clause('title contains', quoted(c.titleContains))
  clause('body contains', quoted(c.bodyContains))
  clause('author is', c.authors)
  clause('labels include', c.labels)
  clause('branch is', c.branches)

  const out: Segment[] = []
  clauses.forEach((parts, i) => {
    if (i > 0) out.push({ text: c.match === 'any' ? ' or ' : ' and ' })
    out.push(...parts)
  })
  if (c.excludeAuthors.length) {
    const excluded: Segment[] = []
    c.excludeAuthors.forEach((a, i) => {
      if (i > 0) excluded.push({ text: ', ' })
      excluded.push({ text: a, value: true })
    })
    out.push({ text: out.length ? ' and author is not ' : 'author is not ' }, ...excluded)
  }
  return out.length ? out : [{ text: 'every event of this type' }]
}

const TITLE_MAX = 40

// A small JSON view rebuilt from the summary. The raw payload never leaves the API.
export function payloadExcerpt(d: EventDetail): string {
  const s = d.summary
  const title = s.title && s.title.length > TITLE_MAX ? `${s.title.slice(0, TITLE_MAX)}…` : s.title
  const repository = { full_name: d.repository.fullName }
  if (d.event === 'push') {
    return JSON.stringify(
      { ref: s.ref, head_commit: { message: title }, sender: { login: s.author }, repository },
      null,
      2,
    )
  }
  const key = d.event === 'pull_request' ? 'pull_request' : 'issue'
  return JSON.stringify(
    { action: d.action, [key]: { number: s.number, title, user: { login: s.author } }, repository },
    null,
    2,
  )
}
