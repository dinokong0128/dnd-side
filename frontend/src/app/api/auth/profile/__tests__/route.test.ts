/** @jest-environment node */

import { PATCH } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockFrom = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/auth/profile'), {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

  mockFrom.mockReturnValue({ update: mockUpdate })
  mockUpdate.mockReturnValue({ eq: mockEq })
})

describe('PATCH /api/auth/profile', () => {
  it('returns 400 when the body is malformed JSON', async () => {
    const res = await PATCH(makeRequest('not json{'))

    expect(res.status).toBe(400)
  })

  it('returns 400 when the username field is missing entirely', async () => {
    const res = await PATCH(makeRequest({}))

    expect(res.status).toBe(400)
    // zod 4 emits a type error for missing string fields
    expect((await res.json()).error).toMatch(/expected string/i)
  })

  it('returns the custom "Display name is required" message when empty', async () => {
    const res = await PATCH(makeRequest({ username: '' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Display name is required' })
  })

  it('returns 400 when username is too long', async () => {
    const res = await PATCH(makeRequest({ username: 'a'.repeat(51) }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Display name is too long' })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const res = await PATCH(makeRequest({ username: 'Legolas' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 500 when the profile update fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockEq.mockResolvedValueOnce({ error: { message: 'db error' } })

    const res = await PATCH(makeRequest({ username: 'Legolas' }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update profile' })
  })

  it('returns 200 and echoes the username on success', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockEq.mockResolvedValueOnce({ error: null })

    const res = await PATCH(makeRequest({ username: '  Legolas  ' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      username: 'Legolas', // trimmed
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith({ username: 'Legolas' })
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
  })
})
