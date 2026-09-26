import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError, apiFetch } from './api'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { getSession } }))

const schema = z.object({ ok: z.boolean() })
const fetchMock = vi.fn()

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    getSession.mockResolvedValue({ data: { session: { token: 'jwt-1' } } })
  })

  it('calls /api with the session JWT as a Bearer token', async () => {
    respond(200, { ok: true })
    await expect(apiFetch('/me', schema)).resolves.toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/me')
    expect(init.headers).toEqual({ Authorization: 'Bearer jwt-1' })
  })

  it('sends no Authorization header without a session', async () => {
    getSession.mockResolvedValue({ data: null })
    respond(200, { ok: true })
    await apiFetch('/me', schema)
    expect(fetchMock.mock.calls[0][1].headers).toEqual({})
  })

  it('merges caller headers and keeps method and body', async () => {
    respond(200, { ok: true })
    await apiFetch('/x', schema, {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: { Authorization: 'Bearer jwt-1', 'Content-Type': 'application/json' },
    })
  })

  it('throws ApiError carrying the status on a non-2xx response', async () => {
    respond(403, {})
    const err = await apiFetch('/x', schema).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(403)
  })

  it('rejects a response that does not match the schema', async () => {
    respond(200, { ok: 'yes' })
    await expect(apiFetch('/x', schema)).rejects.toThrow()
  })
})
