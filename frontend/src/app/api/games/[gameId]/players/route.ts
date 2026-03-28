import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculateHpMax,
  CHARACTER_CLASSES,
  CLASS_STARTING_INVENTORY,
} from '@/lib/supabase/players'

const statsSchema = z.object({
  str: z.number().int().min(1).max(20),
  dex: z.number().int().min(1).max(20),
  con: z.number().int().min(1).max(20),
  int: z.number().int().min(1).max(20),
  wis: z.number().int().min(1).max(20),
  cha: z.number().int().min(1).max(20),
})

const playerBodySchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Invalid character class',
  }),
  stats: statsSchema,
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
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const hpMax = calculateHpMax(parsed.data.character_class, parsed.data.stats.con)

    const { data: player, error: insertError } = await supabase
      .from('players')
      .insert({
        game_id: gameId,
        profile_id: session.user.id,
        character_name: parsed.data.character_name,
        character_class: parsed.data.character_class,
        stats: parsed.data.stats,
        hp_max: hpMax,
        hp_current: hpMax,
      })
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You already have a character in this game' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Populate starting inventory
    const items = CLASS_STARTING_INVENTORY[parsed.data.character_class]
    if (items && items.length > 0) {
      const rows = items.map((item) => ({
        player_id: player.id,
        item_name: item.item_name,
        quantity: item.quantity,
        properties: item.properties ?? null,
      }))

      const { error: inventoryError } = await supabase
        .from('player_inventory')
        .insert(rows)

      if (inventoryError) {
        return NextResponse.json(
          { error: `Character saved but inventory failed: ${inventoryError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(player, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const hpMax = calculateHpMax(parsed.data.character_class, parsed.data.stats.con)

    const { data: player, error: updateError } = await supabase
      .from('players')
      .update({
        character_name: parsed.data.character_name,
        character_class: parsed.data.character_class,
        stats: parsed.data.stats,
        hp_max: hpMax,
        hp_current: hpMax,
      })
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Reset inventory for new class
    const { error: deleteError } = await supabase
      .from('player_inventory')
      .delete()
      .eq('player_id', player.id)

    if (deleteError) {
      return NextResponse.json(
        { error: `Character updated but inventory reset failed: ${deleteError.message}` },
        { status: 500 }
      )
    }

    const items = CLASS_STARTING_INVENTORY[parsed.data.character_class]
    if (items && items.length > 0) {
      const rows = items.map((item) => ({
        player_id: player.id,
        item_name: item.item_name,
        quantity: item.quantity,
        properties: item.properties ?? null,
      }))

      const { error: inventoryError } = await supabase
        .from('player_inventory')
        .insert(rows)

      if (inventoryError) {
        return NextResponse.json(
          { error: `Character updated but inventory failed: ${inventoryError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(player)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
