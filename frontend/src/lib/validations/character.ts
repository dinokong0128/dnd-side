import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  CHARACTER_RACES,
  CHARACTER_CONSTRAINTS,
  STAT_CONSTRAINTS,
} from '@/lib/constants/game'

export const characterSchema = z.object({
  characterName: z
    .string()
    .min(CHARACTER_CONSTRAINTS.name.min, 'Name is required')
    .max(CHARACTER_CONSTRAINTS.name.max, 'Max 50 characters'),
  characterClass: z.enum(CHARACTER_CLASSES, { message: 'Select a class' }),
  race: z.enum(CHARACTER_RACES, { message: 'Select a race' }),
  level: z.number().int().min(1).max(20),
  stats: z.object({
    str: z
      .number({ error: 'Must be a number' })
      .int()
      .min(STAT_CONSTRAINTS.min, 'Min 1')
      .max(STAT_CONSTRAINTS.max, 'Max 20'),
    dex: z
      .number({ error: 'Must be a number' })
      .int()
      .min(STAT_CONSTRAINTS.min, 'Min 1')
      .max(STAT_CONSTRAINTS.max, 'Max 20'),
    con: z
      .number({ error: 'Must be a number' })
      .int()
      .min(STAT_CONSTRAINTS.min, 'Min 1')
      .max(STAT_CONSTRAINTS.max, 'Max 20'),
    int: z
      .number({ error: 'Must be a number' })
      .int()
      .min(STAT_CONSTRAINTS.min, 'Min 1')
      .max(STAT_CONSTRAINTS.max, 'Max 20'),
    wis: z
      .number({ error: 'Must be a number' })
      .int()
      .min(STAT_CONSTRAINTS.min, 'Min 1')
      .max(STAT_CONSTRAINTS.max, 'Max 20'),
    cha: z
      .number({ error: 'Must be a number' })
      .int()
      .min(STAT_CONSTRAINTS.min, 'Min 1')
      .max(STAT_CONSTRAINTS.max, 'Max 20'),
  }),
})

export type CharacterFormData = z.infer<typeof characterSchema>
