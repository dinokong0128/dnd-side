/** D&D 5e character classes, hit dice, flavor text, and starting equipment. */

export const CHARACTER_CLASSES = [
  'Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger',
  'Barbarian', 'Paladin', 'Druid', 'Bard', 'Monk',
  'Sorcerer', 'Warlock',
] as const

export type CharacterClass = (typeof CHARACTER_CLASSES)[number]

export const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
export type AbilityName = (typeof ABILITY_NAMES)[number]

export const ABILITY_FULL_NAMES: Record<AbilityName, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export const CLASS_ICONS: Record<CharacterClass, string> = {
  Fighter: '\u2694',
  Wizard: '\u2728',
  Rogue: '\uD83D\uDDE1',
  Cleric: '\u2720',
  Ranger: '\uD83C\uDFF9',
  Barbarian: '\uD83E\uDE93',
  Paladin: '\uD83D\uDEE1',
  Druid: '\uD83C\uDF3F',
  Bard: '\uD83C\uDFB5',
  Monk: '\u262F',
  Sorcerer: '\uD83D\uDD25',
  Warlock: '\uD83D\uDC40',
}

export const CLASS_FLAVOR: Record<CharacterClass, string> = {
  Fighter: 'Masters of martial combat, trained with every weapon and armor.',
  Wizard: 'Scholars of the arcane, wielding spells learned through study.',
  Rogue: 'Cunning operatives who rely on skill, stealth, and deadly precision.',
  Cleric: 'Divine champions who channel the power of their deity.',
  Ranger: 'Warriors of the wilderness, expert hunters and trackers.',
  Barbarian: 'Fierce warriors fueled by primal rage and raw power.',
  Paladin: 'Holy warriors bound by sacred oaths to fight for justice.',
  Druid: 'Guardians of nature who channel the power of the wild.',
  Bard: 'Performers and lorekeepers whose music weaves magic.',
  Monk: 'Disciplined warriors who harness the power of body and spirit.',
  Sorcerer: 'Natural spellcasters with innate magical bloodlines.',
  Warlock: 'Wielders of eldritch power granted by otherworldly patrons.',
}

/** Hit die per class (max value at level 1). */
export const CLASS_HIT_DIE: Record<CharacterClass, number> = {
  Fighter: 10,
  Wizard: 6,
  Rogue: 8,
  Cleric: 8,
  Ranger: 10,
  Barbarian: 12,
  Paladin: 10,
  Druid: 8,
  Bard: 8,
  Monk: 8,
  Sorcerer: 6,
  Warlock: 8,
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(score: number): string {
  const mod = abilityModifier(score)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function calculateHpMax(characterClass: CharacterClass, conScore: number): number {
  return CLASS_HIT_DIE[characterClass] + abilityModifier(conScore)
}

// ─── Starting Inventory ───

export type ItemType = 'weapon' | 'armor' | 'pack' | 'focus' | 'tool' | 'ammunition' | 'instrument'

export type StartingItem = {
  item_name: string
  quantity: number
  properties: {
    type: ItemType
    damage?: string
    ac?: number
  }
}

export const CLASS_STARTING_INVENTORY: Record<CharacterClass, StartingItem[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon', damage: '1d8 slashing' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', ac: 2 } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor', ac: 16 } },
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
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', ac: 11 } },
    { item_name: "Thieves' Tools", quantity: 1, properties: { type: 'tool' } },
    { item_name: "Burglar's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Cleric: [
    { item_name: 'Mace', quantity: 1, properties: { type: 'weapon', damage: '1d6 bludgeoning' } },
    { item_name: 'Scale Mail', quantity: 1, properties: { type: 'armor', ac: 14 } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', ac: 2 } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Priest's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Ranger: [
    { item_name: 'Longbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', ac: 11 } },
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
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', ac: 2 } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor', ac: 16 } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Druid: [
    { item_name: 'Quarterstaff', quantity: 1, properties: { type: 'weapon', damage: '1d6 bludgeoning' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', ac: 11 } },
    { item_name: 'Druidic Focus', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Bard: [
    { item_name: 'Rapier', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', ac: 11 } },
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
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Arcane Focus (Crystal)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
  Warlock: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Arcane Focus (Wand)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing' } },
  ],
}
