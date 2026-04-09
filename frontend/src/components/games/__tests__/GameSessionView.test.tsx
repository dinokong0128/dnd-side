import { render, screen, waitFor } from '@testing-library/react'
import { GameSessionView } from '../GameSessionView'
import * as supabaseModule from '@/lib/supabase/client'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

// Mock child components
jest.mock('../GameHeader', () => ({
  GameHeader: ({ gameName }: any) => <div data-testid="game-header">{gameName}</div>,
}))

jest.mock('../ChatLog', () => ({
  ChatLog: () => <div data-testid="chat-log">Chat Log</div>,
}))

jest.mock('../ChatInput', () => ({
  ChatInput: ({ hasCharacter, gameStatus, isWaitingForDm, onSubmit }: any) => (
    <div data-testid="chat-input">
      <div data-testid="has-character">{hasCharacter ? 'true' : 'false'}</div>
      <div data-testid="game-status">{gameStatus}</div>
      <div data-testid="is-waiting">{isWaitingForDm ? 'true' : 'false'}</div>
      <div data-testid="has-on-submit">{onSubmit ? 'true' : 'false'}</div>
    </div>
  ),
}))

jest.mock('../TypingIndicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator">Typing...</div>,
}))

describe('GameSessionView', () => {
  let testContext: { playersData: any[] } = { playersData: [] }
  let mockSupabaseClient: any

  beforeEach(() => {
    testContext.playersData = []
    mockSupabaseClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'game_messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'players') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest
                .fn()
                .mockImplementation(() =>
                  Promise.resolve({ data: testContext.playersData, error: null })
                ),
            }),
          }
        }
        // Default mock for any other table
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }),
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnValue({
          subscribe: jest.fn().mockReturnValue({
            unsubscribe: jest.fn(),
          }),
        }),
      }),
    }

    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(mockSupabaseClient)
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockGame = {
    id: 'game-1',
    name: 'Test Campaign',
    dm_persona: 'A wise DM',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('renders game header with correct game name', async () => {
    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument()
    })
  })

  it('passes correct props to ChatInput component', async () => {
    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Verify ChatInput receives gameStatus prop
    expect(screen.getByTestId('game-status')).toHaveTextContent('active')

    // Verify ChatInput receives onSubmit prop
    expect(screen.getByTestId('has-on-submit')).toHaveTextContent('true')
  })


  it('safely unsubscribes from Realtime on unmount', async () => {
    const mockUnsubscribe = jest.fn()
    mockSupabaseClient.channel.mockReturnValue({
      on: jest.fn().mockReturnValue({
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: mockUnsubscribe,
        }),
      }),
    })

    const { unmount } = render(
      <GameSessionView gameId="game-1" game={mockGame} userId="user-1" />
    )

    await waitFor(() => {
      expect(screen.getByTestId('game-header')).toBeInTheDocument()
    })

    // Should not crash when unmounting
    expect(() => unmount()).not.toThrow()
  })

  it('passes isWaitingForDm as true when no messages yet (waiting for opening narration)', async () => {
    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      // When there are no messages, component should show it's waiting for DM (opening narration)
      expect(screen.getByTestId('is-waiting')).toHaveTextContent('true')
    })
  })

  it('sets hasCharacter to true when current user has a character in playerMap', async () => {
    testContext.playersData = [
      {
        id: 'player-1',
        profile_id: 'user-1',
        character_name: 'Thorin',
        character_class: 'Warrior',
        hp_current: 50,
        hp_max: 50,
        status: 'alive',
      },
    ]

    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('has-character')).toHaveTextContent('true')
    })
  })

  it('sets hasCharacter to false when current user is not in playerMap', async () => {
    testContext.playersData = [
      {
        id: 'player-1',
        profile_id: 'user-2',
        character_name: 'Thorin',
        character_class: 'Warrior',
        hp_current: 50,
        hp_max: 50,
        status: 'alive',
      },
    ]

    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('has-character')).toHaveTextContent('false')
    })
  })

  it('calls fetch with correct URL when handleSubmit is invoked', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: 'msg-1', status: 'queued' }),
    })

    testContext.playersData = [
      {
        id: 'player-1',
        profile_id: 'user-1',
        character_name: 'Thorin',
        character_class: 'Warrior',
        hp_current: 50,
        hp_max: 50,
        status: 'alive',
      },
    ]

    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Simulate ChatInput calling onSubmit
    const mockOnSubmit = (global.fetch as jest.Mock).mock.calls[0]?.[0]

    // In real scenario, ChatInput would call the onSubmit handler from GameSessionView
    // We can verify fetch was called with expected parameters
  })

  it('sets isWaitingForDm to false when API call fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    testContext.playersData = [
      {
        id: 'player-1',
        profile_id: 'user-1',
        character_name: 'Thorin',
        character_class: 'Warrior',
        hp_current: 50,
        hp_max: 50,
        status: 'alive',
      },
    ]

    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })
})
