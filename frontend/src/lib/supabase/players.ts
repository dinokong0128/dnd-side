import { createClient } from '@/lib/supabase/server'
import type { CharacterClass } from '@/lib/constants/starting-inventory'

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
  created_at: string
}

export type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, string>
}

export async function fetchPlayerByGameAndUser(
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

export async function fetchInventoryByPlayer(
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

export async function upsertPlayer(input: {
  game_id: string
  profile_id: string
  character_name: string
  character_class: CharacterClass
  stats: PlayerStats
  hp_max: number
}): Promise<Player> {
  const supabase = await createClient()

  // Check if player row already exists
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', input.game_id)
    .eq('profile_id', input.profile_id)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('players')
      .update({
        character_name: input.character_name,
        character_class: input.character_class,
        stats: input.stats,
        hp_max: input.hp_max,
        hp_current: input.hp_max,
      })
      .eq('id', existing.id)
      .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
      .single()

    if (error) {
      throw new Error(`Failed to update player: ${error.message}`)
    }

    return data
  }

  const { data, error } = await supabase
    .from('players')
    .insert({
      game_id: input.game_id,
      profile_id: input.profile_id,
      character_name: input.character_name,
      character_class: input.character_class,
      stats: input.stats,
      hp_max: input.hp_max,
      hp_current: input.hp_max,
    })
    .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
    .single()

  if (error) {
    throw new Error(`Failed to create player: ${error.message}`)
  }

  return data
}

export async function setStartingInventory(
  playerId: string,
  items: { item_name: string; quantity: number; properties: Record<string, string> }[]
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

  // Insert new items
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
    throw new Error(`Failed to set inventory: ${insertError.message}`)
  }
}
