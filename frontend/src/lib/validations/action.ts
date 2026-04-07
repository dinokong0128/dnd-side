import { z } from 'zod'

// Action submission constraints
export const ACTION_MAX_LENGTH = 2000

export const actionSchema = z.object({
  actionText: z
    .string()
    .trim()
    .min(1, 'Action cannot be empty')
    .max(ACTION_MAX_LENGTH, `Action must be under ${ACTION_MAX_LENGTH} characters`),
})

export type ActionFormData = z.infer<typeof actionSchema>
