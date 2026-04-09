/** @jest-environment node */

import { POST } from '../route'
import { NextRequest } from 'next/server'

const mockSignOut = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
})

describe('POST /api/auth/logout', () => {
  it('calls signOut and redirects to the site root with status 307', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const request = new NextRequest(
      new URL('http://localhost:3000/api/auth/logout'),
      { method: 'POST' }
    )
    const res = await POST(request)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    // NextResponse.redirect() without an explicit status returns 307.
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('resolves the redirect URL relative to request.nextUrl.origin', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const request = new NextRequest(
      new URL('https://dnd-side.vercel.app/api/auth/logout'),
      { method: 'POST' }
    )
    const res = await POST(request)

    expect(res.headers.get('location')).toBe('https://dnd-side.vercel.app/')
  })
})
