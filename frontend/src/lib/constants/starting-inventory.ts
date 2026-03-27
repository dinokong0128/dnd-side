export type StartingItem = {
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

export const CLASS_STARTING_INVENTORY: Record<string, StartingItem[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon', damage: '1d8 slashing' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', ac_bonus: 2 } },
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
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', ac_bonus: 2 } },
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
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor', ac_bonus: 2 } },
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
