import { createClient } from '@/lib/supabase/server'
import type { PlayerRow } from '@/lib/types/player'

export async function getPlayer(
  gameId: string,
  profileId: string
): Promise<PlayerRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('players')
    .select('id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at')
    .eq('game_id', gameId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch player: ${error.message}`)
  }

  return data
}
