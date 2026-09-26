import { describe, expect, it } from 'vitest'
import { formToInput } from '@/features/rules/rule-form-values'
import { RULE_TEMPLATES, templateForm, templateSearch } from '@/features/rules/rule-templates'
import { ruleInputSchema } from '@/features/rules/schemas'

describe('rule templates', () => {
  it('gives a valid rule for every template', () => {
    for (const t of RULE_TEMPLATES) {
      const form = templateForm(t.id, '42', 'main')!
      expect(form.event).toBe(t.event)
      expect(ruleInputSchema.safeParse(formToInput(form)).success).toBe(true)
    }
  })

  it("pushes to the repo's default branch, falling back to main", () => {
    expect(formToInput(templateForm('slack-on-push', '42', 'develop')!).conditions.branches).toEqual(['develop'])
    expect(formToInput(templateForm('slack-on-push', '', null)!).conditions.branches).toEqual(['main'])
  })

  it('ignores unknown ids and keeps the repo filter in links', () => {
    expect(templateForm('nope', '42', null)).toBeNull()
    expect(templateSearch('label-bugs', '42')).toBe('?repo=42&template=label-bugs')
    expect(templateSearch('label-bugs', null)).toBe('?template=label-bugs')
  })
})
