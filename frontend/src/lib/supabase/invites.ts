import { createClient } from '@/lib/supabase/server'

export type InviteResult =
  | { status: 'valid'; gameId: string; gameName: string }
  | { status: 'invalid' }
  | { status: 'used' }

export async function fetchInviteByCode(code: string): Promise<InviteResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('validate_invite_code_v2', {
    invite_code: code,
  })

  if (error) {
    throw new Error(`Failed to validate invite: ${error.message}`)
  }

  if (!data || data.status !== 'valid') {
    return { status: data?.status ?? 'invalid' }
  }

  const gameId = data.game_id as string

  // Fetch game name for the signup banner
  const { data: game } = await supabase
    .from('games')
    .select('name')
    .eq('id', gameId)
    .maybeSingle()

  return { status: 'valid', gameId, gameName: game?.name ?? '' }
}
