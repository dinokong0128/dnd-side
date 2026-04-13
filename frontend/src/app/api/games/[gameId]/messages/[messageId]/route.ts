import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

type Params = Promise<{ gameId: string; messageId: string }>

async function getSessionAndParams(context: { params: Params }) {
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

  const { gameId, messageId } = await context.params
  return { session, gameId, messageId }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Params }
): Promise<NextResponse> {
  try {
    const { session, gameId, messageId } = await getSessionAndParams(context)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/games/${gameId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (response.ok) {
      return new NextResponse(null, { status: 204 })
    }

    const errorData = await response.json()
    return NextResponse.json(
      { error: errorData.detail || 'Backend error' },
      { status: response.status }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Params }
): Promise<NextResponse> {
  try {
    const { session, gameId, messageId } = await getSessionAndParams(context)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || !('content' in body)) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const content = (body as { content: unknown }).content
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 })
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/games/${gameId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ content: content.trim() }),
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data, { status: 200 })
    }

    const errorData = await response.json()
    return NextResponse.json(
      { error: errorData.detail || 'Backend error' },
      { status: response.status }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
