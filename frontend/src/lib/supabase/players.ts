import { createClient } from '@/lib/supabase/server'
import type { PlayerRow } from '@/lib/types/player'

export type InventoryRow = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
  created_at: string
}

export async function getPlayer(
  gameId: string,
  profileId: string
): Promise<PlayerRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select('id, game_id, profile_id, character_name, character_class, race, level, hp_current, hp_max, stats, status, joined_at')
    .eq('game_id', gameId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch player: ${error.message}`)
  }

  return data
}

// TODO(DIN-34): Inventory proxy route deferred for MVP.
// Currently using direct Supabase read (server component).
// If a client component needs dynamic inventory fetch, create:
//   frontend/src/app/api/games/[gameId]/inventory/route.ts
// following the pattern in .../players/route.ts

export async function getPlayerInventory(
  gameId: string,
  profileId: string
): Promise<InventoryRow[]> {
  const supabase = await createClient()

  // First find the player for this profile in this game
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (playerError) {
    throw new Error(`Failed to fetch player: ${playerError.message}`)
  }

  if (!player) {
    return []
  }

  // Then fetch their inventory
  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, player_id, item_name, quantity, properties, created_at')
    .eq('player_id', player.id)
    .order('item_name')

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`)
  }

  return data ?? []
}
