import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  CLASS_STARTING_INVENTORY,
  calculateHpMax,
} from '@/lib/constants/starting-inventory'

const characterSchema = z.object({
  character_name: z.string().min(1).max(50),
  character_class: z.string().min(1),
  stats: z.object({
    str: z.number().int().min(1).max(20),
    dex: z.number().int().min(1).max(20),
    con: z.number().int().min(1).max(20),
    int: z.number().int().min(1).max(20),
    wis: z.number().int().min(1).max(20),
    cha: z.number().int().min(1).max(20),
  }),
})

async function setStartingInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  characterClass: string
) {
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (!items) return

  // Delete existing inventory
  await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  // Insert new items
  const rows = items.map((item) => ({
    player_id: playerId,
    item_name: item.item_name,
    quantity: item.quantity,
    properties: item.properties,
  }))

  await supabase.from('player_inventory').insert(rows)
}

// GET — Fetch player + inventory for client refresh
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: player } = await supabase
    .from('players')
    .select('id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at')
    .eq('profile_id', user.id)
    .eq('game_id', gameId)
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
}

// POST — Create character + populate starting inventory
export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = characterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { character_name, character_class, stats } = parsed.data
  const hp_max = calculateHpMax(character_class, stats.con)

  const { data: player, error } = await supabase
    .from('players')
    .upsert(
      {
        game_id: gameId,
        profile_id: user.id,
        character_name,
        character_class,
        stats,
        hp_max,
      },
      { onConflict: 'game_id,profile_id' }
    )
    .select('id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at')
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to save character: ${error.message}` },
      { status: 500 }
    )
  }

  // Populate starting inventory (non-blocking for character save)
  try {
    await setStartingInventory(supabase, player.id, character_class)
  } catch {
    // inventory population failure should not fail character creation
  }

  return NextResponse.json(player, { status: 201 })
}

// PATCH — Update character, reset inventory on class change
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = characterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { character_name, character_class, stats } = parsed.data
  const hp_max = calculateHpMax(character_class, stats.con)

  // Fetch existing player to detect class change
  const { data: existing } = await supabase
    .from('players')
    .select('id, character_class')
    .eq('profile_id', user.id)
    .eq('game_id', gameId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const classChanged = existing.character_class !== character_class

  const { data: player, error } = await supabase
    .from('players')
    .update({ character_name, character_class, stats, hp_max })
    .eq('id', existing.id)
    .select('id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at')
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to update character: ${error.message}` },
      { status: 500 }
    )
  }

  // Reset inventory if class changed
  if (classChanged) {
    try {
      await setStartingInventory(supabase, player.id, character_class)
    } catch {
      // non-blocking
    }
  }

  return NextResponse.json(player)
}
