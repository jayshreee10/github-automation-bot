import { ExternalLink } from 'lucide-react'
import { Chip } from '@/components/chip'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { initials } from '@/lib/initials'
import { repoShortName } from '@/lib/repo-name'
import { shortAge } from '@/lib/time'
import { configureInstallationUrl, repositoryUrl } from './github-urls'
import type { InstallationGroupData } from './group-by-installation'
import { installationDetail } from './installation-detail'
import type { Repository } from './schemas'

function repoMeta(r: Repository): string {
  return [r.isPrivate ? 'Private' : 'Public', r.defaultBranch].filter(Boolean).join(' · ')
}

export function InstallationCard({ group, events }: { group: InstallationGroupData; events: string[] }) {
  const { installation, repos } = group
  return (
    <section className="panel installation-card" aria-label={installation.accountLogin}>
      <div className="installation-head">
        <span className="installation-avatar">{initials(installation.accountLogin)}</span>
        <div className="installation-text">
          <span className="installation-login">{installation.accountLogin}</span>
          <span className="installation-detail">{installationDetail(installation)}</span>
        </div>
        <Button variant="outline" size="sm" className="installation-configure" asChild>
          <a href={configureInstallationUrl(installation)} target="_blank" rel="noreferrer">
            Configure on GitHub
            <ExternalLink />
          </a>
        </Button>
      </div>

      {repos.length === 0 ? (
        <p className="installation-empty">
          No repositories visible. Check the App's repository access on GitHub, then Sync from GitHub.
        </p>
      ) : (
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Repository</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Last event</TableHead>
              <TableHead className="repo-status-head">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repos.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="repo-cell">
                    <a className="repo-name" href={repositoryUrl(r.fullName)} target="_blank" rel="noreferrer" title={r.fullName}>
                      {repoShortName(r.fullName)}
                    </a>
                    <span className="repo-meta">{repoMeta(r)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="chip-row">
                    {events.map((e) => (
                      <Chip key={e}>{e}</Chip>
                    ))}
                  </span>
                </TableCell>
                <TableCell>{r.ruleCount}</TableCell>
                <TableCell className="repo-last-event">
                  {r.lastEventAt ? (
                    <time dateTime={r.lastEventAt} title={r.lastEventAt}>
                      {shortAge(r.lastEventAt)} ago
                    </time>
                  ) : (
                    'No events yet'
                  )}
                </TableCell>
                <TableCell className="repo-status-cell">
                  {r.lastEventAt ? (
                    <StatusBadge tone="success">Receiving</StatusBadge>
                  ) : (
                    <StatusBadge tone="muted">Waiting for events</StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
