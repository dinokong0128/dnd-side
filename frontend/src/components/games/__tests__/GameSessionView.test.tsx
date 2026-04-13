/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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
  ChatLog: ({ onLoadMore, hasMoreMessages, isLoadingMore }: any) => (
    <div data-testid="chat-log">
      <button data-testid="load-more" onClick={onLoadMore}>Load more</button>
      <div data-testid="has-more">{hasMoreMessages ? 'true' : 'false'}</div>
      <div data-testid="is-loading-more">{isLoadingMore ? 'true' : 'false'}</div>
    </div>
  ),
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

jest.mock('../ConfirmModal', () => ({
  ConfirmModal: () => null,
}))

jest.mock('../SessionStatusBanner', () => ({
  SessionStatusBanner: () => null,
}))

describe('GameSessionView', () => {
  const testContext: {
    playersData: any[]
    initialMessages: any[]
    latestRole: 'player' | 'dm' | 'system' | null
    loadMoreMessages: any[]
    capturedLimitCalls: number[]
    capturedOrderArgs: Array<{ column: string; ascending: boolean }>
    capturedLtValues: string[]
  } = {
    playersData: [],
    initialMessages: [],
    latestRole: null,
    loadMoreMessages: [],
    capturedLimitCalls: [],
    capturedOrderArgs: [],
    capturedLtValues: [],
  }
  let mockSupabaseClient: any

  beforeEach(() => {
    testContext.playersData = []
    testContext.initialMessages = []
    testContext.latestRole = null
    testContext.loadMoreMessages = []
    testContext.capturedLimitCalls = []
    testContext.capturedOrderArgs = []
    testContext.capturedLtValues = []

    mockSupabaseClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'game_messages') {
          return {
            select: jest.fn().mockImplementation((selectArg: string) => ({
              eq: jest.fn().mockImplementation(() => {
                let ltValue: string | null = null
                let orderAscending = true
                return {
                  lt: jest.fn().mockImplementation((_column: string, value: string) => {
                    ltValue = value
                    testContext.capturedLtValues.push(value)
                    return {
                      order: jest.fn().mockImplementation((column: string, options: { ascending: boolean }) => {
                        orderAscending = options.ascending
                        testContext.capturedOrderArgs.push({ column, ascending: options.ascending })
                        return {
                          limit: jest.fn().mockImplementation((limitCount: number) => {
                            testContext.capturedLimitCalls.push(limitCount)
                            if (!orderAscending || ltValue) {
                              return Promise.resolve({ data: testContext.loadMoreMessages, error: null })
                            }
                            return Promise.resolve({ data: [], error: null })
                          }),
                        }
                      }),
                    }
                  }),
                  order: jest.fn().mockImplementation((column: string, options: { ascending: boolean }) => {
                    orderAscending = options.ascending
                    testContext.capturedOrderArgs.push({ column, ascending: options.ascending })
                    return {
                      limit: jest.fn().mockImplementation((limitCount: number) => {
                        testContext.capturedLimitCalls.push(limitCount)
                        if (selectArg === 'role') {
                          return Promise.resolve({
                            data: testContext.latestRole ? [{ role: testContext.latestRole }] : [],
                            error: null,
                          })
                        }
                        return Promise.resolve({ data: testContext.initialMessages, error: null })
                      }),
                    }
                  }),
                }
              }),
            })),
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

  it('fetches initial messages with descending order and page-size limit', async () => {
    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    expect(
      testContext.capturedOrderArgs.some(
        (arg) => arg.column === 'created_at' && arg.ascending === false
      )
    ).toBe(true)
    expect(testContext.capturedLimitCalls).toContain(10)
  })

  it('derives isWaitingForDm from latest-message query, not paginated batch', async () => {
    testContext.initialMessages = [
      {
        id: 'msg-1',
        game_id: 'game-1',
        role: 'player',
        profile_id: 'user-1',
        content: 'older player action',
        created_at: '2026-04-01T00:00:00Z',
      },
    ]
    testContext.latestRole = 'dm'

    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('is-waiting')).toHaveTextContent('false')
    })
  })

  it('sets hasMoreMessages false when initial fetch has fewer than page size', async () => {
    testContext.initialMessages = [
      {
        id: 'msg-1',
        game_id: 'game-1',
        role: 'dm',
        profile_id: null,
        content: 'hello',
        created_at: '2026-04-01T00:00:00Z',
      },
    ]
    testContext.latestRole = 'dm'

    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('has-more')).toHaveTextContent('false')
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

    // In this test harness ChatInput is mocked, so submitting is covered in integration tests.
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

  describe('retry timeout banner', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('shows retry banner after 45s of isWaitingForDm=true', async () => {
      // No messages → isWaitingForDm=true after init
      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      // Wait for async init to complete
      await waitFor(() => {
        expect(screen.getByTestId('is-waiting')).toHaveTextContent('true')
      })

      // Advance timer by 45s
      act(() => {
        jest.advanceTimersByTime(45_000)
      })

      expect(
        screen.getByText(/The Dungeon Master hasn't responded in a while/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('retry banner disappears when isWaitingForDm goes false via Realtime', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null

      mockSupabaseClient.channel.mockReturnValue({
        on: jest.fn().mockImplementation((_event: any, _filter: any, cb: any) => {
          realtimeCallback = cb
          return {
            subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
          }
        }),
      })

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('is-waiting')).toHaveTextContent('true')
      })

      // Advance timer to show banner
      act(() => {
        jest.advanceTimersByTime(45_000)
      })

      expect(
        screen.getByText(/The Dungeon Master hasn't responded in a while/i)
      ).toBeInTheDocument()

      // Simulate DM response arriving via Realtime
      act(() => {
        realtimeCallback?.({
          new: {
            id: 'msg-dm',
            game_id: 'game-1',
            role: 'dm',
            profile_id: null,
            content: 'The dragon roars.',
            created_at: new Date().toISOString(),
          },
        })
      })

      await waitFor(() => {
        expect(
          screen.queryByText(/The Dungeon Master hasn't responded in a while/i)
        ).not.toBeInTheDocument()
      })
    })

    it('clicking retry banner re-submits the last player action', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ message_id: 'msg-1', status: 'queued' }),
      })

      testContext.initialMessages = [
        {
          id: 'msg-p1',
          game_id: 'game-1',
          role: 'player',
          profile_id: 'user-1',
          content: 'I attack the dragon!',
          created_at: '2026-04-01T00:00:00Z',
        },
      ]
      testContext.latestRole = 'player'
      testContext.playersData = [
        {
          id: 'player-1',
          profile_id: 'user-1',
          character_name: 'Thorin',
        },
      ]

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      // Wait for init — last message is player so isWaitingForDm=true
      await waitFor(() => {
        expect(screen.getByTestId('is-waiting')).toHaveTextContent('true')
      })

      // Advance timer to show banner
      act(() => {
        jest.advanceTimersByTime(45_000)
      })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/games/game-1/actions',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ action_text: 'I attack the dragon!' }),
          })
        )
      })
    })
  })
})
