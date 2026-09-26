import { afterEach, describe, expect, it, vi } from 'vitest'

// env.ts parses at import time, so each case stubs env vars and re-imports the module.
async function loadEnv() {
  vi.resetModules()
  return (await import('./env')).env
}

describe('env', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('parses valid VITE_* vars', async () => {
    const env = await loadEnv()
    expect(env).toMatchObject({
      VITE_NEON_AUTH_URL: 'https://auth.example.com',
      VITE_GITHUB_APP_SLUG: 'test-bot',
    })
  })

  it('rejects a non-https auth URL', async () => {
    vi.stubEnv('VITE_NEON_AUTH_URL', 'http://auth.example.com')
    await expect(loadEnv()).rejects.toThrow()
  })

  it('rejects an invalid app slug', async () => {
    vi.stubEnv('VITE_GITHUB_APP_SLUG', 'Bad Slug!')
    await expect(loadEnv()).rejects.toThrow()
  })
})
