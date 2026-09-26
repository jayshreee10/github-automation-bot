import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectInstallation, fetchAppInfo, fetchRepositories, syncInstallation } from '@/features/repositories/api'

vi.mock('@/lib/auth-client', () => ({
  authClient: { getSession: vi.fn().mockResolvedValue({ data: null }) },
}))

const list = { installations: [{ id: '7', accountLogin: 'acme', accountType: 'User', repositorySelection: 'all' }], repositories: [] }
const fetchMock = vi.fn()

describe('repositories api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(list)))
  })

  it('lists repositories with GET /api/repositories', async () => {
    await expect(fetchRepositories()).resolves.toEqual(list)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/repositories')
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined()
  })

  it('syncs one installation with POST', async () => {
    await syncInstallation('7')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/installations/7/sync')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  it('connects an installation with a JSON body', async () => {
    await connectInstallation('7')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/installations')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ installationId: '7' })
  })

  it('loads the App info with GET /api/app', async () => {
    const app = { events: ['issues'], permissions: { issues: 'write' } }
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(app)))
    await expect(fetchAppInfo()).resolves.toEqual(app)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/app')
  })
})
