import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/use-me'
import { useSignOut } from '@/features/auth/use-sign-out'
import { EventLog } from '@/features/events/event-log'
import { RepositoryList } from '@/features/repositories/repository-list'

export function DashboardPage() {
  const { me, error } = useMe()
  const signOut = useSignOut()

  return (
    <main className="page">
      <header className="dashboard-header">
        <h1 className="page-title">Dashboard</h1>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </header>
      {me && (
        <p className="user-badge">
          Signed in as <strong>{me.name ?? me.email ?? me.id}</strong>
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      <EventLog />
      <RepositoryList />
    </main>
  )
}
