import { createClient } from '@/lib/supabase/server'

export type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }
  status: string
  joined_at: string
}

export type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, string> | null
  created_at: string
}

export async function fetchPlayerByGameAndProfile(
  gameId: string,
  profileId: string
): Promise<Player | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId)
    .eq('profile_id', profileId)
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
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`)
  }

  return data ?? []
}

export async function setStartingInventory(
  playerId: string,
  items: { item_name: string; quantity: number; properties: Record<string, string> | null }[]
): Promise<void> {
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  if (deleteError) {
    throw new Error(`Failed to clear inventory: ${deleteError.message}`)
  }

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
