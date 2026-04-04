import { z } from 'zod'

export const CHARACTER_CLASSES = [
  'Fighter',
  'Wizard',
  'Rogue',
  'Cleric',
  'Ranger',
  'Barbarian',
  'Paladin',
  'Druid',
  'Bard',
  'Monk',
  'Sorcerer',
  'Warlock',
] as const

export const characterSchema = z.object({
  characterName: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Max 50 characters'),
  characterClass: z.enum(CHARACTER_CLASSES, { message: 'Select a class' }),
  stats: z.object({
    str: z
      .number({ error: 'Must be a number' })
      .int()
      .min(1, 'Min 1')
      .max(20, 'Max 20'),
    dex: z
      .number({ error: 'Must be a number' })
      .int()
      .min(1, 'Min 1')
      .max(20, 'Max 20'),
    con: z
      .number({ error: 'Must be a number' })
      .int()
      .min(1, 'Min 1')
      .max(20, 'Max 20'),
    int: z
      .number({ error: 'Must be a number' })
      .int()
      .min(1, 'Min 1')
      .max(20, 'Max 20'),
    wis: z
      .number({ error: 'Must be a number' })
      .int()
      .min(1, 'Min 1')
      .max(20, 'Max 20'),
    cha: z
      .number({ error: 'Must be a number' })
      .int()
      .min(1, 'Min 1')
      .max(20, 'Max 20'),
  }),
})

export type CharacterFormData = z.infer<typeof characterSchema>
