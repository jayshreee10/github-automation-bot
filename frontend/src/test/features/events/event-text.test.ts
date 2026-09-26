import { describe, expect, it } from 'vitest'
import {
  actionChipText,
  authorHandle,
  conditionSegments,
  payloadExcerpt,
  repoShortName,
  subjectTitle,
} from '@/features/events/event-text'
import type { EventDetail } from '@/features/events/schemas'
import type { RuleConditions } from '@/features/rules/schemas'

const conditions = (c: Partial<RuleConditions> = {}): RuleConditions => ({
  match: 'all',
  titleContains: [],
  bodyContains: [],
  authors: [],
  excludeAuthors: [],
  labels: [],
  branches: [],
  ...c,
})
const text = (c: RuleConditions) => conditionSegments(c).map((s) => s.text).join('')

describe('event text', () => {
  it('builds subject titles for issues, pushes with and without a message', () => {
    const base = { url: null, author: null, ref: null }
    expect(subjectTitle({ ...base, title: 'bug: crash', number: 42 })).toBe('#42 bug: crash')
    expect(subjectTitle({ ...base, title: 'fix: x', number: null, ref: 'main' })).toBe('fix: x')
    expect(subjectTitle({ ...base, title: null, number: null, ref: 'main' })).toBe('Push to main')
    expect(subjectTitle({ ...base, title: null, number: null })).toBe('(no title)')
  })

  it('prefixes humans with @ but not bots, and shortens repo names', () => {
    expect(authorHandle('alice')).toBe('@alice')
    expect(authorHandle('dependabot[bot]')).toBe('dependabot[bot]')
    expect(authorHandle(null)).toBeNull()
    expect(repoShortName('acme/api')).toBe('api')
  })

  it('names action chips like the design', () => {
    expect(actionChipText({ type: 'add_label', status: 'succeeded', labels: ['bug', 'ui'] })).toBe('label: bug, ui')
    expect(actionChipText({ type: 'add_label', status: 'pending', labels: null })).toBe('label')
    expect(actionChipText({ type: 'add_comment', status: 'succeeded', labels: null })).toBe('comment')
    expect(actionChipText({ type: 'slack_notify', status: 'failed', labels: null })).toBe('Slack')
  })

  it('joins conditions with "and" for match all and "or" for match any; excluded authors always apply', () => {
    expect(text(conditions({ titleContains: ['bug', 'crash'], excludeAuthors: ['dependabot[bot]'] }))).toBe(
      'title contains "bug" or "crash" and author is not dependabot[bot]',
    )
    expect(text(conditions({ match: 'any', titleContains: ['security'], bodyContains: ['leak'] }))).toBe(
      'title contains "security" or body contains "leak"',
    )
    expect(text(conditions({ excludeAuthors: ['bot'] }))).toBe('author is not bot')
    expect(text(conditions())).toBe('every event of this type')
    const values = conditionSegments(conditions({ labels: ['docs'] })).filter((s) => s.value)
    expect(values.map((s) => s.text)).toEqual(['docs'])
  })

  it('rebuilds a small payload excerpt from the summary, trimming long titles', () => {
    const detail = {
      event: 'issues',
      action: 'opened',
      repository: { id: '42', fullName: 'acme/api' },
      summary: { title: 'x'.repeat(50), number: 7, url: null, author: 'alice', ref: null },
    } as EventDetail
    const json = JSON.parse(payloadExcerpt(detail))
    expect(json).toEqual({
      action: 'opened',
      issue: { number: 7, title: `${'x'.repeat(40)}…`, user: { login: 'alice' } },
      repository: { full_name: 'acme/api' },
    })
    const push = JSON.parse(
      payloadExcerpt({ ...detail, event: 'push', action: null, summary: { ...detail.summary, title: 'fix', ref: 'main' } }),
    )
    expect(push).toEqual({ ref: 'main', head_commit: { message: 'fix' }, sender: { login: 'alice' }, repository: { full_name: 'acme/api' } })
  })
})

describe('rulesNotRunYet', () => {
  it('is true until the job succeeds, and false with no job', async () => {
    const { rulesNotRunYet } = await import('@/features/events/event-text')
    for (const status of ['pending', 'running', 'failed', 'dead']) expect(rulesNotRunYet({ status })).toBe(true)
    expect(rulesNotRunYet({ status: 'succeeded' })).toBe(false)
    expect(rulesNotRunYet(null)).toBe(false)
  })
})
