import { render, screen } from '@testing-library/react'
import { ChatLog } from '../ChatLog'
import type { GameMessage } from '@/lib/types/message'

// jsdom does not implement scrollIntoView; stub it for ChatLog auto-scroll.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn()
})

function makeMessage(overrides: Partial<GameMessage> = {}): GameMessage {
  return {
    id: '1',
    game_id: 'game-1',
    role: 'dm',
    profile_id: null,
    content: 'Sample content',
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

describe('ChatLog', () => {
  it('renders messages in order', () => {
    const messages: GameMessage[] = [
      makeMessage({ id: '1', role: 'dm', content: 'First' }),
      makeMessage({ id: '2', role: 'player', profile_id: 'user-1', content: 'Second' }),
      makeMessage({ id: '3', role: 'dm', content: 'Third' }),
    ]
    const playerMap = new Map<string, string>([['user-1', 'Hero']])

    render(<ChatLog messages={messages} playerMap={playerMap} isLoading={false} />)

    expect(screen.getByText(/First/)).toBeInTheDocument()
    expect(screen.getByText(/Second/)).toBeInTheDocument()
    expect(screen.getByText(/Third/)).toBeInTheDocument()
  })

  it('renders empty state when no messages and not loading', () => {
    render(
      <ChatLog messages={[]} playerMap={new Map()} isLoading={false} />
    )

    expect(
      screen.getByText(/Awaiting the Dungeon Master/i)
    ).toBeInTheDocument()
  })

  it('renders loading state when isLoading is true', () => {
    render(<ChatLog messages={[]} playerMap={new Map()} isLoading={true} />)

    expect(screen.getByText(/Loading the tale/i)).toBeInTheDocument()
  })

  it('renders DM messages with Dungeon Master label', () => {
    const messages: GameMessage[] = [
      makeMessage({ role: 'dm', content: 'The dragon roars!' }),
    ]

    render(
      <ChatLog messages={messages} playerMap={new Map()} isLoading={false} />
    )

    expect(screen.getByText('Dungeon Master')).toBeInTheDocument()
    expect(screen.getByText(/The dragon roars!/i)).toBeInTheDocument()
  })

  it('renders player messages with character name from playerMap', () => {
    const messages: GameMessage[] = [
      makeMessage({ role: 'player', profile_id: 'user-1', content: 'I attack!' }),
    ]
    const playerMap = new Map<string, string>([['user-1', 'Thorin']])

    render(<ChatLog messages={messages} playerMap={playerMap} isLoading={false} />)

    expect(screen.getByText('Thorin')).toBeInTheDocument()
    expect(screen.getByText(/I attack!/)).toBeInTheDocument()
  })

  it('renders system messages', () => {
    const messages: GameMessage[] = [
      makeMessage({ role: 'system', content: 'Connection lost' }),
    ]

    render(
      <ChatLog messages={messages} playerMap={new Map()} isLoading={false} />
    )

    expect(screen.getByText(/Connection lost/)).toBeInTheDocument()
  })

  it('falls back to "Unknown Character" when profile_id is not in playerMap', () => {
    const messages: GameMessage[] = [
      makeMessage({ role: 'player', profile_id: 'unknown-user', content: 'Hello' }),
    ]
    const playerMap = new Map<string, string>([['user-1', 'Thorin']])

    render(<ChatLog messages={messages} playerMap={playerMap} isLoading={false} />)

    expect(screen.getByText('Unknown Character')).toBeInTheDocument()
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
  })
})
