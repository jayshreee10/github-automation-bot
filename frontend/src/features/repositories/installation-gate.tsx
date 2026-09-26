import { Navigate, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { useRepositories } from './use-repositories'

// Sends users without a GitHub App installation to /connect instead of the app shell.
export function InstallationGate() {
  const { data, error, reload } = useRepositories()

  if (!data && error) {
    return (
      <main className="auth-screen">
        <section className="setup-card">
          <p className="error-text">{error}</p>
          <Button variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </section>
      </main>
    )
  }
  if (!data) return <p className="screen-message">Loading…</p>
  if (data.installations.length === 0) return <Navigate to="/connect" replace />
  return <Outlet />
}
