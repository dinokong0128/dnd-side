/** @jest-environment node */

import { DELETE, PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetSession = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

const GAME_ID = 'game-1'
const MSG_ID = 'msg-1'

function makeDeleteRequest(): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/games/${GAME_ID}/messages/${MSG_ID}`),
    { method: 'DELETE' }
  )
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/games/${GAME_ID}/messages/${MSG_ID}`),
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

function makeParams(): { params: Promise<{ gameId: string; messageId: string }> } {
  return { params: Promise.resolve({ gameId: GAME_ID, messageId: MSG_ID }) }
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'tok', user: { id: 'u1' } } },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test'
  global.fetch = jest.fn()
})

describe('DELETE /api/games/[gameId]/messages/[messageId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('forwards DELETE to backend and returns 204', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204 })
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(204)
    expect(global.fetch).toHaveBeenCalledWith(
      `http://backend.test/games/${GAME_ID}/messages/${MSG_ID}`,
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('forwards backend error status', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Not last message' }),
    })
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/games/[gameId]/messages/[messageId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })
    const res = await PATCH(makePatchRequest({ content: 'Hello' }), makeParams())
    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 when content is missing', async () => {
    mockAuthed()
    const res = await PATCH(makePatchRequest({}), makeParams())
    expect(res.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 when content is empty string', async () => {
    mockAuthed()
    const res = await PATCH(makePatchRequest({ content: '   ' }), makeParams())
    expect(res.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('forwards PATCH to backend and returns 200 with updated message', async () => {
    mockAuthed()
    const updated = { id: MSG_ID, content: 'New content' }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updated,
    })
    const res = await PATCH(makePatchRequest({ content: 'New content' }), makeParams())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
  })

  it('forwards backend error status on PATCH failure', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Not last message' }),
    })
    const res = await PATCH(makePatchRequest({ content: 'Hello' }), makeParams())
    expect(res.status).toBe(409)
  })
})
