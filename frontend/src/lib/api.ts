import type { z } from 'zod'
import { authClient } from '@/lib/auth-client'

export class ApiError extends Error {
  readonly status: number
  // Server message for 400s (our own validation text); never shown for other statuses.
  readonly detail: string | null

  constructor(status: number, detail: string | null = null) {
    super(`API request failed with status ${status}`)
    this.status = status
    this.detail = detail
  }
}

// The SDK caches the session JWT and refreshes it before expiry; we only attach it.
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await authClient.getSession()
  const token = data?.session.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(await authHeader()), ...init.headers },
  })
  if (!res.ok) throw new ApiError(res.status, res.status === 400 ? await badRequestMessage(res) : null)
  return res
}

async function badRequestMessage(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json()
    const message = (body as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  } catch {
    return null
  }
}

export async function apiFetch<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init)
  return schema.parse(await res.json())
}

// For endpoints answering 204 or whose body the caller does not need.
export async function apiSend(path: string, init: RequestInit): Promise<void> {
  await request(path, init)
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// Builds "?a=1&b=2", dropping empty values.
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ''
}
