import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const statsSchema = z.object(
  Object.fromEntries(
    ABILITY_NAMES.map((name) => [
      name,
      z
        .number()
        .int()
        .min(1, { message: `${name.toUpperCase()} must be at least 1` })
        .max(20, { message: `${name.toUpperCase()} must be at most 20` }),
    ])
  ) as Record<(typeof ABILITY_NAMES)[number], z.ZodNumber>
)

const CHARACTER_CLASSES = [
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

const playerBodySchema = z.object({
  character_name: z
    .string()
    .min(1, { message: 'Character name is required' })
    .max(50, { message: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    message: 'Please select a valid class',
  }),
  stats: statsSchema,
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

type StartingItem = {
  item_name: string
  quantity: number
  properties?: Record<string, unknown>
}

const CLASS_STARTING_INVENTORY: Record<string, StartingItem[]> = {
  Fighter: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Handaxe', quantity: 5, properties: { type: 'weapon' } },
  ],
  Wizard: [
    { item_name: 'Spellbook', quantity: 1, properties: { type: 'focus' } },
    { item_name: 'Arcane Focus (Staff)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Rogue: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shortbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Thieves' Tools", quantity: 1, properties: { type: 'tool' } },
    { item_name: "Burglar's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Cleric: [
    { item_name: 'Mace', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Scale Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Priest's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Ranger: [
    { item_name: 'Longbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Arrows', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Barbarian: [
    { item_name: 'Greataxe', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Handaxe', quantity: 2, properties: { type: 'weapon' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Javelin', quantity: 4, properties: { type: 'weapon' } },
  ],
  Paladin: [
    { item_name: 'Longsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Shield', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Chain Mail', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Holy Symbol', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Druid: [
    { item_name: 'Quarterstaff', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Druidic Focus', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Explorer's Pack", quantity: 1, properties: { type: 'pack' } },
  ],
  Bard: [
    { item_name: 'Rapier', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Leather Armor', quantity: 1, properties: { type: 'armor' } },
    { item_name: 'Lute', quantity: 1, properties: { type: 'instrument' } },
    { item_name: "Diplomat's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Monk: [
    { item_name: 'Shortsword', quantity: 1, properties: { type: 'weapon' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dart', quantity: 10, properties: { type: 'weapon' } },
  ],
  Sorcerer: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Arcane Focus (Crystal)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Dungeoneer's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
  Warlock: [
    { item_name: 'Light Crossbow', quantity: 1, properties: { type: 'weapon' } },
    { item_name: 'Bolts', quantity: 20, properties: { type: 'ammo' } },
    { item_name: 'Arcane Focus (Wand)', quantity: 1, properties: { type: 'focus' } },
    { item_name: "Scholar's Pack", quantity: 1, properties: { type: 'pack' } },
    { item_name: 'Dagger', quantity: 1, properties: { type: 'weapon' } },
  ],
}

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

    const { character_name, character_class, stats } = parsed.data

    // Calculate HP from class hit die + CON modifier
    const hitDie = CLASS_HIT_DIE[character_class] ?? 8
    const conModifier = Math.floor((stats.con - 10) / 2)
    const hpMax = Math.max(1, hitDie + conModifier)

    // Check if player already exists (to detect class change for inventory reset)
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id, character_class')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    const classChanged =
      existingPlayer && existingPlayer.character_class !== character_class

    // Upsert player
    const { data: player, error: upsertError } = await supabase
      .from('players')
      .upsert(
        {
          game_id: gameId,
          profile_id: session.user.id,
          character_name,
          character_class,
          stats,
          hp_current: hpMax,
          hp_max: hpMax,
        },
        { onConflict: 'game_id,profile_id' }
      )
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      )
    }

    // Set starting inventory if new player or class changed
    if (!existingPlayer || classChanged) {
      // Delete existing inventory
      await supabase
        .from('player_inventory')
        .delete()
        .eq('player_id', player.id)

      // Insert class starting items
      const items = CLASS_STARTING_INVENTORY[character_class]
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
    }

    // Fetch inventory to return with response
    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties, created_at')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    return NextResponse.json(
      { player, inventory: inventory ?? [] },
      { status: existingPlayer ? 200 : 201 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
