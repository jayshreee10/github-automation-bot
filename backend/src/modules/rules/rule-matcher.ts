import type { RepoEvent } from '../events/repo-event.js';
import type { RuleDefinition } from './rule.schema.js';

const DEFAULT_ACTIONS = ['opened'];

// Pure: no I/O, so the same check can later power a rule preview. Empty lists are ignored.
export function matches(
  rule: Pick<RuleDefinition, 'event' | 'conditions'>,
  event: RepoEvent,
): boolean {
  if (rule.event !== event.event) return false;
  const c = rule.conditions;

  if (event.event !== 'push') {
    const actions = c.actions ?? DEFAULT_ACTIONS;
    if (!event.action || !actions.includes(event.action)) return false;
  }
  if (event.event === 'push' && c.branches.length) {
    const branch = event.ref?.replace(/^refs\/heads\//, '') ?? '';
    if (!c.branches.includes(branch)) return false;
  }
  if (anyEqual(c.excludeAuthors, [event.actor])) return false;

  // Only non-empty lists count; with none, the rule matches every event of its type.
  const checks = [
    c.titleContains.length ? anyWord(c.titleContains, event.title) : null,
    c.bodyContains.length ? anyWord(c.bodyContains, event.body) : null,
    c.authors.length ? anyEqual(c.authors, [event.actor]) : null,
    c.labels.length ? anyEqual(c.labels, event.labels) : null,
  ].filter((r) => r !== null);
  if (!checks.length) return true;
  return c.match === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}

function anyWord(keywords: string[], text: string): boolean {
  return keywords.some((k) => wordPattern(k).test(text));
}

// Case-insensitive, as GitHub logins and label names are.
function anyEqual(wanted: string[], actual: string[]): boolean {
  const have = new Set(actual.map((a) => a.toLowerCase()));
  return wanted.some((w) => have.has(w.toLowerCase()));
}

// Whole word, case-insensitive: "bug" matches "Bug:" but not "debug". Unicode-aware, keyword escaped.
function wordPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');
}
