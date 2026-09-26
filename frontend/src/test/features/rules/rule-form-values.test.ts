import { describe, expect, it } from 'vitest'
import {
  emptyRuleForm,
  fieldsFor,
  formConditions,
  formToInput,
  isDirty,
  opsFor,
  ruleToForm,
  validateRuleForm,
} from '@/features/rules/rule-form-values'
import { rule } from '../../fixtures'

const conditions = (overrides = {}) => ({ ...rule().conditions, titleContains: [], ...overrides })

describe('rule form values', () => {
  it('round-trips a stored rule, keeping excluded authors, match any and custom webhook actions', () => {
    const r = rule({
      conditions: conditions({
        actions: ['opened', 'reopened'],
        match: 'any',
        titleContains: ['bug', 'crash'],
        bodyContains: ['crash'],
        excludeAuthors: ['dependabot[bot]'],
        labels: ['docs'],
      }),
      actions: [{ type: 'add_label', labels: ['bug'] }, { type: 'add_comment', body: 'Thanks {author}' }, { type: 'slack_notify' }],
      enabled: false,
    })
    const form = ruleToForm(r)
    expect(form.conditions.map((c) => [c.field, c.op])).toEqual([
      ['title', 'contains'],
      ['body', 'contains'],
      ['author', 'is_not'],
      ['labels', 'include'],
    ])
    expect(validateRuleForm(form)).toEqual({
      ok: true,
      input: { name: r.name, event: r.event, conditions: r.conditions, actions: r.actions, enabled: false },
    })
  })

  it('round-trips a push rule with branches and drops fields push cannot use', () => {
    const r = rule({ event: 'push', conditions: conditions({ branches: ['main'] }), actions: [{ type: 'slack_notify' }] })
    const form = { ...ruleToForm(r), addLabel: true, labels: ['x'], webhookActions: ['opened'] }
    form.conditions.push({ id: 'l', field: 'labels', op: 'include', values: ['bug'] })
    const input = formToInput(form)
    expect(input.conditions).toEqual({ ...r.conditions, labels: [] })
    expect(input.conditions).not.toHaveProperty('actions')
    expect(input.actions).toEqual([{ type: 'slack_notify' }])
  })

  it('drops branch rows on issue rules and merges duplicate rows without repeats', () => {
    const form = emptyRuleForm('42')
    form.conditions = [
      { id: 'a', field: 'title', op: 'contains', values: ['bug'] },
      { id: 'b', field: 'title', op: 'contains', values: ['bug', 'crash'] },
      { id: 'c', field: 'branch', op: 'is', values: ['main'] },
    ]
    expect(formConditions(form)).toMatchObject({ titleContains: ['bug', 'crash'], branches: [] })
  })

  it('offers labels only for issues and PRs, branch only for push, and author is / is not', () => {
    expect(fieldsFor('issues')).toContain('labels')
    expect(fieldsFor('issues')).not.toContain('branch')
    expect(fieldsFor('push')).toEqual(['title', 'body', 'author', 'branch'])
    expect(opsFor('author')).toEqual(['is', 'is_not'])
  })

  it('maps validation errors to their sections', () => {
    const form = { ...emptyRuleForm(''), addLabel: true, labels: [], slack: false }
    form.conditions = [{ id: 'a', field: 'author', op: 'is_not', values: ['not a user!'] }]
    const result = validateRuleForm(form)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toMatchObject({
      repositoryId: 'choose a repository',
      name: 'give the rule a name',
      labels: 'add at least one label',
      conditions: 'not a GitHub username',
    })
  })

  it('requires at least one action', () => {
    const result = validateRuleForm({ ...emptyRuleForm('42'), name: 'x', slack: false })
    expect(result).toMatchObject({ ok: false, errors: { actions: 'choose at least one action' } })
  })

  it('counts only changes that would be saved as dirty', () => {
    const initial = ruleToForm(rule())
    expect(isDirty({ ...initial, conditions: [...initial.conditions].reverse() }, initial)).toBe(false)
    expect(isDirty({ ...initial, conditions: [...initial.conditions, { id: 'x', field: 'body', op: 'contains', values: [] }] }, initial)).toBe(false)
    expect(isDirty({ ...initial, name: 'Renamed' }, initial)).toBe(true)
  })
})
