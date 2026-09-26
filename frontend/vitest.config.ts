import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Component and hook tests in jsdom. The Neon Auth SDK and fetch are mocked per test; no network.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      css: false,
      clearMocks: true,
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      env: {
        VITE_NEON_AUTH_URL: 'https://auth.example.com',
        VITE_GITHUB_APP_SLUG: 'test-bot',
      },
    },
  }),
)
