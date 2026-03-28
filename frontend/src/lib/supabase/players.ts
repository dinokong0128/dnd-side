import { createClient } from '@/lib/supabase/server'
import type { CharacterClass } from '@/lib/game-data/characters'

export type PlayerStats = {
  STR: number
  DEX: number
  CON: number
  INT: number
  WIS: number
  CHA: number
}

export type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string | null
  character_class: string | null
  stats: PlayerStats | null
  hp_current: number | null
  hp_max: number | null
  status: string
  created_at: string
}

export type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown>
}

const PLAYER_COLUMNS = 'id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, status, created_at'

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

  if (error) throw new Error(`Failed to fetch player: ${error.message}`)
  return data
}

export async function fetchPlayerInventory(playerId: string): Promise<InventoryItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, player_id, item_name, quantity, properties')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch inventory: ${error.message}`)
  return data ?? []
}

export async function setStartingInventory(
  playerId: string,
  characterClass: CharacterClass
): Promise<void> {
  const { CLASS_STARTING_INVENTORY } = await import('@/lib/game-data/characters')
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (!items) return

  const supabase = await createClient()

  // Delete existing inventory (idempotent reset)
  const { error: deleteError } = await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  if (deleteError) throw new Error(`Failed to clear inventory: ${deleteError.message}`)

  // Insert new class items
  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties,
  }))

  const { error: insertError } = await supabase
    .from('player_inventory')
    .insert(rows)

  if (insertError) throw new Error(`Failed to populate inventory: ${insertError.message}`)
}
