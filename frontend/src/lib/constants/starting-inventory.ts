export type StartingItem = {
  item_name: string
  quantity: number
  properties: { type: string; damage?: string; weight?: string }
}

export const CLASS_STARTING_INVENTORY: Record<string, StartingItem[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon', damage: '1d8 slashing', weight: '3 lb' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', weight: '6 lb' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor', weight: '55 lb' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Handaxe', quantity: 5, properties: { type: 'weapon', damage: '1d6 slashing', weight: '2 lb' } },
  ],
  Wizard: [
    { item_name: 'Spellbook', quantity: 1, properties: { type: 'arcane', weight: '3 lb' } },
    { item_name: 'Arcane Focus (Staff)', quantity: 1, properties: { type: 'arcane', weight: '4 lb' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing', weight: '1 lb' } },
  ],
  Rogue: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing', weight: '2 lb' } },
    { item_name: 'Shortbow', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing', weight: '2 lb' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo', weight: '1 lb' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', weight: '10 lb' } },
    { item_name: "Thieves' Tools", quantity: 1, properties: { type: 'tool', weight: '1 lb' } },
    { item_name: "Burglar's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Cleric: [
    { item_name: 'Mace', quantity: 1, properties: { type: 'weapon', damage: '1d6 bludgeoning', weight: '4 lb' } },
    { item_name: 'Scale Mail', quantity: 1, properties: { type: 'armor', weight: '45 lb' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', weight: '6 lb' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'arcane' } },
    { item_name: "Priest's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Ranger: [
    { item_name: 'Longbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing', weight: '2 lb' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo', weight: '1 lb' } },
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing', weight: '2 lb' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', weight: '10 lb' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Barbarian: [
    { item_name: 'Greataxe', quantity: 1, properties: { type: 'weapon', damage: '1d12 slashing', weight: '7 lb' } },
    { item_name: 'Handaxe', quantity: 2, properties: { type: 'weapon', damage: '1d6 slashing', weight: '2 lb' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Javelin', quantity: 4, properties: { type: 'weapon', damage: '1d6 piercing', weight: '2 lb' } },
  ],
  Paladin: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon', damage: '1d8 slashing', weight: '3 lb' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', weight: '6 lb' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor', weight: '55 lb' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'arcane' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Druid: [
    { item_name: 'Quarterstaff', quantity: 1, properties: { type: 'weapon', damage: '1d6 bludgeoning', weight: '4 lb' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', weight: '10 lb' } },
    { item_name: 'Druidic Focus', quantity: 1, properties: { type: 'arcane' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Bard: [
    { item_name: 'Rapier', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing', weight: '2 lb' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor', weight: '10 lb' } },
    { item_name: 'Lute', quantity: 1, properties: { type: 'instrument', weight: '2 lb' } },
    { item_name: "Diplomat's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing', weight: '1 lb' } },
  ],
  Monk: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon', damage: '1d6 piercing', weight: '2 lb' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dart', quantity: 10, properties: { type: 'weapon', damage: '1d4 piercing', weight: '0.25 lb' } },
  ],
  Sorcerer: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing', weight: '5 lb' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo', weight: '1.5 lb' } },
    { item_name: 'Arcane Focus (Crystal)', quantity: 1, properties: { type: 'arcane' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing', weight: '1 lb' } },
  ],
  Warlock: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon', damage: '1d8 piercing', weight: '5 lb' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo', weight: '1.5 lb' } },
    { item_name: 'Arcane Focus (Wand)', quantity: 1, properties: { type: 'arcane' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon', damage: '1d4 piercing', weight: '1 lb' } },
  ],
}

export const CHARACTER_CLASSES = Object.keys(CLASS_STARTING_INVENTORY)

export const CLASS_HIT_DIE: Record<string, number> = {
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

export function calculateHpMax(characterClass: string, con: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((con - 10) / 2)
  return hitDie + conModifier
}

export function getItemTypeIcon(type: string): string {
  switch (type) {
    case 'weapon': return '\u2694'
    case 'armor': return '\uD83D\uDEE1'
    case 'arcane': return '\u2728'
    case 'pack': return '\uD83C\uDF92'
    case 'ammo': return '\uD83C\uDFF9'
    case 'tool': return '\uD83D\uDD27'
    case 'instrument': return '\uD83C\uDFB5'
    default: return '\uD83D\uDCE6'
  }
}
