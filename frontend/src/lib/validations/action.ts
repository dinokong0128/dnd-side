import { z } from 'zod'

export const actionSchema = z.object({
  actionText: z
    .string()
    .trim()
    .min(1, 'Action cannot be empty')
    .max(2000, 'Action must be under 2000 characters'),
})

export type ActionFormData = z.infer<typeof actionSchema>
