import { Navigate, Outlet, useLocation } from 'react-router'
import { authClient } from '@/lib/auth-client'

export function ProtectedRoute() {
  const { data, isPending } = authClient.useSession()
  const location = useLocation()

  if (isPending) return <p className="screen-message">Loading…</p>
  if (!data) {
    // Keep path + query (e.g. the GitHub setup callback) so sign-in can return to it.
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}
