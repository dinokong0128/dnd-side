import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CLASS_STARTING_INVENTORY,
  CLASS_HIT_DIE,
  CHARACTER_CLASSES,
} from '@/lib/constants/starting-inventory'

const statsSchema = z.object({
  str: z.number().int().min(1).max(20),
  dex: z.number().int().min(1).max(20),
  con: z.number().int().min(1).max(20),
  int: z.number().int().min(1).max(20),
  wis: z.number().int().min(1).max(20),
  cha: z.number().int().min(1).max(20),
})

const createPlayerSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES as [string, ...string[]], {
    error: 'Please select a valid class',
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

function calculateHpMax(characterClass: string, conScore: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((conScore - 10) / 2)
  return hitDie + conModifier
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await params
    const supabase = await getSupabaseClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createPlayerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { character_name, character_class, stats } = parsed.data
    const hpMax = calculateHpMax(character_class, stats.con)

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
      .select('*')
      .single()

    if (upsertError) {
      return NextResponse.json(
        { error: `Failed to save character: ${upsertError.message}` },
        { status: 500 }
      )
    }

    // Populate starting inventory
    const startingItems = CLASS_STARTING_INVENTORY[character_class]
    if (startingItems) {
      const { error: deleteError } = await supabase
        .from('player_inventory')
        .delete()
        .eq('player_id', player.id)

      if (deleteError) {
        return NextResponse.json(
          { error: `Failed to reset inventory: ${deleteError.message}` },
          { status: 500 }
        )
      }

      const rows = startingItems.map((item) => ({
        player_id: player.id,
        item_name: item.item_name,
        quantity: item.quantity,
        properties: item.properties,
      }))

      const { error: insertError } = await supabase
        .from('player_inventory')
        .insert(rows)

      if (insertError) {
        return NextResponse.json(
          { error: `Failed to set inventory: ${insertError.message}` },
          { status: 500 }
        )
      }
    }

    // Fetch the inventory to return with the player
    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ player, inventory: inventory ?? [] }, { status: 201 })
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
    const { gameId } = await params
    const supabase = await getSupabaseClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: player, error } = await supabase
      .from('players')
      .select('*')
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
      return NextResponse.json({ player: null, inventory: [] })
    }

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ player, inventory: inventory ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
