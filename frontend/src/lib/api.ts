import type { z } from 'zod'
import { authClient } from '@/lib/auth-client'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`API request failed with status ${status}`)
    this.status = status
  }
}

// The SDK caches the session JWT and refreshes it before expiry; we only attach it.
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await authClient.getSession()
  const token = data?.session.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(await authHeader()), ...init.headers },
  })
  if (!res.ok) throw new ApiError(res.status)
  return schema.parse(await res.json())
}
