import { Info, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useRepositories } from '@/features/repositories/use-repositories'
import { TopBar } from '@/features/shell/top-bar'
import { useRepoFilter } from '@/features/shell/use-repo-filter'
import { filterRules, type RuleFilter } from './rule-filter'
import { RuleTable } from './rule-table'
import { useRules } from './use-rules'

export function RulesPage() {
  const { repoId, search } = useRepoFilter()
  const { rules, error, setEnabled, remove } = useRules(repoId)
  const { data: repos } = useRepositories()
  const repoNames = useMemo(() => new Map(repos?.repositories.map((r) => [r.id, r.fullName])), [repos])
  const [filter, setFilter] = useState<RuleFilter>('all')
  const [query, setQuery] = useState('')
  const shown = rules ? filterRules(rules, filter, query, repoNames) : null

  return (
    <>
      <TopBar crumbs={[{ label: 'Workspace' }, { label: 'Rules' }]} repoFilter />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Rules</h1>
            <p className="page-subtitle">When an event matches, the bot runs the rule's actions once per delivery.</p>
          </div>
          <div className="page-head-actions">
            <Button asChild>
              <Link to={{ pathname: '/rules/new', search }}>
                <Plus />
                New rule
              </Link>
            </Button>
          </div>
        </div>

        <div className="rules-toolbar">
          <Segmented
            label="Rule state"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: rules?.length },
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
          />
          <label className="search-input rules-search">
            <Search />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rules"
              aria-label="Search rules"
            />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}
        {rules === null && !error && <Skeleton className="table-skeleton" />}
        {rules?.length === 0 && (
          <Empty className="empty-card">
            <EmptyHeader>
              <EmptyTitle>No rules yet</EmptyTitle>
              <EmptyDescription>Rules tell the bot what to do when an issue, pull request or push arrives.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {rules && rules.length > 0 && shown?.length === 0 && <p className="muted-text">No rules match this filter.</p>}
        {shown && shown.length > 0 && (
          <RuleTable rules={shown} repoNames={repoNames} search={search} onToggle={setEnabled} onDelete={remove} />
        )}

        <p className="rules-note">
          <Info />
          Each action runs once per delivery. On retry, actions that already succeeded are skipped.
        </p>
      </div>
    </>
  )
}
