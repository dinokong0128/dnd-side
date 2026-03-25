import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    const { action_text, action_type } = await request.json()

    if (!action_text) {
      return NextResponse.json(
        { error: 'action_text required' },
        { status: 400 }
      )
    }

    const { gameId } = await params

    const { data: player } = await supabase
      .from('players')
      .select('id, game_id')
      .eq('profile_id', session.user.id)
      .eq('game_id', gameId)
      .single()

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found in this game' },
        { status: 403 }
      )
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/games/${gameId}/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        player_id: player.id,
        action_text,
        action_type: action_type || 'general',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.detail || 'Backend error' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 202 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
