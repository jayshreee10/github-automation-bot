import { Moon, Sun } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useRepositories } from '@/features/repositories/use-repositories'
import { useTheme } from '@/lib/theme'
import { RepoFilter } from './repo-filter'
import { useRepoFilter } from './use-repo-filter'

export interface Crumb {
  label: string
  to?: string
}

interface Props {
  crumbs: Crumb[]
  // Shows the "Live · refreshes every 5s" pill on pages that poll.
  live?: boolean
  repoFilter?: boolean
  // Replaces the default right side (e.g. the rule editor's Cancel / Save).
  actions?: React.ReactNode
}

// Each page renders its own top bar, so page-specific actions sit next to the breadcrumb.
export function TopBar({ crumbs, live, repoFilter, actions }: Props) {
  const { theme, toggle } = useTheme()
  const { search } = useRepoFilter()

  return (
    <header className="top-bar">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.to ? (
              <Link className="crumb-link" to={{ pathname: c.to, search }}>
                {c.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'crumb-current' : 'crumb'} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                {c.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="top-bar-actions">
        {actions ?? (
          <>
            {live && (
              <span className="live-pill">
                <span className="pulse-dot" />
                Live · refreshes every 5s
              </span>
            )}
            {repoFilter && <TopBarRepoFilter />}
            <Button variant="outline" size="icon-sm" onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

function TopBarRepoFilter() {
  const { data } = useRepositories()
  return <RepoFilter repositories={data?.repositories ?? []} />
}
