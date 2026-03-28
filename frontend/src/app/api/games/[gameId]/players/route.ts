import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  calculateHpMax,
  CLASS_STARTING_INVENTORY,
  type CharacterClass,
} from '@/lib/game-data/characters'

const abilityScore = z.number().int().min(1).max(20)

const playerSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a valid class',
  }),
  stats: z.object({
    str: abilityScore,
    dex: abilityScore,
    con: abilityScore,
    int: abilityScore,
    wis: abilityScore,
    cha: abilityScore,
  }),
})

async function setStartingInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  characterClass: CharacterClass
) {
  // Delete existing inventory (idempotent reset)
  const { error: deleteError } = await supabase
    .from('player_inventory')
    .delete()
    .eq('player_id', playerId)

  if (deleteError) {
    throw new Error(`Failed to clear inventory: ${deleteError.message}`)
  }

  // Insert new class items
  const items = CLASS_STARTING_INVENTORY[characterClass]
  if (items.length > 0) {
    const rows = items.map((item) => ({
      player_id: playerId,
      item_name: item.item_name,
      quantity: item.quantity,
      properties: item.properties,
    }))

    const { error: insertError } = await supabase
      .from('player_inventory')
      .insert(rows)

    if (insertError) {
      throw new Error(`Failed to populate inventory: ${insertError.message}`)
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params
    const body = await request.json()
    const result = playerSchema.safeParse(body)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) {
          errors[path] = issue.message
        }
      }
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { character_name, character_class, stats } = result.data
    const hp_max = calculateHpMax(character_class, stats.con)

    // Upsert: check if player already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('profile_id', user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    let player
    const previousClass = existing?.character_class

    if (existing) {
      const { data, error } = await supabase
        .from('players')
        .update({
          character_name,
          character_class,
          stats,
          hp_current: hp_max,
          hp_max,
        })
        .eq('id', existing.id)
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
      player = data
    } else {
      const { data, error } = await supabase
        .from('players')
        .insert({
          game_id: gameId,
          profile_id: user.id,
          character_name,
          character_class,
          stats,
          hp_current: hp_max,
          hp_max,
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
      player = data
    }

    // Populate inventory if new character or class changed
    if (!existing || previousClass !== character_class) {
      try {
        await setStartingInventory(
          supabase,
          player.id,
          character_class as CharacterClass
        )
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : 'Failed to populate inventory',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(player, { status: existing ? 200 : 201 })
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameId } = await params

    const { data, error } = await supabase
      .from('players')
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .eq('profile_id', user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch player: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ player: data })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
