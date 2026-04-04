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

export const GAME_STATUSES = ['lobby', 'active', 'paused', 'ended'] as const

export const STAT_NAMES = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
] as const

export const CHARACTER_CONSTRAINTS = {
  name: { min: 1, max: 50 },
} as const

export const STAT_CONSTRAINTS = {
  min: 1,
  max: 20,
} as const
