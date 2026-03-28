import { createClient } from '@/lib/supabase/server'

export type PlayerStats = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: PlayerStats
  status: string
  joined_at: string
}

export type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
  created_at: string
}

export type UpsertPlayerInput = {
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  stats: PlayerStats
  hp_max: number
}

const PLAYER_COLUMNS =
  'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'

export async function fetchPlayerByProfileAndGame(
  profileId: string,
  gameId: string
): Promise<Player | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select(PLAYER_COLUMNS)
    .eq('profile_id', profileId)
    .eq('game_id', gameId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch player: ${error.message}`)
  }

  return data
}

export async function upsertPlayer(input: UpsertPlayerInput): Promise<Player> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .upsert(
      {
        game_id: input.game_id,
        profile_id: input.profile_id,
        character_name: input.character_name,
        character_class: input.character_class,
        stats: input.stats,
        hp_current: input.hp_max,
        hp_max: input.hp_max,
      },
      { onConflict: 'game_id,profile_id' }
    )
    .select(PLAYER_COLUMNS)
    .single()

  if (error) {
    throw new Error(`Failed to upsert player: ${error.message}`)
  }

  return data
}

export async function fetchInventoryByPlayerId(
  playerId: string
): Promise<InventoryItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, player_id, item_name, quantity, properties, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true })

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

  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (!items || items.length === 0) return

  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties ?? null,
  }))

  const { error: insertError } = await supabase
    .from('player_inventory')
    .insert(rows)

  if (insertError) {
    throw new Error(`Failed to set starting inventory: ${insertError.message}`)
  }
}

// --- Starting equipment by class (D&D 5e simplified) ---

type StartingItem = {
  item_name: string
  quantity: number
  properties?: Record<string, unknown>
}

export const CLASS_STARTING_INVENTORY: Record<string, StartingItem[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Handaxe', quantity: 5, properties: { type: 'weapon' } },
  ],
  Wizard: [
    { item_name: 'Spellbook', quantity: 1, properties: { type: 'focus' } },
    {
      item_name: 'Arcane Focus (Staff)',
      quantity: 1,
      properties: { type: 'focus' },
    },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Rogue: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shortbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    {
      item_name: "Thieves' Tools",
      quantity: 1,
      properties: { type: 'tool' },
    },
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
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo' } },
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
    {
      item_name: "Diplomat's Pack",
      quantity: 1,
      properties: { type: 'pack' },
    },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Monk: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    {
      item_name: "Dungeoneer's Pack",
      quantity: 1,
      properties: { type: 'pack' },
    },
    { item_name: 'Dart', quantity: 10, properties: { type: 'weapon' } },
  ],
  Sorcerer: [
    {
      item_name: 'Light Crossbow',
      quantity: 1,
      properties: { type: 'weapon' },
    },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo' } },
    {
      item_name: 'Arcane Focus (Crystal)',
      quantity: 1,
      properties: { type: 'focus' },
    },
    {
      item_name: "Dungeoneer's Pack",
      quantity: 1,
      properties: { type: 'pack' },
    },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Warlock: [
    {
      item_name: 'Light Crossbow',
      quantity: 1,
      properties: { type: 'weapon' },
    },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo' } },
    {
      item_name: 'Arcane Focus (Wand)',
      quantity: 1,
      properties: { type: 'focus' },
    },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
}

// --- HP calculation ---

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

export function calculateHpMax(
  characterClass: string,
  conScore: number
): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((conScore - 10) / 2)
  return Math.max(1, hitDie + conModifier)
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

export const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}
