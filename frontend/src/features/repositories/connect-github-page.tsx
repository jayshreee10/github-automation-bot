import { Bot } from 'lucide-react'
import { Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSignOut } from '@/features/auth/use-sign-out'
import { INSTALL_URL } from './github-urls'
import { useRepositories } from './use-repositories'

// First stop after sign-in until the GitHub App is installed. GitHub returns to /github/setup.
export function ConnectGithubPage() {
  const { data } = useRepositories()
  const signOut = useSignOut()

  if (data && data.installations.length > 0) return <Navigate to="/" replace />

  return (
    <main className="auth-screen">
      <section className="connect-card">
        <span className="login-logo-mark">
          <Bot />
        </span>
        <div className="login-card-head">
          <h1 className="login-title">Connect your repositories</h1>
          <p className="login-subtitle">
            Install the GitHub App and pick the repos the bot may watch. You can change this later on GitHub.
          </p>
        </div>
        <Button size="lg" className="login-button" asChild>
          <a href={INSTALL_URL}>Install GitHub App</a>
        </Button>
        <button type="button" className="setup-link" onClick={signOut}>
          Sign out
        </button>
      </section>
    </main>
  )
}
