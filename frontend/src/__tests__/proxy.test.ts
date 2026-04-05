/**
 * @jest-environment node
 *
 * next/server uses Web Fetch API globals (Request, Response) which are not
 * available in jsdom. The node environment has them in Node.js 18+.
 */

import { proxy } from '../proxy'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`))
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('middleware', () => {
  describe('unauthenticated user on protected routes', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
    })

    it.each(['/dashboard', '/dashboard/new', '/games/abc-123'])(
      'redirects %s to /auth/login',
      async (pathname) => {
        const response = await proxy(makeRequest(pathname))
        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toContain('/auth/login')
      }
    )
  })

  describe('unauthenticated user on public routes', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
    })

    it.each(['/auth/login', '/auth/signup', '/auth/callback', '/'])(
      'allows access to %s without redirecting',
      async (pathname) => {
        const response = await proxy(makeRequest(pathname))
        expect(response.status).not.toBe(307)
      }
    )
  })

  describe('authenticated user on protected routes', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    })

    it.each(['/dashboard', '/dashboard/new', '/games/abc-123'])(
      'allows access to %s without redirecting',
      async (pathname) => {
        const response = await proxy(makeRequest(pathname))
        expect(response.status).not.toBe(307)
      }
    )
  })

  it('calls getUser on every request to validate and refresh the session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await proxy(makeRequest('/'))

    expect(mockGetUser).toHaveBeenCalledTimes(1)
  })
})
