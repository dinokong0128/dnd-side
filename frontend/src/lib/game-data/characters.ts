// D&D 5e PHB character constants shared between client and server

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

export type CharacterClass = (typeof CHARACTER_CLASSES)[number]

export const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type AbilityName = (typeof ABILITY_NAMES)[number]

export const ABILITY_LABELS: Record<AbilityName, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

export const ABILITY_FULL_NAMES: Record<AbilityName, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export const CLASS_HIT_DIE: Record<CharacterClass, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
}

export function calculateHpMax(characterClass: string, conScore: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass as CharacterClass] ?? 8
  const conModifier = Math.floor((conScore - 10) / 2)
  return hitDie + conModifier
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(score: number): string {
  const mod = getAbilityModifier(score)
  return mod >= 0 ? `+${mod}` : String(mod)
}

// Starting inventory per class (US-09)
export type StartingItem = {
  item_name: string
  quantity: number
  properties: { type: string; damage?: string; weight?: string } | null
}

export const CLASS_STARTING_INVENTORY: Record<CharacterClass, StartingItem[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon', damage: '1d8 slashing' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Handaxe', quantity: 5, properties: { type: 'weapon', damage: '1d6 slashing' } },
  ],
  Wizard: [
    { item_name: 'Spellbook', quantity: 1, properties: { type: 'focus' } },
    { item_name: 'Arcane Focus (Staff)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
  Rogue: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing' } },
    { item_name: 'Shortbow', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Thieves' Tools", quantity: 1, properties: { type: 'tool' } },
    { item_name: "Burglar's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Cleric: [
    { item_name: 'Mace', quantity: 1, properties: { type: 'weapon', damage: '1d6 bludgeoning' } },
    { item_name: 'Scale Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Priest's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Ranger: [
    { item_name: 'Longbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Barbarian: [
    { item_name: 'Greataxe', quantity: 1, properties: { type: 'weapon', damage: '1d12 slashing' } },
    { item_name: 'Handaxe', quantity: 2, properties: { type: 'weapon', damage: '1d6 slashing' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Javelin', quantity: 4, properties: { type: 'weapon', damage: '1d6 piercing' } },
  ],
  Paladin: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon', damage: '1d8 slashing' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Druid: [
    { item_name: 'Quarterstaff', quantity: 1, properties: { type: 'weapon', damage: '1d6 bludgeoning' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Druidic Focus', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Bard: [
    { item_name: 'Rapier', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Lute', quantity: 1, properties: { type: 'instrument' } },
    { item_name: "Diplomat's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
  Monk: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dart', quantity: 10, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
  Sorcerer: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Arcane Focus (Crystal)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
  Warlock: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Arcane Focus (Wand)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
}
