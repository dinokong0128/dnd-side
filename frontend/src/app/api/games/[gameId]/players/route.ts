import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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

const playerSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a valid class',
  }),
  stats: z.object({
    str: z.number().int().min(1).max(20),
    dex: z.number().int().min(1).max(20),
    con: z.number().int().min(1).max(20),
    int: z.number().int().min(1).max(20),
    wis: z.number().int().min(1).max(20),
    cha: z.number().int().min(1).max(20),
  }),
})

const CLASS_HIT_DIE: Record<string, number> = {
  Fighter: 10,
  Wizard: 6,
  Rogue: 8,
  Cleric: 8,
  Ranger: 10,
  Barbarian: 12,
  Paladin: 10,
  Druid: 8,
  Bard: 8,
  Monk: 8,
  Sorcerer: 6,
  Warlock: 8,
}

function calculateHpMax(characterClass: string, con: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((con - 10) / 2)
  return hitDie + conModifier
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
    const parsed = playerSchema.safeParse(body)

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
    const hpMax = calculateHpMax(character_class, stats.con)

    const { data: player, error } = await supabase
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
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to save character: ${error.message}` },
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
    const parsed = playerSchema.safeParse(body)

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
      .eq('game_id', gameId)
      .eq('profile_id', session.user.id)
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

    return NextResponse.json(player)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
