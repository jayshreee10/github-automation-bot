import { z } from 'zod'
import { apiFetch, apiSend, jsonInit, query } from '@/lib/api'
import { type Rule, type RuleInput, ruleSchema } from './schemas'

export function fetchRules(repositoryId: string | null, signal?: AbortSignal): Promise<Rule[]> {
  return apiFetch(`/rules${query({ repositoryId })}`, z.array(ruleSchema), { signal })
}

export function fetchRule(id: string, signal?: AbortSignal): Promise<Rule> {
  return apiFetch(`/rules/${encodeURIComponent(id)}`, ruleSchema, { signal })
}

export function createRule(repositoryId: string, input: RuleInput): Promise<Rule> {
  return apiFetch('/rules', ruleSchema, jsonInit('POST', { ...input, repositoryId }))
}

export function updateRule(id: string, input: Partial<RuleInput>): Promise<Rule> {
  return apiFetch(`/rules/${encodeURIComponent(id)}`, ruleSchema, jsonInit('PATCH', input))
}

export function deleteRule(id: string): Promise<void> {
  return apiSend(`/rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
