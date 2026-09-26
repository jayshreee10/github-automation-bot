import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useRepositories } from '@/features/repositories/use-repositories'
import { TopBar } from '@/features/shell/top-bar'
import { useRepoFilter } from '@/features/shell/use-repo-filter'
import { ApiError } from '@/lib/api'
import { createRule, deleteRule, fetchRule, updateRule } from './api'
import { RuleEditor } from './rule-editor'
import { emptyRuleForm, ruleToForm } from './rule-form-values'
import type { Rule, RuleInput } from './schemas'

// /rules/new and /rules/:id. A new rule starts on the filtered repo, or none: a silent default hides mistakes.
export function RuleFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { repoId, search } = useRepoFilter()
  const { data: repos, error: reposError } = useRepositories()
  // Tagged with its id, so switching rules never shows the previous one.
  const [loaded, setLoaded] = useState<{ id: string; rule: Rule | null; error: string | null } | null>(null)
  const current = id && loaded?.id === id ? loaded : null

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetchRule(id, controller.signal)
      .then((rule) => setLoaded({ id, rule, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const notFound = err instanceof ApiError && err.status === 404
        setLoaded({ id, rule: null, error: notFound ? 'Rule not found.' : 'Could not load the rule.' })
      })
    return () => controller.abort()
  }, [id])

  const back = () => navigate({ pathname: '/rules', search })

  async function save(repositoryId: string, input: RuleInput) {
    try {
      if (id) await updateRule(id, input)
      else await createRule(repositoryId, input)
      toast.success(id ? 'Rule saved' : 'Rule created')
      back()
    } catch (err) {
      toast.error(err instanceof ApiError && err.detail ? `Not saved: ${err.detail}` : 'Could not save the rule')
    }
  }

  async function remove() {
    if (!id) return
    try {
      await deleteRule(id)
      toast.success('Rule deleted')
      back()
    } catch {
      toast.error('Could not delete the rule')
    }
  }

  const error = current?.error ?? reposError
  if (error || !repos || (id && !current?.rule)) {
    return (
      <>
        <TopBar crumbs={[{ label: 'Rules', to: '/rules' }, { label: id ? 'Rule' : 'New rule' }]} />
        <div className="page">
          {error ? <p className="error-text">{error}</p> : <Skeleton className="editor-skeleton" />}
        </div>
      </>
    )
  }

  return (
    <RuleEditor
      key={id ?? 'new'}
      initial={current?.rule ? ruleToForm(current.rule) : emptyRuleForm(repoId ?? '')}
      repositories={repos.repositories}
      isNew={!id}
      onSave={save}
      onDelete={id ? remove : undefined}
      onCancel={back}
    />
  )
}
