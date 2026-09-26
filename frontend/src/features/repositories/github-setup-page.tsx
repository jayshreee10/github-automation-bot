import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '@/lib/api'
import { connectInstallation } from './api'

// GitHub installation ids are positive integers; anything else is a broken or tampered link.
const INSTALLATION_ID = /^[1-9][0-9]{0,18}$/

// GitHub's Setup URL lands here after install or configure. The backend verifies ownership.
export function GithubSetupPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const sentFor = useRef<string | null>(null)
  const raw = params.get('installation_id')
  const installationId = raw && INSTALLATION_ID.test(raw) ? raw : null

  useEffect(() => {
    // StrictMode runs effects twice in dev; send once per installation id.
    if (!installationId || sentFor.current === installationId) return
    sentFor.current = installationId
    connectInstallation(installationId)
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError && err.status === 403
            ? 'This installation is not on your GitHub account.'
            : 'Could not connect the installation. Please try again.',
        ),
      )
  }, [installationId, navigate])

  if (!installationId) {
    return (
      <main className="auth-screen">
        <section className="setup-card">
          <p className="error-text">
            {raw ? 'This setup link is not valid.' : 'No installation found in the link.'}
          </p>
          <Link className="setup-link" to="/">Back to dashboard</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-screen">
      <section className="setup-card">
        {error ? (
          <>
            <p className="error-text">{error}</p>
            <Link className="setup-link" to="/">Back to dashboard</Link>
          </>
        ) : (
          <p className="login-subtitle">Connecting your repositories…</p>
        )}
      </section>
    </main>
  )
}
