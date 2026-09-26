import { Copy } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { useStats } from '@/features/events/use-stats'
import { useRepositories } from '@/features/repositories/use-repositories'

// Vercel forwards /api to the backend, so the page's own origin is the public webhook host.
const webhookEndpoint = () => `${window.location.origin}/api/webhooks/github`

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Lucide v1 dropped brand icons; this is its former GitHub outline.
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export function GithubAppCard() {
  const { data: repos } = useRepositories()
  const { data: stats } = useStats(null)
  const endpoint = webhookEndpoint()

  async function copy() {
    try {
      await navigator.clipboard.writeText(endpoint)
      toast.success('Webhook URL copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <section id="github" className="panel settings-card" aria-labelledby="github-title">
      <div className="settings-card-head">
        <span className="settings-icon">
          <GithubIcon />
        </span>
        <div className="panel-head-text">
          <h2 id="github-title" className="section-title">
            GitHub App
          </h2>
          <span className="settings-note">Receives webhooks and acts with short-lived installation tokens.</span>
        </div>
        <Button variant="outline" size="sm" className="settings-head-badge" asChild>
          <Link to="/repositories">Manage repositories</Link>
        </Button>
      </div>
      <div>
        <div className="kv">
          <span className="kv-key">Webhook endpoint</span>
          <span className="settings-kv-value">
            <span className="mono">{endpoint}</span>
            <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy webhook URL" title="Copy webhook URL">
              <Copy />
            </Button>
          </span>
        </div>
        <div className="kv">
          <span className="kv-key">Webhook secret</span>
          {/* The API refuses to boot without it, so reaching this page means it is set. */}
          <StatusBadge tone="success">Configured · HMAC-SHA256</StatusBadge>
        </div>
        <div className="kv">
          <span className="kv-key">Installations</span>
          <span>
            {repos
              ? `${count(repos.installations.length, 'account', 'accounts')} · ${count(repos.repositories.length, 'repository', 'repositories')}`
              : '…'}
          </span>
        </div>
        <div className="kv">
          <span className="kv-key">Catch-up (last 24 h)</span>
          <span>{stats ? `${count(stats.recoveredDeliveries, 'missed delivery', 'missed deliveries')} recovered` : '…'}</span>
        </div>
      </div>
    </section>
  )
}
