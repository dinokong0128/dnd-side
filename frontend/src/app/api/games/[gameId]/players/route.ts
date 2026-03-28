import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CLASS_STARTING_INVENTORY,
  CLASS_HIT_DIE,
  calculateModifier,
  type CharacterClass,
} from '@/lib/game-data'

const VALID_CLASSES = [
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

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.enum(VALID_CLASSES, { error: 'Invalid class' }),
  stats: z.object({
    str: z.number().int().min(1).max(20),
    dex: z.number().int().min(1).max(20),
    con: z.number().int().min(1).max(20),
    int: z.number().int().min(1).max(20),
    wis: z.number().int().min(1).max(20),
    cha: z.number().int().min(1).max(20),
  }),
})

async function createSupabase() {
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
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  playerId: string,
  characterClass: CharacterClass
) {
  // Delete existing inventory (idempotent reset)
  await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  // Insert starting items for the class
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (items.length > 0) {
    const rows = items.map((item) => ({
      player_id: playerId,
      item_name: item.item_name,
      quantity: item.quantity,
      properties: item.properties,
    }))
    await supabase.from('player_inventory').insert(rows)
  }
}

// POST: Create or upsert character + populate inventory
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const parsed = characterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const hitDie = CLASS_HIT_DIE[parsed.data.character_class]
    const hpMax = hitDie + calculateModifier(parsed.data.stats.con)

    // Check for existing player (to detect class change)
    const { data: existing } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .maybeSingle()

    // Upsert player row
    const { data: player, error } = await supabase
      .from('players')
      .upsert(
        {
          game_id: gameId,
          profile_id: session.user.id,
          character_name: parsed.data.character_name,
          character_class: parsed.data.character_class,
          stats: parsed.data.stats,
          hp_max: hpMax,
        },
        { onConflict: 'game_id,profile_id' }
      )
      .select(
        'id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save character' },
        { status: 500 }
      )
    }

    // Populate inventory if new player or class changed
    const classChanged =
      !existing || existing.character_class !== parsed.data.character_class
    if (classChanged) {
      await populateInventory(supabase, player.id, parsed.data.character_class)
    }

    // Fetch inventory to return
    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('item_name')

    return NextResponse.json(
      { player, inventory: inventory ?? [] },
      { status: existing ? 200 : 201 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Update existing character + reset inventory on class change
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const parsed = characterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    // Fetch existing player
    const { data: existing } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'No character found to update' },
        { status: 404 }
      )
    }

    const hitDie = CLASS_HIT_DIE[parsed.data.character_class]
    const hpMax = hitDie + calculateModifier(parsed.data.stats.con)

    const { data: player, error } = await supabase
      .from('players')
      .update({
        character_name: parsed.data.character_name,
        character_class: parsed.data.character_class,
        stats: parsed.data.stats,
        hp_max: hpMax,
      })
      .eq('id', existing.id)
      .select(
        'id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update character' },
        { status: 500 }
      )
    }

    // Reset inventory if class changed
    if (existing.character_class !== parsed.data.character_class) {
      await populateInventory(supabase, player.id, parsed.data.character_class)
    }

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('item_name')

    return NextResponse.json({ player, inventory: inventory ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: Fetch current player + inventory (for client-side refresh)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params

    const { data: player } = await supabase
      .from('players')
      .select(
        'id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at'
      )
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ player: null, inventory: [] })
    }

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('item_name')

    return NextResponse.json({ player, inventory: inventory ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
