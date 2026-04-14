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
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

function makeParams(gameId = 'game-1', messageId = 'msg-1') {
  return { params: Promise.resolve({ gameId, messageId }) }
}

function makeDeleteRequest() {
  return new NextRequest(
    new URL('http://localhost/api/games/game-1/messages/msg-1'),
    { method: 'DELETE' }
  )
}

function makePatchRequest(body: unknown) {
  return new NextRequest(
    new URL('http://localhost/api/games/game-1/messages/msg-1'),
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'tok', user: { id: 'u' } } },
  })
}

function mockUnauthed() {
  mockGetSession.mockResolvedValueOnce({ data: { session: null } })
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
    mockUnauthed()

    const res = await DELETE(makeDeleteRequest(), makeParams())

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('proxies DELETE to backend with bearer token and returns 204', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 204,
    })

    const res = await DELETE(makeDeleteRequest(), makeParams('game-xyz', 'msg-abc'))

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/games/game-xyz/messages/msg-abc',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok' },
      }
    )
    expect(res.status).toBe(204)
  })

  it('forwards backend error status and detail', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Can only delete the last message' }),
    })

    const res = await DELETE(makeDeleteRequest(), makeParams())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'Can only delete the last message',
    })
  })

  it('returns generic "Backend error" when detail is missing', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const res = await DELETE(makeDeleteRequest(), makeParams())

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Backend error' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await DELETE(makeDeleteRequest(), makeParams())

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})

describe('PATCH /api/games/[gameId]/messages/[messageId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockUnauthed()

    const res = await PATCH(makePatchRequest({ content: 'New text' }), makeParams())

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('proxies PATCH to backend with bearer token and returns 200 with JSON', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg-1',
        content: 'New text',
        role: 'player',
      }),
    })

    const res = await PATCH(
      makePatchRequest({ content: 'New text' }),
      makeParams('game-xyz', 'msg-abc')
    )

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/games/game-xyz/messages/msg-abc',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        },
        body: JSON.stringify({ content: 'New text' }),
      }
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 'msg-1',
      content: 'New text',
      role: 'player',
    })
  })

  it('forwards backend 409 with error detail', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Can only edit the last message' }),
    })

    const res = await PATCH(makePatchRequest({ content: 'New' }), makeParams())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Can only edit the last message' })
  })

  it('returns generic "Backend error" when detail is missing', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({}),
    })

    const res = await PATCH(makePatchRequest({ content: '' }), makeParams())

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Backend error' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('network failure')
    })

    const res = await PATCH(makePatchRequest({ content: 'text' }), makeParams())

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
