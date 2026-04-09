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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/games'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'bearer-tok', user: { id: 'u' } } },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.test'
  global.fetch = jest.fn()
})

describe('POST /api/games', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    const res = await POST(makeRequest({ name: 'Game', dm_persona: 'DM' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 when the name field is missing entirely', async () => {
    mockAuthed()

    const res = await POST(makeRequest({ dm_persona: 'A realm' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/expected string/i)
  })

  it('returns "Game name is required" when the name is empty', async () => {
    mockAuthed()

    const res = await POST(makeRequest({ name: '', dm_persona: 'A realm' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Game name is required' })
  })

  it('returns 400 when the name is too long', async () => {
    mockAuthed()

    const res = await POST(
      makeRequest({ name: 'a'.repeat(101), dm_persona: 'A realm' })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Game name must be 100 characters or less',
    })
  })

  it('proxies to the backend with the bearer token and returns the response', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'game-new', name: 'Test' }),
    })

    const res = await POST(makeRequest({ name: 'Test', dm_persona: 'DM' }))

    expect(global.fetch).toHaveBeenCalledWith('http://backend.test/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer bearer-tok',
      },
      body: JSON.stringify({ name: 'Test', dm_persona: 'DM' }),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'game-new', name: 'Test' })
  })

  it('forwards an omitted dm_persona as undefined (zod treats it as optional)', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'game-new', name: 'Test' }),
    })

    await POST(makeRequest({ name: 'Test' }))

    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string
    )
    expect(body).toEqual({ name: 'Test' })
    expect(body.dm_persona).toBeUndefined()
  })

  it('forwards backend error response and status', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Duplicate name' }),
    })

    const res = await POST(makeRequest({ name: 'Test' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Duplicate name' })
  })

  it('falls back to a generic backend error message when detail is missing', async () => {
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const res = await POST(makeRequest({ name: 'Test' }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Backend error' })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockGetSession.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await POST(makeRequest({ name: 'Test' }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })

  it('defaults backend URL to localhost:8000 when NEXT_PUBLIC_BACKEND_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_BACKEND_URL
    mockAuthed()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    })

    await POST(makeRequest({ name: 'Test' }))

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/games',
      expect.any(Object)
    )
  })
})
