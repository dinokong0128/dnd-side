/**
 * Shared harness for POST routes that proxy session-lifecycle commands
 * (start, pause, resume, end) to the backend. These four routes share
 * an identical skeleton: auth check → forward to
 * `{backend}/games/:gameId/{verb}` → return backend response.
 *
 * This file lives outside any `__tests__/` directory so Jest does not
 * pick it up as a standalone test suite.
 */

import { NextRequest, NextResponse } from 'next/server'

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<{ gameId: string }> }
) => Promise<NextResponse>

interface HarnessMocks {
  getSession: jest.Mock
}

export function makeContext(gameId = 'game-1') {
  return { params: Promise.resolve({ gameId }) }
}

export function makeRequest(path: string) {
  return new NextRequest(new URL(`http://localhost${path}`), { method: 'POST' })
}

export function setupLifecycleSuite(
  verb: 'start' | 'pause' | 'resume' | 'end',
  POST: Handler,
  mocks: HarnessMocks
) {
  const path = `/api/games/game-1/${verb}`

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test'
    global.fetch = jest.fn()
  })

  describe(`POST /api/games/[gameId]/${verb}`, () => {
    it('returns 401 when not authenticated', async () => {
      mocks.getSession.mockResolvedValueOnce({ data: { session: null } })

      const res = await POST(makeRequest(path), makeContext())

      expect(res.status).toBe(401)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it(`proxies to backend /games/:gameId/${verb} with bearer token`, async () => {
      mocks.getSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok', user: { id: 'u' } } },
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      const res = await POST(makeRequest(path), makeContext('game-xyz'))

      expect(global.fetch).toHaveBeenCalledWith(
        `http://backend.test/games/game-xyz/${verb}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok',
          },
        }
      )
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status: 'ok' })
    })

    it('forwards backend error status and message', async () => {
      mocks.getSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok', user: { id: 'u' } } },
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ detail: 'Cannot transition to this state' }),
      })

      const res = await POST(makeRequest(path), makeContext())

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: 'Cannot transition to this state',
      })
    })

    it('returns generic "Backend error" when detail is missing', async () => {
      mocks.getSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok', user: { id: 'u' } } },
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      })

      const res = await POST(makeRequest(path), makeContext())

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Backend error' })
    })

    it('returns 500 on an unexpected exception', async () => {
      mocks.getSession.mockImplementationOnce(() => {
        throw new Error('boom')
      })

      const res = await POST(makeRequest(path), makeContext())

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Internal server error' })
    })
  })
}
