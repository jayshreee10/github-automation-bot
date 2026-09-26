import { z } from 'zod'

export const meSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  // From the caller's own installation; null until the GitHub App is installed.
  githubLogin: z.string().nullable(),
})

export type Me = z.infer<typeof meSchema>
