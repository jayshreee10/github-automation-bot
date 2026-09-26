import { describe, expect, it } from 'vitest'
import { filterRules } from '@/features/rules/rule-filter'
import {
  actionChips,
  anyEventText,
  conditionSentence,
  ruleEventKeys,
  ruleSummary,
  shortRepoName,
} from '@/features/rules/rule-sentence'
import { rule } from '../../fixtures'

const c = (overrides = {}) => ({ ...rule().conditions, titleContains: [], ...overrides })

describe('rule sentences', () => {
  it('joins conditions with "and" and always appends excluded authors', () => {
    expect(conditionSentence('issues', c({ titleContains: ['bug', 'crash'], excludeAuthors: ['dependabot[bot]'] }))).toBe(
      'title contains "bug" or "crash" and author is not dependabot[bot]',
    )
  })

  it('reads match any as "or" and merges identical title and body keywords', () => {
    expect(conditionSentence('issues', c({ match: 'any', titleContains: ['security', 'leak'], bodyContains: ['security', 'leak'] }))).toBe(
      'title or body contains "security" or "leak"',
    )
    expect(conditionSentence('issues', c({ match: 'any', titleContains: ['bug'], authors: ['alice'], excludeAuthors: ['bot'] }))).toBe(
      '(title contains "bug" or author is alice) and author is not bot',
    )
  })

  it('is empty without conditions and ignores branches outside push', () => {
    expect(conditionSentence('issues', c({ branches: ['main'] }))).toBe('')
    expect(conditionSentence('push', c({ branches: ['main'] }))).toBe('branch is main')
    expect(anyEventText('pull_request')).toBe('Any pull request')
  })

  it('names the webhook events and action chips', () => {
    expect(ruleEventKeys('issues', {})).toEqual(['issues.opened'])
    expect(ruleEventKeys('pull_request', { actions: ['opened', 'reopened'] })).toEqual(['pull_request.opened', 'pull_request.reopened'])
    expect(ruleEventKeys('push', { actions: ['opened'] })).toEqual(['push'])
    expect(actionChips([{ type: 'add_label', labels: ['bug'] }, { type: 'add_comment', body: 'x' }, { type: 'slack_notify' }])).toEqual([
      'label: bug',
      'comment',
      'Slack',
    ])
  })

  it('writes the editor summary', () => {
    expect(
      ruleSummary({
        event: 'issues',
        conditions: c({ titleContains: ['bug', 'crash'], excludeAuthors: ['dependabot[bot]'] }),
        actions: [{ type: 'add_label', labels: ['bug'] }, { type: 'slack_notify' }],
        repoName: 'test-bot',
      }),
    ).toBe(
      'When an issue is opened in test-bot, and the title contains "bug" or "crash" and author is not dependabot[bot]: add label bug and send a Slack notification.',
    )
    expect(ruleSummary({ event: 'push', conditions: c(), actions: [], repoName: null })).toBe('When code is pushed: do nothing yet.')
    expect(shortRepoName('acme/api')).toBe('api')
  })

  it('filters by state and searches rule and repo names', () => {
    const rules = [rule({ id: 'a', name: 'Bug triage' }), rule({ id: 'b', name: 'Docs', enabled: false, repositoryId: '43' })]
    const names = new Map([
      ['42', 'acme/api'],
      ['43', 'acme/web'],
    ])
    expect(filterRules(rules, 'enabled', '', names).map((r) => r.id)).toEqual(['a'])
    expect(filterRules(rules, 'disabled', '', names).map((r) => r.id)).toEqual(['b'])
    expect(filterRules(rules, 'all', 'WEB', names).map((r) => r.id)).toEqual(['b'])
    expect(filterRules(rules, 'all', 'triage', names).map((r) => r.id)).toEqual(['a'])
  })
})
