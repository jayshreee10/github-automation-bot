import { useNavigate } from 'react-router'
import { authClient } from '@/lib/auth-client'

// Ends the Neon Auth session, then leaves protected pages without keeping them in history.
export function useSignOut() {
  const navigate = useNavigate()
  return async function signOut() {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }
}
