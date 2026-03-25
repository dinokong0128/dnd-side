import { createClient } from '@/lib/supabase/server'

export async function fetchInviteByCode(
  code: string
): Promise<{ gameId: string } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invites')
    .select('game_id')
    .eq('code', code)
    .is('used_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch invite: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return { gameId: data.game_id }
}
