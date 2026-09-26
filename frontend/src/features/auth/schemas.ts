import { z } from 'zod'

export const meSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
})

export type Me = z.infer<typeof meSchema>
