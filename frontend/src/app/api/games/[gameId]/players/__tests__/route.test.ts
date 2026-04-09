/** @jest-environment node */

import { POST } from '../route'
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

function makeRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/games/game-1/players'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'tok', user: { id: 'u' } } },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test'
  global.fetch = jest.fn()
})

describe('POST /api/games/[gameId]/players', () => {
  const sampleBody = {
    character_name: 'Aragorn',
    character_class: 'Fighter',
    race: 'Human',
    level: 1,
    stats: { str: 15, dex: 12, con: 14, int: 10, wis: 11, cha: 8 },
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    const res = await POST(makeRequest(sampleBody), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('passes the body through to backend untouched', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 'player-1' }),
    })

    await POST(makeRequest(sampleBody), {
      params: Promise.resolve({ gameId: 'game-abc' }),
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/games/game-abc/players',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        },
        body: JSON.stringify(sampleBody),
      }
    )
  })

  it('returns the backend response text verbatim with its status', async () => {
    mockAuthed()
    const backendText = JSON.stringify({ id: 'player-1', character_name: 'Aragorn' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => backendText,
    })

    const res = await POST(makeRequest(sampleBody), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.text()).toBe(backendText)
  })

  it('forwards backend error status with error payload as text', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ detail: 'Character exists' }),
    })

    const res = await POST(makeRequest(sampleBody), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(422)
    const parsed = await res.json()
    expect(parsed).toEqual({ detail: 'Character exists' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await POST(makeRequest(sampleBody), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
