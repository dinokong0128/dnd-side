import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { D5E_CLASSES, CLASS_HIT_DIE } from '@/lib/config/character'

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

function calculateHpMax(characterClass: string, conScore: number): number {
  const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
  const conModifier = Math.floor((conScore - 10) / 2)
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

    return NextResponse.json(player)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
