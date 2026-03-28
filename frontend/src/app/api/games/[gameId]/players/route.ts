import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CLASS_STARTING_INVENTORY,
  CHARACTER_CLASSES,
  calculateHpMax,
  type CharacterClass,
} from '@/lib/constants/starting-inventory'

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a valid class',
  }),
  stats: z.object({
    STR: z.number().int().min(1).max(20),
    DEX: z.number().int().min(1).max(20),
    CON: z.number().int().min(1).max(20),
    INT: z.number().int().min(1).max(20),
    WIS: z.number().int().min(1).max(20),
    CHA: z.number().int().min(1).max(20),
  }),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
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

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = characterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { gameId } = await params
    const { character_name, character_class, stats } = parsed.data
    const hp_max = calculateHpMax(character_class, stats.CON)

    // Check if player already exists in this game
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
      .maybeSingle()

    let player

    if (existing) {
      const { data, error } = await supabase
        .from('players')
        .update({
          character_name,
          character_class,
          stats,
          hp_max,
          hp_current: hp_max,
        })
        .eq('id', existing.id)
        .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
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
          profile_id: session.user.id,
          character_name,
          character_class,
          stats,
          hp_max,
          hp_current: hp_max,
        })
        .select('id, game_id, profile_id, character_name, character_class, stats, hp_current, hp_max, created_at')
        .single()

      if (error) {
        return NextResponse.json(
          { error: `Failed to create character: ${error.message}` },
          { status: 500 }
        )
      }
      player = data
    }

    // Populate starting inventory (idempotent: delete then insert)
    const { error: deleteError } = await supabase
      .from('player_inventory')
      .delete()
      .eq('player_id', player.id)

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to clear inventory: ${deleteError.message}` },
        { status: 500 }
      )
    }

    const startingItems = CLASS_STARTING_INVENTORY[character_class as CharacterClass]
    const inventoryRows = startingItems.map((item) => ({
      player_id: player.id,
      item_name: item.item_name,
      quantity: item.quantity,
      properties: item.properties,
    }))

    const { error: insertError } = await supabase
      .from('player_inventory')
      .insert(inventoryRows)

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to set starting inventory: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Fetch the inventory to return
    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties')
      .eq('player_id', player.id)
      .order('item_name')

    return NextResponse.json({ player, inventory: inventory ?? [] }, { status: existing ? 200 : 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
