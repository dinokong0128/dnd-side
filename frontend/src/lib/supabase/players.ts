import { createClient } from '@/lib/supabase/server'

export type AbilityScores = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export type PlayerStats = AbilityScores & {
  hp_max: number
}

export type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string | null
  character_class: string | null
  stats: PlayerStats | null
  created_at: string
}

export type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown>
}

export type CreatePlayerInput = {
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  stats: PlayerStats
}

export type UpdatePlayerInput = {
  character_name: string
  character_class: string
  stats: PlayerStats
}

const CLASS_HIT_DIE: Record<string, number> = {
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

export function calculateHpMax(characterClass: string, con: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((con - 10) / 2)
  return hitDie + conModifier
}

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(score: number): string {
  const mod = calculateModifier(score)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

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

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export const CLASS_STARTING_INVENTORY: Record<string, { item_name: string; quantity: number; properties: Record<string, unknown> }[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Handaxe', quantity: 5, properties: { type: 'weapon' } },
  ],
  Wizard: [
    { item_name: 'Spellbook', quantity: 1, properties: { type: 'focus' } },
    { item_name: 'Arcane Focus (Staff)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Rogue: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shortbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Thieves' Tools", quantity: 1, properties: { type: 'tool' } },
    { item_name: "Burglar's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Cleric: [
    { item_name: 'Mace', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Scale Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Priest's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Ranger: [
    { item_name: 'Longbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Barbarian: [
    { item_name: 'Greataxe', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Handaxe', quantity: 2, properties: { type: 'weapon' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Javelin', quantity: 4, properties: { type: 'weapon' } },
  ],
  Paladin: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Druid: [
    { item_name: 'Quarterstaff', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Druidic Focus', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Bard: [
    { item_name: 'Rapier', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Lute', quantity: 1, properties: { type: 'instrument' } },
    { item_name: "Diplomat's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Monk: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dart', quantity: 10, properties: { type: 'weapon' } },
  ],
  Sorcerer: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Arcane Focus (Crystal)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Warlock: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammunition' } },
    { item_name: 'Arcane Focus (Wand)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
}

export async function getPlayerByProfileAndGame(
  profileId: string,
  gameId: string
): Promise<Player | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select('id, game_id, profile_id, character_name, character_class, stats, created_at')
    .eq('profile_id', profileId)
    .eq('game_id', gameId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch player: ${error.message}`)
  }

  return data
}

export async function getInventoryByPlayerId(
  playerId: string
): Promise<InventoryItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, player_id, item_name, quantity, properties')
    .eq('player_id', playerId)
    .order('item_name')

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`)
  }

  return data ?? []
}

export async function setStartingInventory(
  playerId: string,
  characterClass: string
): Promise<void> {
  const supabase = await createClient()

  // Delete existing inventory
  const { error: deleteError } = await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  if (deleteError) {
    throw new Error(`Failed to clear inventory: ${deleteError.message}`)
  }

  // Insert new class items
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (!items) return

  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties,
  }))

  const { error: insertError } = await supabase
    .from('player_inventory')
    .insert(rows)

  if (insertError) {
    throw new Error(`Failed to set starting inventory: ${insertError.message}`)
  }
}
