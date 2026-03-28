import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CLASS_STARTING_INVENTORY } from '@/lib/constants/starting-inventory'

const D5E_CLASSES = [
  'Fighter',
  'Wizard',
  'Rogue',
  'Cleric',
  'Ranger',
  'Barbarian',
  'Paladin',
  'Druid',
  'Bard',
  'Monk',
  'Sorcerer',
  'Warlock',
] as const

const statSchema = z.number().int().min(1).max(20)

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, 'Character name is required')
    .max(50, 'Character name must be 50 characters or less'),
  character_class: z.enum(D5E_CLASSES, {
    error: 'Please select a valid class',
  }),
  stats: z.object({
    str: statSchema,
    dex: statSchema,
    con: statSchema,
    int: statSchema,
    wis: statSchema,
    cha: statSchema,
  }),
})

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
}

function calculateHpMax(characterClass: string, conScore: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((conScore - 10) / 2)
  return hitDie + conModifier
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setStartingInventory(supabase: any, playerId: string, characterClass: string) {
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (!items) return

  // Delete existing inventory (idempotent reset)
  await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  // Insert new class items
  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties,
  }))

  const { error } = await supabase.from('player_inventory').insert(rows)
  if (error) {
    throw new Error(`Failed to set starting inventory: ${error.message}`)
  }
}

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

// GET: fetch the current user's player and inventory for this game
export async function GET(
  _request: NextRequest,
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

    const { data: player, error } = await supabase
      .from('players')
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    // Fetch inventory
    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties, created_at')
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
    const result = characterSchema.safeParse(body)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { character_name, character_class, stats } = result.data
    const hpMax = calculateHpMax(character_class, stats.con)

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
        character_name,
        character_class,
        stats,
        hp_max: hpMax,
        hp_current: hpMax,
      })
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to create character: ${error.message}` },
        { status: 500 }
      )
    }

    // Populate starting inventory based on class
    try {
      await setStartingInventory(supabase, player.id, character_class)
    } catch (invError) {
      return NextResponse.json(
        { error: invError instanceof Error ? invError.message : 'Failed to set starting inventory' },
        { status: 500 }
      )
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
    const result = characterSchema.safeParse(body)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { character_name, character_class, stats } = result.data
    const hpMax = calculateHpMax(character_class, stats.con)

    const { data: player, error } = await supabase
      .from('players')
      .update({
        character_name,
        character_class,
        stats,
        hp_max: hpMax,
        hp_current: hpMax,
      })
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
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

    // Reset starting inventory when class changes
    try {
      await setStartingInventory(supabase, player.id, character_class)
    } catch (invError) {
      return NextResponse.json(
        { error: invError instanceof Error ? invError.message : 'Failed to reset starting inventory' },
        { status: 500 }
      )
    }

    return NextResponse.json(player)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
