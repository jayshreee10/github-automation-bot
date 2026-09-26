import { TopBar } from '@/features/shell/top-bar'
import { AccountCard } from './account-card'
import { GithubAppCard } from './github-app-card'
import { SlackCard } from './slack-card'
import { useSlackSettings } from './use-slack-settings'

const SECTIONS = [
  { id: 'slack', label: 'Slack' },
  { id: 'github', label: 'GitHub App' },
  { id: 'account', label: 'Account' },
]

export function SettingsPage() {
  const slack = useSlackSettings()

  return (
    <>
      <TopBar crumbs={[{ label: 'Configure' }, { label: 'Settings' }]} />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Notification channel, GitHub connection and your account.</p>
          </div>
        </div>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="settings-nav-link">
                {s.label}
              </a>
            ))}
          </nav>
          <div className="settings-sections">
            <SlackCard data={slack.data} error={slack.error} onSave={slack.save} />
            <GithubAppCard />
            <AccountCard />
          </div>
        </div>
      </div>
    </>
  )
}
