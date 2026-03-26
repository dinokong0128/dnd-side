import { createClient } from '@/lib/supabase/server'

export async function fetchInviteByCode(
  code: string
): Promise<{ gameId: string } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('validate_invite_code', {
    invite_code: code,
  })

  if (error) {
    throw new Error(`Failed to fetch invite: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return { gameId: data as string }
}
