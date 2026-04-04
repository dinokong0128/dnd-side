import { createClient } from '@/lib/supabase/server'
import type { PlayerRow } from '@/lib/types/player'

export async function getPlayer(
  gameId: string,
  profileId: string
): Promise<PlayerRow | null> {
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
