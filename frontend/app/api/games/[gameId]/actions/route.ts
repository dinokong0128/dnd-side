# frontend/app/api/games/[gameId]/actions/route.ts
"""
Next.js API Route: POST /api/games/{gameId}/actions
Bridges frontend action to FastAPI backend
Handles token refresh, error handling
"""
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    // Get session from Supabase Auth
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse request body
    const { action_text, action_type } = await request.json()
    
    if (!action_text) {
      return NextResponse.json(
        { error: 'action_text required' },
        { status: 400 }
      )
    }
    
    // Get player_id from database (user owns this player)
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('player_id, game_id')
      .eq('user_id', session.user.id)
      .eq('game_id', params.gameId)
      .single()
    
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found in this game' },
        { status: 403 }
      )
    }
    
    // Call FastAPI backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const response = await fetch(
      `${backendUrl}/games/${params.gameId}/actions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          player_id: player.player_id,
          action_text,
          action_type: action_type || 'general',
        }),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.detail || 'Backend error' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json(data, { status: 202 })
    
  } catch (error) {
    console.error('Action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
