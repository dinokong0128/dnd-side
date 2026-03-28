import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createPlayer,
  updatePlayer,
  getPlayerByGameAndProfile,
  setStartingInventory,
} from '@/lib/supabase/players'
import { calculateHpMax } from '@/lib/game-data'

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
  character_class: z.enum(
    [
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
    ],
    { error: 'Invalid character class' }
  ),
  stats: statsSchema,
})

async function getSession() {
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
  return session
}

// POST: Create a new character
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getSession()
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

    // Check if player already exists in this game
    const existing = await getPlayerByGameAndProfile(gameId, session.user.id)
    if (existing) {
      return NextResponse.json(
        { error: 'Character already exists. Use PATCH to update.' },
        { status: 409 }
      )
    }

    const hpMax = calculateHpMax(
      parsed.data.character_class,
      parsed.data.stats.con
    )

    const player = await createPlayer({
      game_id: gameId,
      profile_id: session.user.id,
      character_name: parsed.data.character_name,
      character_class: parsed.data.character_class,
      stats: parsed.data.stats,
      hp_max: hpMax,
    })

    // Populate starting inventory based on class
    await setStartingInventory(player.id, parsed.data.character_class)

    return NextResponse.json(player, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Update an existing character
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getSession()
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

    const existing = await getPlayerByGameAndProfile(gameId, session.user.id)
    if (!existing) {
      return NextResponse.json(
        { error: 'No character found to update' },
        { status: 404 }
      )
    }

    const hpMax = calculateHpMax(
      parsed.data.character_class,
      parsed.data.stats.con
    )

    const player = await updatePlayer(existing.id, {
      character_name: parsed.data.character_name,
      character_class: parsed.data.character_class,
      stats: parsed.data.stats,
      hp_max: hpMax,
    })

    // Reset inventory if class changed
    if (existing.character_class !== parsed.data.character_class) {
      await setStartingInventory(player.id, parsed.data.character_class)
    }

    return NextResponse.json(player)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
