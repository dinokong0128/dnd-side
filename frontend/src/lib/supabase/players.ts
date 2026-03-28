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
