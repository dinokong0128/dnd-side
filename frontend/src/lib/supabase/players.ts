import { createClient } from '@/lib/supabase/server'
import type { Player, InventoryItem } from '@/types/player'

export type { Player, PlayerStats, InventoryItem } from '@/types/player'

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

export async function fetchPlayersByGame(gameId: string): Promise<Player[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select(PLAYER_COLUMNS)
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`)
  }

  return data ?? []
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
