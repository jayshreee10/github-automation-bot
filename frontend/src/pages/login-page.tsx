import { useState } from 'react'
import { Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function LoginPage() {
  const { data, isPending } = authClient.useSession()
  const [error, setError] = useState<string | null>(null)

  if (isPending) return <p className="screen-message">Loading…</p>
  if (data) return <Navigate to="/" replace />

  // callbackURL must be absolute and listed in Neon Auth trusted domains.
  async function signIn() {
    setError(null)
    const { error } = await authClient.signIn.social({
      provider: 'github',
      callbackURL: `${window.location.origin}/`,
    })
    if (error) setError('Sign-in failed. Please try again.')
  }

  return (
    <main className="auth-screen">
      <section className="login-card">
        <h1 className="login-title">GitHub Automation Bot</h1>
        <p className="login-subtitle">Sign in to manage your repositories and rules.</p>
        <Button className="login-button" onClick={signIn}>
          Sign in with GitHub
        </Button>
        {error && <p className="error-text">{error}</p>}
      </section>
    </main>
  )
}
