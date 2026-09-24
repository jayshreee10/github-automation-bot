import { Navigate, Outlet } from 'react-router'
import { authClient } from '@/lib/auth-client'

export function ProtectedRoute() {
  const { data, isPending } = authClient.useSession()

  if (isPending) return <p className="screen-message">Loading…</p>
  if (!data) return <Navigate to="/login" replace />
  return <Outlet />
}
