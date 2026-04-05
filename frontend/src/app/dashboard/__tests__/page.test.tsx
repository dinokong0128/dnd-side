import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchGamesByUserId } from '@/lib/supabase/games'
import type { Game } from '@/lib/supabase/games'
import DashboardPage from '../page'

jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/games', () => ({
  fetchGamesByUserId: jest.fn(),
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockFetchGamesByUserId = fetchGamesByUserId as jest.MockedFunction<
  typeof fetchGamesByUserId
>
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>

function mockSupabaseWithUser(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

const sampleGame: Game = {
  id: 'game-1',
  name: 'Dragon Quest',
  dm_persona: 'A dark fantasy realm',
  status: 'lobby',
  created_by: 'user-123',
  created_at: '2026-03-22T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('DashboardPage', () => {
  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockSupabaseWithUser(null)
    })

    it('redirects to /auth/login', async () => {
      await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
    })

    it('does not call fetchGamesByUserId', async () => {
      await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockFetchGamesByUserId).not.toHaveBeenCalled()
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockSupabaseWithUser({ id: 'user-123' })
    })

    it('does not redirect', async () => {
      mockFetchGamesByUserId.mockResolvedValue([])
      await DashboardPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('shows empty state when there are no games', async () => {
      mockFetchGamesByUserId.mockResolvedValue([])
      const jsx = await DashboardPage()
      render(jsx)
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })

    it('renders game names when games exist', async () => {
      mockFetchGamesByUserId.mockResolvedValue([sampleGame])
      const jsx = await DashboardPage()
      render(jsx)
      expect(screen.getByText('Dragon Quest')).toBeInTheDocument()
    })

    it('calls fetchGamesByUserId with the authenticated user id', async () => {
      mockFetchGamesByUserId.mockResolvedValue([])
      await DashboardPage()
      expect(mockFetchGamesByUserId).toHaveBeenCalledWith('user-123')
    })
  })
})
