/** @jest-environment node */

import { GET } from '../route'
import { NextRequest } from 'next/server'

const mockGetSession = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

function makeRequest() {
  return new NextRequest(new URL('http://localhost/api/games/game-1/events'), {
    method: 'GET',
  })
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'tok', user: { id: 'u' } } },
  })
}

/** Build a ReadableStream that emits the given SSE frames. */
function streamBody(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test'
  global.fetch = jest.fn()
})

describe('GET /api/games/[gameId]/events', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('proxies the SSE stream through with event-stream headers', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: streamBody([
        'data: {"type":"chunk","text":"Hi"}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    })

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-xyz' }),
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/games/game-xyz/events',
      { headers: { Authorization: 'Bearer tok' } }
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    expect(res.headers.get('x-accel-buffering')).toBe('no')

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let all = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      all += decoder.decode(value, { stream: true })
    }
    expect(all).toContain('{"type":"chunk","text":"Hi"}')
    expect(all).toContain('{"type":"done"}')
  })

  it('forwards backend error status and detail', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Backend down' }),
    })

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Backend down' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
