import { createClient } from '@/lib/supabase/server'
import type { CharacterClass, AbilityScore } from '@/lib/game-data'

export type PlayerStats = Record<AbilityScore, number>

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
  properties: { type: string } | null
  created_at: string
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

export async function fetchInventoryByPlayer(
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
  characterClass: CharacterClass
): Promise<void> {
  const { CLASS_STARTING_INVENTORY } = await import('@/lib/game-data')
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  if (deleteError) {
    throw new Error(`Failed to clear inventory: ${deleteError.message}`)
  }

  const items = CLASS_STARTING_INVENTORY[characterClass]
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
    throw new Error(`Failed to insert inventory: ${insertError.message}`)
  }
}
