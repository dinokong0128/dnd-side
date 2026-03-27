import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CLASS_STARTING_INVENTORY,
  CHARACTER_CLASSES,
} from '@/lib/supabase/players'

const playerBodySchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
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
    hp_max: z.number().int().min(1),
  }),
})

async function getSupabaseClient() {
  const cookieStore = await cookies()
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

async function populateInventory(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  playerId: string,
  characterClass: string
) {
  // Delete existing inventory
  await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  // Insert new class items
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (!items || items.length === 0) return

  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties,
  }))

  const { error } = await supabase.from('player_inventory').insert(rows)
  if (error) {
    console.error('Failed to set starting inventory:', error.message)
  }
}

// POST — Create new player character
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const parsed = playerBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    // Check if player already exists in this game
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Character already exists. Use PATCH to update.' },
        { status: 409 }
      )
    }

    const { data: player, error } = await supabase
      .from('players')
      .insert({
        game_id: gameId,
        profile_id: session.user.id,
        character_name: parsed.data.character_name,
        character_class: parsed.data.character_class,
        stats: parsed.data.stats,
      })
      .select('id, game_id, profile_id, character_name, character_class, stats, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to create character: ${error.message}` },
        { status: 500 }
      )
    }

    // Populate starting inventory
    await populateInventory(supabase, player.id, parsed.data.character_class)

    return NextResponse.json(player, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH — Update existing player character
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const parsed = playerBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    // Find existing player
    const { data: existing } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: 'No character found. Use POST to create one.' },
        { status: 404 }
      )
    }

    const { data: player, error } = await supabase
      .from('players')
      .update({
        character_name: parsed.data.character_name,
        character_class: parsed.data.character_class,
        stats: parsed.data.stats,
      })
      .eq('id', existing.id)
      .select('id, game_id, profile_id, character_name, character_class, stats, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to update character: ${error.message}` },
        { status: 500 }
      )
    }

    // Reset inventory if class changed
    const classChanged = existing.character_class !== parsed.data.character_class
    if (classChanged || !existing.character_class) {
      await populateInventory(supabase, player.id, parsed.data.character_class)
    }

    return NextResponse.json(player)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
