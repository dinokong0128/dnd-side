import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

    // Find the player in this game
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('profile_id', user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ items: [] })
    }

    const { data: items, error } = await supabase
      .from('player_inventory')
      .select('id, player_id, item_name, quantity, properties, created_at')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch inventory: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: items ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
