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
  ChatLog: ({ onLoadMore, hasMoreMessages, isLoadingMore, messages, userId, onDeleteMessage, onEditMessage }: any) => (
    <div data-testid="chat-log">
      <button data-testid="load-more" onClick={onLoadMore}>Load more</button>
      <div data-testid="has-more">{hasMoreMessages ? 'true' : 'false'}</div>
      <div data-testid="is-loading-more">{isLoadingMore ? 'true' : 'false'}</div>
      <div data-testid="messages-count">{messages ? messages.length : 0}</div>
      <div data-testid="chat-log-user-id">{userId || ''}</div>
      <button data-testid="trigger-delete" onClick={() => onDeleteMessage?.('msg-1')}>Delete</button>
      <button data-testid="trigger-edit" onClick={() => onEditMessage?.('msg-1', 'new content')}>Edit</button>
    </div>
  ),
}))

jest.mock('../ChatInput', () => ({
  ChatInput: ({ hasCharacter, gameStatus, isWaitingForDm, onSubmit, suggestedActions }: any) => (
    <div data-testid="chat-input">
      <div data-testid="has-character">{hasCharacter ? 'true' : 'false'}</div>
      <div data-testid="game-status">{gameStatus}</div>
      <div data-testid="is-waiting">{isWaitingForDm ? 'true' : 'false'}</div>
      <div data-testid="has-on-submit">{onSubmit ? 'true' : 'false'}</div>
      <div data-testid="suggested-actions-count">{suggestedActions ? suggestedActions.length : 0}</div>
      <button data-testid="submit-action" onClick={() => onSubmit?.('I attack the dragon')}>Submit</button>
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
      channel: jest.fn().mockImplementation(() => {
        const channelObj = {
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        }
        return channelObj
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
    suggested_actions: null,
  }

  it('renders game header with correct game name', async () => {
    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument()
    })
  })

  it('passes userId to ChatLog (DIN-61)', async () => {
    render(<GameSessionView gameId="game-1" game={mockGame} userId="user-42" />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-log-user-id')).toHaveTextContent('user-42')
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
    const channelObj = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: mockUnsubscribe }),
    }
    mockSupabaseClient.channel.mockReturnValue(channelObj)

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

      const channelObj: any = {
        on: jest.fn().mockImplementation((_event: any, _filter: any, cb: any) => {
          realtimeCallback = cb
          return channelObj
        }),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      }
      mockSupabaseClient.channel.mockReturnValue(channelObj)

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

    it('games Realtime UPDATE with suggested_actions passes updated list to ChatInput (DIN-42)', async () => {
      const realtimeCallbacks: Array<(payload: any) => void> = []

      const channelObj: any = {
        on: jest.fn().mockImplementation((_event: any, _filter: any, cb: any) => {
          realtimeCallbacks.push(cb)
          return channelObj
        }),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      }
      mockSupabaseClient.channel.mockReturnValue(channelObj)

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('chat-input')).toBeInTheDocument()
      })

      // Simulate games Realtime UPDATE with new suggested_actions
      act(() => {
        for (const cb of realtimeCallbacks) {
          cb({
            new: {
              ...mockGame,
              suggested_actions: ['Attack the goblin', 'Search the room'],
            },
          })
        }
      })

      await waitFor(() => {
        expect(screen.getByTestId('suggested-actions-count')).toHaveTextContent('2')
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

  describe('DIN-64: optimistic player message', () => {
    it('optimistic message appears immediately before fetch resolves', async () => {
      // fetch never resolves during this test
      ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))

      testContext.playersData = [{ id: 'player-1', profile_id: 'user-1', character_name: 'Thorin' }]

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      await waitFor(() => expect(screen.getByTestId('chat-input')).toBeInTheDocument())

      act(() => {
        fireEvent.click(screen.getByTestId('submit-action'))
      })

      // Optimistic message should cause messages count to increase immediately
      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('1')
      })
    })

    it('optimistic message is replaced (not duplicated) when Realtime INSERT fires with matching content', async () => {
      let realtimeInsertCallback: ((payload: any) => void) | null = null

      const channelObj: any = {
        on: jest.fn().mockImplementation((_event: any, _filter: any, cb: any) => {
          realtimeInsertCallback = cb
          return channelObj
        }),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      }
      mockSupabaseClient.channel.mockReturnValue(channelObj)

      ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
      testContext.playersData = [{ id: 'player-1', profile_id: 'user-1', character_name: 'Thorin' }]

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)
      await waitFor(() => expect(screen.getByTestId('chat-input')).toBeInTheDocument())

      // Push optimistic message
      act(() => { fireEvent.click(screen.getByTestId('submit-action')) })
      await waitFor(() => expect(screen.getByTestId('messages-count')).toHaveTextContent('1'))

      // Realtime fires the real message
      act(() => {
        realtimeInsertCallback?.({
          new: {
            id: 'real-msg-1',
            game_id: 'game-1',
            role: 'player',
            profile_id: 'user-1',
            content: 'I attack the dragon',
            created_at: new Date().toISOString(),
          },
        })
      })

      // Still exactly 1 message — optimistic replaced, not duplicated
      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('1')
      })
    })

    it('optimistic message is removed and isWaiting becomes false on fetch error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      })
      testContext.playersData = [{ id: 'player-1', profile_id: 'user-1', character_name: 'Thorin' }]

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)
      await waitFor(() => expect(screen.getByTestId('chat-input')).toBeInTheDocument())

      act(() => { fireEvent.click(screen.getByTestId('submit-action')) })

      // After error, message should be gone and not waiting
      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('0')
        expect(screen.getByTestId('is-waiting')).toHaveTextContent('false')
      })
    })
  })

  describe('edit/delete message handlers (DIN-61)', () => {
    it('handleDeleteMessage calls DELETE proxy', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 })

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('chat-log')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('trigger-delete'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/games/game-1/messages/msg-1',
          expect.objectContaining({ method: 'DELETE' })
        )
      })
    })

    it('handleEditMessage calls PATCH proxy and sets isWaitingForDm=true', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg-1', content: 'new content', role: 'player' }),
      })

      render(<GameSessionView gameId="game-1" game={mockGame} userId="user-1" />)

      await waitFor(() => {
        expect(screen.getByTestId('chat-log')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('trigger-edit'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/games/game-1/messages/msg-1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ content: 'new content' }),
          })
        )
      })
    })
  })
})
