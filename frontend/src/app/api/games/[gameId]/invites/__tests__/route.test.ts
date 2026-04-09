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

function makeRequest() {
  return new NextRequest(new URL('http://localhost/api/games/game-1/invites'), {
    method: 'POST',
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

describe('POST /api/games/[gameId]/invites', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('proxies to backend with bearer token and returns the invite payload', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ code: 'ABC123', expires_at: '2026-05-01' }),
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-xyz' }),
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/games/game-xyz/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        },
      }
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      code: 'ABC123',
      expires_at: '2026-05-01',
    })
  })

  it('forwards backend error status with detail', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Only host can create invites' }),
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'Only host can create invites',
    })
  })

  it('falls back to "Failed to create invite" when detail missing', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to create invite' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
