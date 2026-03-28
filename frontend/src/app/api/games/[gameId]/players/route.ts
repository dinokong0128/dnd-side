import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  calculateHpMax,
  type CharacterClass,
} from '@/lib/game-data'
import { setStartingInventory, fetchInventoryByPlayer } from '@/lib/supabase/players'

const characterBodySchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Invalid character class',
  }),
  stats: z.object({
    str: z.number().int().min(1).max(20),
    dex: z.number().int().min(1).max(20),
    con: z.number().int().min(1).max(20),
    int: z.number().int().min(1).max(20),
    wis: z.number().int().min(1).max(20),
    cha: z.number().int().min(1).max(20),
  }),
})

async function getSupabaseAndSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { supabase, session }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { supabase, session } = await getSupabaseAndSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const parsed = characterBodySchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) {
          errors[path] = issue.message
        }
      }
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
    }

    const cls = parsed.data.character_class as CharacterClass
    const hpMax = calculateHpMax(cls, parsed.data.stats.con)

    const { data: player, error } = await supabase
      .from('players')
      .upsert(
        {
          game_id: gameId,
          profile_id: session.user.id,
          character_name: parsed.data.character_name,
          character_class: parsed.data.character_class,
          hp_current: hpMax,
          hp_max: hpMax,
          stats: parsed.data.stats,
        },
        { onConflict: 'game_id,profile_id' }
      )
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to save character: ${error.message}` },
        { status: 500 }
      )
    }

    try {
      await setStartingInventory(player.id, cls)
    } catch {
      // Non-blocking: character save succeeded even if inventory population fails
    }

    const inventory = await fetchInventoryByPlayer(player.id)

    return NextResponse.json({ player, inventory }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { supabase, session } = await getSupabaseAndSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const parsed = characterBodySchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) {
          errors[path] = issue.message
        }
      }
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
    }

    // Fetch existing player to detect class change
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .single()

    if (!existingPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const cls = parsed.data.character_class as CharacterClass
    const hpMax = calculateHpMax(cls, parsed.data.stats.con)
    const classChanged = existingPlayer.character_class !== parsed.data.character_class

    const { data: player, error } = await supabase
      .from('players')
      .update({
        character_name: parsed.data.character_name,
        character_class: parsed.data.character_class,
        hp_current: hpMax,
        hp_max: hpMax,
        stats: parsed.data.stats,
      })
      .eq('id', existingPlayer.id)
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to update character: ${error.message}` },
        { status: 500 }
      )
    }

    if (classChanged) {
      try {
        await setStartingInventory(player.id, cls)
      } catch {
        // Non-blocking
      }
    }

    const inventory = await fetchInventoryByPlayer(player.id)

    return NextResponse.json({ player, inventory }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { supabase, session } = await getSupabaseAndSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params

    const { data: player } = await supabase
      .from('players')
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ player: null, inventory: [] }, { status: 200 })
    }

    const inventory = await fetchInventoryByPlayer(player.id)

    return NextResponse.json({ player, inventory }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
