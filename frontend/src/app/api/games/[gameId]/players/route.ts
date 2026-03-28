import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculateHpMax,
  CHARACTER_CLASSES,
  type CharacterClass,
} from '@/lib/game-data/characters'
import { setStartingInventory } from '@/lib/supabase/players'

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES as unknown as [string, ...string[]], {
    error: 'Please select a valid class',
  }),
  stats: z.object({
    str: z.number().int().min(1).max(20, { error: 'STR must be 1-20' }),
    dex: z.number().int().min(1).max(20, { error: 'DEX must be 1-20' }),
    con: z.number().int().min(1).max(20, { error: 'CON must be 1-20' }),
    int: z.number().int().min(1).max(20, { error: 'INT must be 1-20' }),
    wis: z.number().int().min(1).max(20, { error: 'WIS must be 1-20' }),
    cha: z.number().int().min(1).max(20, { error: 'CHA must be 1-20' }),
  }),
})

function createSupabaseClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseClient(cookieStore)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = characterSchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) {
          errors[path] = issue.message
        }
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { gameId } = await params
    const { character_name, character_class, stats } = parsed.data
    const hpMax = calculateHpMax(character_class as CharacterClass, stats.con)

    // Upsert player row
    const { data: player, error: upsertError } = await supabase
      .from('players')
      .upsert(
        {
          game_id: gameId,
          profile_id: session.user.id,
          character_name,
          character_class,
          stats,
          hp_max: hpMax,
          hp_current: hpMax,
        },
        { onConflict: 'game_id,profile_id' }
      )
      .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
      .single()

    if (upsertError) {
      return NextResponse.json(
        { error: `Failed to save character: ${upsertError.message}` },
        { status: 500 }
      )
    }

    // Populate starting inventory based on class
    try {
      await setStartingInventory(player.id, character_class as CharacterClass)
    } catch (err) {
      console.error('Failed to set starting inventory:', err)
      // Non-blocking: character is saved even if inventory fails
    }

    return NextResponse.json(player, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseClient(cookieStore)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params

    const { data: player, error } = await supabase
      .from('players')
      .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch player: ${error.message}` },
        { status: 500 }
      )
    }

    if (!player) {
      return NextResponse.json(null, { status: 200 })
    }

    // Fetch inventory
    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('item_name', { ascending: true })

    return NextResponse.json({ ...player, inventory: inventory ?? [] }, { status: 200 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
