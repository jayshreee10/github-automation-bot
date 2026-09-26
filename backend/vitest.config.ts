import { defineConfig } from 'vitest/config';

// Unit tests only: Prisma, GitHub and Slack are mocked, so no database or network is needed.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
