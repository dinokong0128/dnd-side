import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  calculateHpMax,
  type CharacterClass,
} from '@/lib/game-data/characters'
import { setStartingInventory } from '@/lib/supabase/players'

const characterSchema = z.object({
  character_name: z.string().min(1, 'Character name is required').max(50, 'Max 50 characters'),
  character_class: z.enum(CHARACTER_CLASSES as unknown as [string, ...string[]]),
  stats: z.object({
    STR: z.number().int().min(1).max(20),
    DEX: z.number().int().min(1).max(20),
    CON: z.number().int().min(1).max(20),
    INT: z.number().int().min(1).max(20),
    WIS: z.number().int().min(1).max(20),
    CHA: z.number().int().min(1).max(20),
  }),
})

async function getSupabaseAndSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
  const { data: { session } } = await supabase.auth.getSession()
  return { supabase, session }
}

/** GET — fetch current user's player + inventory for this game */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { supabase, session } = await getSupabaseAndSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { gameId } = await params

    const { data: player } = await supabase
      .from('players')
      .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, status, created_at')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (!player) return NextResponse.json({ player: null, inventory: [] })

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ player, inventory: inventory ?? [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST — create character (upsert player row + populate starting inventory) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { supabase, session } = await getSupabaseAndSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { gameId } = await params
    const body = await request.json()
    const result = characterSchema.safeParse(body)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) errors[field] = issue.message
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { character_name, character_class, stats } = result.data
    const hp_max = calculateHpMax(character_class as CharacterClass, stats.CON)

    // Check for existing player in this game
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Character already exists. Use PATCH to update.' }, { status: 409 })
    }

    const { data: player, error } = await supabase
      .from('players')
      .insert({
        game_id: gameId,
        profile_id: session.user.id,
        character_name,
        character_class,
        stats,
        hp_max,
        hp_current: hp_max,
      })
      .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, status, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Populate starting inventory (non-blocking for character save)
    try {
      await setStartingInventory(player.id, character_class as CharacterClass)
    } catch {
      // Inventory population failure shouldn't block character creation
    }

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ player, inventory: inventory ?? [] }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH — update character (resets inventory on class change) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { supabase, session } = await getSupabaseAndSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { gameId } = await params
    const body = await request.json()
    const result = characterSchema.safeParse(body)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) errors[field] = issue.message
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { character_name, character_class, stats } = result.data
    const hp_max = calculateHpMax(character_class as CharacterClass, stats.CON)

    // Fetch existing player to detect class change
    const { data: existing } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .single()

    if (!existing) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    const { data: player, error } = await supabase
      .from('players')
      .update({
        character_name,
        character_class,
        stats,
        hp_max,
        hp_current: hp_max,
      })
      .eq('id', existing.id)
      .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, status, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Reset inventory on class change
    const classChanged = existing.character_class !== character_class
    if (classChanged) {
      try {
        await setStartingInventory(player.id, character_class as CharacterClass)
      } catch {
        // Inventory reset failure shouldn't block character update
      }
    }

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ player, inventory: inventory ?? [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
