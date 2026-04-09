/** @jest-environment node */

import { POST } from '../route'
import { NextRequest } from 'next/server'

const mockRpc = jest.fn()
const mockSignUp = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      signUp: mockSignUp,
    },
    rpc: mockRpc,
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/auth/signup'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validBody = {
  email: 'new@example.com',
  password: 'a-secret-password',
  invite_code: 'CODE123',
  game_id: 'game-1',
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
})

describe('POST /api/auth/signup', () => {
  it('returns 400 when the body is invalid', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty('error')
  })

  it('returns 400 when the password is too short', async () => {
    const res = await POST(makeRequest({ ...validBody, password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when the invite RPC errors', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failure' },
    })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to validate invite' })
  })

  it('returns 403 when the invite code does not map to the claimed game_id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'other-game', error: null })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'Invalid or expired invite code',
    })
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('returns 403 when the invite code resolves to null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(403)
  })

  it('returns 400 when Supabase signUp fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'game-1', error: null })
    mockSignUp.mockResolvedValueOnce({
      error: { message: 'Email already registered' },
    })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Email already registered' })
  })

  it('succeeds with 201 and marks the invite used on success', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 'game-1', error: null }) // validate_invite_code
      .mockResolvedValueOnce({ data: null, error: null }) // mark_invite_used
    mockSignUp.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ success: true })

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'validate_invite_code', {
      invite_code: 'CODE123',
    })
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'a-secret-password',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback?next=/games/game-1',
      },
    })
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'mark_invite_used', {
      p_invite_code: 'CODE123',
    })
  })

  it('returns 500 on an unexpected exception', async () => {
    mockRpc.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
