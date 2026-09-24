import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'
import { env } from '@/lib/env'

export const authClient = createAuthClient(env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
})
