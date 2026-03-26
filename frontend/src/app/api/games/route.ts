import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const createGameBodySchema = z.object({
  name: z
    .string()
    .min(1, { error: 'Game name is required' })
    .max(100, { error: 'Game name must be 100 characters or less' }),
  dm_persona: z.string().optional(),
})

const DEFAULT_DM_PERSONA = 'A classic high-fantasy D&D adventure.'

export async function POST(request: NextRequest): Promise<NextResponse> {
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
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createGameBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const dmPersona = parsed.data.dm_persona?.trim() || DEFAULT_DM_PERSONA

    const { data: game, error } = await supabase
      .from('games')
      .insert({
        name: parsed.data.name,
        dm_persona: dmPersona,
        created_by: user.id,
      })
      .select('id, name, dm_persona, status, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create game' },
        { status: 500 }
      )
    }

    return NextResponse.json(game, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
