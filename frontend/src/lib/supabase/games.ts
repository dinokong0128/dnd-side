import { createClient } from '@/lib/supabase/server'

export type SuggestedActionsBundle = {
  acting_player_id: string | null
  tailored: string[]
  generic: string[]
}

export type Game = {
  id: string
  name: string
  dm_persona: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
  suggested_actions: SuggestedActionsBundle | null
}

export type CreateGameInput = {
  name: string
  dm_persona: string
  host_id: string
}

export async function fetchGamesByUserId(userId: string): Promise<Game[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('games')
    .select('id, name, dm_persona, status, created_by, created_at, updated_at, suggested_actions')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch games: ${error.message}`)
  }

  return data ?? []
}

export async function createGame(input: CreateGameInput): Promise<Game> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('games')
    .insert({
      name: input.name,
      dm_persona: input.dm_persona,
      created_by: input.host_id,
    })
    .select('id, name, dm_persona, status, created_by, created_at, updated_at, suggested_actions')
    .single()

  if (error) {
    throw new Error(`Failed to create game: ${error.message}`)
  }

  return data
}

export async function fetchGameById(gameId: string): Promise<Game | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('games')
    .select('id, name, dm_persona, status, created_by, created_at, updated_at, suggested_actions')
    .eq('id', gameId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch game: ${error.message}`)
  }

  return data
}
