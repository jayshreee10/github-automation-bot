import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { type Me, meSchema } from '@/lib/schemas'

export function DashboardPage() {
  const navigate = useNavigate()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Round-trips through the backend guard, proving the JWT is accepted server-side.
  useEffect(() => {
    apiFetch('/me', meSchema)
      .then(setMe)
      .catch(() => setError('Could not load your profile from the API.'))
  }, [])

  async function signOut() {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }

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
    </main>
  )
}
