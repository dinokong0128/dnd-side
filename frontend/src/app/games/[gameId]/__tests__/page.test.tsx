import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { getPlayer, getPlayerInventory } from '@/lib/supabase/players'
import GamePage from '../page'
import { makeGame, makePlayer } from '@/lib/__test-utils__/fixtures'

jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/games', () => ({
  fetchGameById: jest.fn(),
}))

jest.mock('@/lib/supabase/players', () => ({
  getPlayer: jest.fn(),
  getPlayerInventory: jest.fn(),
}))

// Shallow-mock each child component so we can assert on what the page
// chooses to render without exercising their internals.
jest.mock('@/components/games/GameSessionView', () => ({
  GameSessionView: ({ gameId }: { gameId: string }) => (
    <div data-testid="game-session-view">{gameId}</div>
  ),
}))
jest.mock('@/components/games/CharacterLobbyPanel', () => ({
  CharacterLobbyPanel: () => <div data-testid="lobby-panel" />,
}))
jest.mock('@/components/games/InviteSection', () => ({
  InviteSection: () => <div data-testid="invite-section" />,
}))
jest.mock('@/components/games/InventoryPanel', () => ({
  InventoryPanel: () => <div data-testid="inventory-panel" />,
}))
jest.mock('@/components/games/StartSessionButton', () => ({
  StartSessionButton: () => <div data-testid="start-session-button" />,
}))
jest.mock('@/components/layout/DashboardHeader', () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockFetchGameById = fetchGameById as jest.MockedFunction<typeof fetchGameById>
const mockGetPlayer = getPlayer as jest.MockedFunction<typeof getPlayer>
const mockGetPlayerInventory = getPlayerInventory as jest.MockedFunction<
  typeof getPlayerInventory
>
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>

function mockAuth(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

function params(gameId = 'game-1') {
  return { params: Promise.resolve({ gameId }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetPlayerInventory.mockResolvedValue([])
})

describe('GamePage', () => {
  describe('authentication', () => {
    it('redirects to /auth/login when the user is not authenticated', async () => {
      mockAuth(null)

      await expect(GamePage(params())).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
    })
  })

  describe('missing game', () => {
    it('renders the "Game not found" state', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(null)
      mockGetPlayer.mockResolvedValue(null)

      const jsx = await GamePage(params('ghost'))
      render(jsx)

      expect(screen.getByText(/Game not found/i)).toBeInTheDocument()
    })
  })

  describe('active game (non-lobby)', () => {
    it('renders GameSessionView when game.status is active', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(makeGame({ status: 'active' }))
      mockGetPlayer.mockResolvedValue(makePlayer())

      const jsx = await GamePage(params('game-1'))
      render(jsx)

      expect(screen.getByTestId('game-session-view')).toHaveTextContent(
        'game-1'
      )
    })

    it('renders GameSessionView when game.status is paused', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(makeGame({ status: 'paused' }))
      mockGetPlayer.mockResolvedValue(makePlayer())

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.getByTestId('game-session-view')).toBeInTheDocument()
    })

    it('renders GameSessionView when game.status is ended', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(makeGame({ status: 'ended' }))
      mockGetPlayer.mockResolvedValue(makePlayer())

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.getByTestId('game-session-view')).toBeInTheDocument()
    })
  })

  describe('lobby game', () => {
    it('always renders the CharacterLobbyPanel in lobby mode', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(
        makeGame({ status: 'lobby', created_by: 'someone-else' })
      )
      mockGetPlayer.mockResolvedValue(null)

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.getByTestId('lobby-panel')).toBeInTheDocument()
    })

    it('shows the InviteSection only to the host', async () => {
      mockAuth({ id: 'user-host' })
      mockFetchGameById.mockResolvedValue(
        makeGame({ status: 'lobby', created_by: 'user-host' })
      )
      mockGetPlayer.mockResolvedValue(null)

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.getByTestId('invite-section')).toBeInTheDocument()
      expect(screen.getByTestId('start-session-button')).toBeInTheDocument()
    })

    it('hides the InviteSection and StartSessionButton for non-hosts', async () => {
      mockAuth({ id: 'user-guest' })
      mockFetchGameById.mockResolvedValue(
        makeGame({ status: 'lobby', created_by: 'user-host' })
      )
      mockGetPlayer.mockResolvedValue(null)

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.queryByTestId('invite-section')).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('start-session-button')
      ).not.toBeInTheDocument()
    })

    it('renders InventoryPanel when the player has a character_name', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(
        makeGame({ status: 'lobby', created_by: 'user-1' })
      )
      mockGetPlayer.mockResolvedValue(makePlayer({ character_name: 'Aragorn' }))

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.getByTestId('inventory-panel')).toBeInTheDocument()
    })

    it('hides InventoryPanel when the player has no character_name yet', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(
        makeGame({ status: 'lobby', created_by: 'user-1' })
      )
      mockGetPlayer.mockResolvedValue(makePlayer({ character_name: '' }))

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.queryByTestId('inventory-panel')).not.toBeInTheDocument()
    })

    it('displays the game name and status label', async () => {
      mockAuth({ id: 'user-1' })
      mockFetchGameById.mockResolvedValue(
        makeGame({
          name: 'Shadows of Mordor',
          status: 'lobby',
          created_by: 'user-1',
        })
      )
      mockGetPlayer.mockResolvedValue(null)

      const jsx = await GamePage(params())
      render(jsx)

      expect(screen.getByText('Shadows of Mordor')).toBeInTheDocument()
      expect(screen.getByText(/lobby/i)).toBeInTheDocument()
    })
  })
})
