import { createClient } from '@/lib/supabase/server'

export type Game = {
  id: string
  name: string
  dm_persona: string
  status: string
  created_at: string
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
    .select('id, name, dm_persona, status, created_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

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
    .select('id, name, dm_persona, status, created_at')
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
    .select('id, name, dm_persona, status, created_at')
    .eq('id', gameId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch game: ${error.message}`)
  }

  return data
}
