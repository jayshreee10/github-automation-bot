import { apiFetch } from '@/lib/api'
import { type Me, meSchema } from './schemas'

// Round-trips through the backend guard, proving the JWT is accepted server-side.
export function fetchMe(): Promise<Me> {
  return apiFetch('/me', meSchema)
}
