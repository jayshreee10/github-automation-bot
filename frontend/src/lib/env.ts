import { z } from 'zod'

const envSchema = z.object({
  VITE_NEON_AUTH_URL: z.url({ protocol: /^https$/ }),
})

// Validated once at startup so a missing variable fails loudly instead of breaking sign-in later.
export const env = envSchema.parse(import.meta.env)
