import { createClient } from '@/lib/supabase/server'
import {
  CLASS_STARTING_INVENTORY,
  type PlayerStats,
} from '@/lib/game-data'

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
}

export type CreatePlayerInput = {
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  stats: PlayerStats
  hp_max: number
}

export type UpdatePlayerInput = {
  character_name: string
  character_class: string
  stats: PlayerStats
  hp_max: number
}

const PLAYER_SELECT =
  'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'

export async function getPlayerByGameAndProfile(
  gameId: string,
  profileId: string
): Promise<Player | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select(PLAYER_SELECT)
    .eq('game_id', gameId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch player: ${error.message}`)
  }

  return data
}

export async function createPlayer(input: CreatePlayerInput): Promise<Player> {
  const supabase = await createClient()

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
    .select(PLAYER_SELECT)
    .single()

  if (error) {
    throw new Error(`Failed to create player: ${error.message}`)
  }

  return data
}

export async function updatePlayer(
  playerId: string,
  input: UpdatePlayerInput
): Promise<Player> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .update({
      character_name: input.character_name,
      character_class: input.character_class,
      stats: input.stats,
      hp_max: input.hp_max,
      hp_current: input.hp_max,
    })
    .eq('id', playerId)
    .select(PLAYER_SELECT)
    .single()

  if (error) {
    throw new Error(`Failed to update player: ${error.message}`)
  }

  return data
}

export async function getPlayerInventory(
  playerId: string
): Promise<InventoryItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, player_id, item_name, quantity, properties')
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

  // Delete existing inventory (idempotent reset)
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
