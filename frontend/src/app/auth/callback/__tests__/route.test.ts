/** @jest-environment node */

import { GET } from '../route'
import { NextRequest } from 'next/server'

const mockExchangeCodeForSession = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

function makeRequest(search: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/auth/callback${search}`)
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
})

describe('GET /auth/callback', () => {
  describe('when no code is provided', () => {
    it('redirects to /auth/login?error=auth_callback_failed', async () => {
      const res = await GET(makeRequest(''))

      expect([307, 308]).toContain(res.status)
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/auth/login?error=auth_callback_failed'
      )
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    })
  })

  describe('when a valid code is provided', () => {
    it('exchanges the code and redirects to /dashboard by default', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })

      const res = await GET(makeRequest('?code=abc123'))

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123')
      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('redirects to a safe `next` path when supplied', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })

      const res = await GET(makeRequest('?code=abc&next=/games/game-1'))

      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/games/game-1'
      )
    })
  })

  describe('open-redirect protection', () => {
    it('falls back to /dashboard when next starts with //', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })

      const res = await GET(makeRequest('?code=abc&next=//evil.com/pwn'))

      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('falls back to /dashboard when next is an absolute URL', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })

      const res = await GET(
        makeRequest('?code=abc&next=https://evil.com/pwn')
      )

      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('falls back to /dashboard when next is a path without a leading slash', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })

      const res = await GET(makeRequest('?code=abc&next=games/game-1'))

      expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })
  })

  describe('when exchangeCodeForSession fails', () => {
    it('redirects to /auth/login?error=auth_callback_failed', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: { message: 'invalid grant' },
      })

      const res = await GET(makeRequest('?code=badcode'))

      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/auth/login?error=auth_callback_failed'
      )
    })
  })
})
