import { Check, CircleDot, GitPullRequest, GitCommitHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Repository } from '@/features/repositories/schemas'
import { TopBar } from '@/features/shell/top-bar'
import { ChipInput } from './chip-input'
import { ConditionEditor } from './condition-editor'
import { formToInput, isDirty, type RuleFormErrors, type RuleFormValues, validateRuleForm } from './rule-form-values'
import { ruleEventKeys, ruleSummary, shortRepoName } from './rule-sentence'
import type { RuleEvent, RuleInput } from './schemas'

interface Props {
  initial: RuleFormValues
  repositories: Repository[]
  isNew: boolean
  onSave: (repositoryId: string, input: RuleInput) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

const EVENTS: { event: RuleEvent; label: string; icon: typeof CircleDot }[] = [
  { event: 'issues', label: 'Issue opened', icon: CircleDot },
  { event: 'pull_request', label: 'Pull request opened', icon: GitPullRequest },
  { event: 'push', label: 'Code pushed', icon: GitCommitHorizontal },
]

const FORM_ID = 'rule-editor'

// Create/edit a rule. Validates like the API before saving; the server's 400 message still wins if it disagrees.
export function RuleEditor({ initial, repositories, isNew, onSave, onDelete, onCancel }: Props) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<RuleFormErrors>({})
  const [saving, setSaving] = useState(false)
  const push = values.event === 'push'
  const dirty = isDirty(values, initial)
  const repo = repositories.find((r) => r.id === values.repositoryId)
  const preview = formToInput(values)

  const set = <K extends keyof RuleFormValues>(key: K, value: RuleFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateRuleForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      await onSave(values.repositoryId, result.input)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TopBar
        crumbs={[{ label: 'Rules', to: '/rules' }, { label: values.name.trim() || (isNew ? 'New rule' : 'Rule') }]}
        actions={
          <>
            {dirty && <span className="unsaved-text">Unsaved changes</span>}
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} size="sm" disabled={saving}>
              <Check />
              {saving ? 'Saving…' : 'Save rule'}
            </Button>
          </>
        }
      />
      <form id={FORM_ID} className="rule-editor" onSubmit={submit} noValidate>
        <div className="editor-main">
          <section className="panel editor-basics">
            <div className="editor-field">
              <label className="field-label" htmlFor="rule-name">
                Rule name
              </label>
              <Input
                id="rule-name"
                value={values.name}
                placeholder="e.g. Bug reports"
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={Boolean(errors.name) || undefined}
              />
              {errors.name && <p className="error-text">{errors.name}</p>}
            </div>
            <div className="editor-field">
              <label className="field-label" htmlFor="rule-repo">
                Repository
              </label>
              {/* The API does not move rules between repositories, so it is fixed once saved. */}
              <Select value={values.repositoryId} onValueChange={(v) => set('repositoryId', v)} disabled={!isNew}>
                <SelectTrigger id="rule-repo" className="editor-select" aria-invalid={Boolean(errors.repositoryId) || undefined}>
                  <SelectValue placeholder="Choose a repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {repositories.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.repositoryId && <p className="error-text">{errors.repositoryId}</p>}
            </div>
          </section>

          <section className="panel editor-card" aria-labelledby="rule-when">
            <div className="editor-card-head">
              <span className="step-badge">WHEN</span>
              <h2 id="rule-when" className="section-title">
                This happens
              </h2>
            </div>
            <div className="event-options">
              {EVENTS.map(({ event, label, icon: Icon }) => (
                <button
                  key={event}
                  type="button"
                  className="event-option"
                  aria-pressed={values.event === event}
                  onClick={() => set('event', event)}
                >
                  <span className="event-option-title">
                    <Icon />
                    {label}
                  </span>
                  <span className="mono muted-text">
                    {ruleEventKeys(event, { actions: values.webhookActions }).join(', ')}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <ConditionEditor
            event={values.event}
            match={values.match}
            rows={values.conditions}
            error={errors.conditions}
            onMatch={(m) => set('match', m)}
            onRows={(rows) => set('conditions', rows)}
          />

          <section className="panel editor-card" aria-labelledby="rule-then">
            <div className="editor-card-head">
              <span className="step-badge">THEN</span>
              <h2 id="rule-then" className="section-title">
                Do this
              </h2>
            </div>
            {push && <p className="hint-text">Push events have no issue or pull request to label or comment on.</p>}

            <div className="then-row" data-on={(!push && values.addLabel) || undefined}>
              <Switch
                checked={!push && values.addLabel}
                disabled={push}
                onCheckedChange={(on) => set('addLabel', on)}
                aria-label="Add label"
              />
              <span className="then-name">Add label</span>
              {!push && values.addLabel ? (
                <ChipInput
                  values={values.labels}
                  onChange={(labels) => set('labels', labels)}
                  placeholder="Add label"
                  label="Labels to add"
                  invalid={Boolean(errors.labels)}
                />
              ) : (
                <span className="then-hint">Off · tag the issue or PR with labels</span>
              )}
            </div>
            {errors.labels && <p className="error-text">{errors.labels}</p>}

            <div className="then-row" data-on={(!push && values.addComment) || undefined}>
              <Switch
                checked={!push && values.addComment}
                disabled={push}
                onCheckedChange={(on) => set('addComment', on)}
                aria-label="Post comment"
              />
              <span className="then-name">Post comment</span>
              {!push && values.addComment ? (
                <div className="then-comment">
                  <Textarea
                    value={values.commentBody}
                    onChange={(e) => set('commentBody', e.target.value)}
                    placeholder="Thanks @{author}, we will look at it."
                    aria-label="Comment text"
                    aria-invalid={Boolean(errors.commentBody) || undefined}
                  />
                  <span className="hint-text">Placeholders: {'{author}'}, {'{title}'}, {'{url}'}</span>
                </div>
              ) : (
                <span className="then-hint">Off · reply on the issue or PR with a message</span>
              )}
            </div>
            {errors.commentBody && <p className="error-text">{errors.commentBody}</p>}

            <div className="then-row" data-on={values.slack || undefined}>
              <Switch checked={values.slack} onCheckedChange={(on) => set('slack', on)} aria-label="Send Slack notification" />
              <span className="then-name">Send Slack notification</span>
              <span className="then-hint">Posts the event title, repo and link to Slack</span>
            </div>
            {errors.actions && <p className="error-text">{errors.actions}</p>}
          </section>
        </div>

        <aside className="editor-side">
          <section className="panel panel-padded">
            <h2 className="section-title">Summary</h2>
            <p className="rule-summary">
              {ruleSummary({
                event: preview.event,
                conditions: preview.conditions,
                actions: preview.actions,
                repoName: repo ? shortRepoName(repo.fullName) : null,
              })}
            </p>
          </section>

          <section className="panel enabled-card">
            <span className="enabled-text">
              <span className="enabled-title">Rule enabled</span>
              <span className="hint-text">Runs on new deliveries only</span>
            </span>
            <Switch checked={values.enabled} onCheckedChange={(on) => set('enabled', on)} aria-label="Rule enabled" />
          </section>

          {onDelete && <DeleteRule name={values.name} onDelete={onDelete} />}
        </aside>
      </form>
    </>
  )
}

function DeleteRule({ name, onDelete }: { name: string; onDelete: () => Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className="delete-rule">
          <Trash2 />
          Delete rule
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The bot stops acting on this rule. Its action history is removed with it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
