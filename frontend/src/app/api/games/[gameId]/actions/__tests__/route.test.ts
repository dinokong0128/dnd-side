/** @jest-environment node */

import { POST } from '../route'
import { NextRequest } from 'next/server'
import { ACTION_MAX_LENGTH } from '@/lib/validations/action'

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
  return new NextRequest(new URL('http://localhost/api/games/game-1/actions'), {
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

describe('POST /api/games/[gameId]/actions', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    const res = await POST(makeRequest({ action_text: 'Attack' }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 when action_text is missing', async () => {
    mockAuthed()

    const res = await POST(makeRequest({}), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'action_text required' })
  })

  it('returns 400 when action_text is whitespace only', async () => {
    mockAuthed()

    const res = await POST(makeRequest({ action_text: '   ' }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'action_text required' })
  })

  it('returns 400 when action_text is not a string', async () => {
    mockAuthed()

    const res = await POST(makeRequest({ action_text: 42 }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'action_text required' })
  })

  it(`returns 400 when action_text exceeds ${ACTION_MAX_LENGTH} chars`, async () => {
    mockAuthed()

    const res = await POST(
      makeRequest({ action_text: 'a'.repeat(ACTION_MAX_LENGTH + 1) }),
      { params: Promise.resolve({ gameId: 'game-1' }) }
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: `Action text exceeds ${ACTION_MAX_LENGTH} character limit`,
    })
  })

  it(`accepts action_text at exactly ${ACTION_MAX_LENGTH} chars`, async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ message_id: 'msg-1' }),
    })

    const res = await POST(
      makeRequest({ action_text: 'a'.repeat(ACTION_MAX_LENGTH) }),
      { params: Promise.resolve({ gameId: 'game-1' }) }
    )

    expect(res.status).toBe(202)
  })

  it('proxies trimmed action_text to backend with bearer token and returns 202', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ message_id: 'msg-1', status: 'queued' }),
    })

    const res = await POST(
      makeRequest({ action_text: '  Cast fireball  ' }),
      { params: Promise.resolve({ gameId: 'game-xyz' }) }
    )

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/games/game-xyz/actions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        },
        body: JSON.stringify({ action_text: 'Cast fireball' }),
      }
    )
    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({
      message_id: 'msg-1',
      status: 'queued',
    })
  })

  it('forwards client_id when supplied', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ message_id: 'msg-1', status: 'queued' }),
    })

    await POST(
      makeRequest({
        action_text: 'Attack',
        client_id: '11111111-2222-3333-4444-555555555555',
      }),
      { params: Promise.resolve({ gameId: 'game-1' }) }
    )

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const parsed = JSON.parse(init.body)
    expect(parsed).toEqual({
      action_text: 'Attack',
      client_id: '11111111-2222-3333-4444-555555555555',
    })
  })

  it('omits client_id when absent', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ message_id: 'msg-1', status: 'queued' }),
    })

    await POST(makeRequest({ action_text: 'Attack' }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const parsed = JSON.parse(init.body)
    expect('client_id' in parsed).toBe(false)
  })

  it('forwards backend error status and detail', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Game is not active' }),
    })

    const res = await POST(makeRequest({ action_text: 'Attack' }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Game is not active' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await POST(makeRequest({ action_text: 'Attack' }), {
      params: Promise.resolve({ gameId: 'game-1' }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
