import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

/**
 * GET /api/games/[gameId]/events (DIN-66)
 *
 * SSE proxy: subscribes to the backend's Redis pub/sub channel for this game
 * and streams events (chunk / block / done) to the browser. The acting player
 * opens this after POST /actions returns 202; the backend streaming coroutine
 * publishes Claude's tokens to `stream:{gameId}` as they arrive.
 *
 * In DIN-67 (multiplayer streaming), every connected player opens this route
 * on mount — Redis pub/sub fans out natively, no backend changes needed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<Response> {
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { gameId } = await params
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

    const backendResponse = await fetch(`${backendUrl}/games/${gameId}/events`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (!backendResponse.ok) {
      // Errors from the backend are JSON, not streamed — forward status + detail.
      let detail = 'Backend error'
      try {
        const errorData = await backendResponse.json()
        detail = errorData.detail || detail
      } catch {
        // fall through
      }
      return new Response(JSON.stringify({ error: detail }), {
        status: backendResponse.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!backendResponse.body) {
      return new Response(JSON.stringify({ error: 'Backend returned no body' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(backendResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
