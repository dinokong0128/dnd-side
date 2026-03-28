import { createClient } from '@/lib/supabase/server'
import {
  type PlayerStats,
  type CharacterClass,
  type InventoryItem,
  CLASS_STARTING_INVENTORY,
} from '@/lib/game-data/characters'

export type { PlayerStats, CharacterClass, InventoryItem }

export type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string | null
  character_class: string | null
  stats: PlayerStats | null
  hp_current: number | null
  hp_max: number | null
  created_at: string
}

export async function fetchPlayerByUserId(
  gameId: string,
  userId: string
): Promise<Player | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
    .eq('game_id', gameId)
    .eq('profile_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch player: ${error.message}`)
  }

  return data
}

export async function fetchPlayerInventory(
  playerId: string
): Promise<InventoryItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, player_id, item_name, quantity, properties')
    .eq('player_id', playerId)
    .order('item_name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`)
  }

  return data ?? []
}

export async function setStartingInventory(
  playerId: string,
  characterClass: CharacterClass
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
  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties ?? {},
  }))

  const { error: insertError } = await supabase
    .from('player_inventory')
    .insert(rows)

  if (insertError) {
    throw new Error(`Failed to set starting inventory: ${insertError.message}`)
  }
}
