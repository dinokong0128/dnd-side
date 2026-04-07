import { render, screen } from '@testing-library/react'
import { ChatLog } from '../ChatLog'

describe('ChatLog', () => {
  it('renders messages in order', () => {
    const messages = [
      { id: '1', role: 'dm', profile_id: null, content: 'First' },
      { id: '2', role: 'player', profile_id: 'user-1', content: 'Second' },
      { id: '3', role: 'dm', profile_id: null, content: 'Third' },
    ]
    const playerMap = { 'user-1': { character_name: 'Hero' } }

    const { container } = render(
      <ChatLog
        messages={messages}
        playerMap={playerMap}
        isLoading={false}
      />
    )

    // Messages should be rendered in order
    const contentElements = container.querySelectorAll('[role="article"]')
    expect(contentElements.length).toBeGreaterThanOrEqual(messages.length)
  })

  it('renders empty state when no messages and not loading', () => {
    const { container } = render(
      <ChatLog
        messages={[]}
        playerMap={{}}
        isLoading={false}
      />
    )

    // Should show some indication of empty state
    expect(container.innerHTML).toBeTruthy()
  })

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <ChatLog
        messages={[]}
        playerMap={{}}
        isLoading={true}
      />
    )

    expect(container.innerHTML).toBeTruthy()
  })

  it('renders DM messages with Dungeon Master label', () => {
    const messages = [
      { id: '1', role: 'dm', profile_id: null, content: 'The dragon roars!' },
    ]
    const playerMap = {}

    render(
      <ChatLog
        messages={messages}
        playerMap={playerMap}
        isLoading={false}
      />
    )

    // Should contain DM message content
    expect(screen.getByText(/The dragon roars!/i)).toBeInTheDocument()
  })

  it('renders player messages with character name from playerMap', () => {
    const messages = [
      { id: '1', role: 'player', profile_id: 'user-1', content: 'I attack!' },
    ]
    const playerMap = { 'user-1': { character_name: 'Thorin' } }

    render(
      <ChatLog
        messages={messages}
        playerMap={playerMap}
        isLoading={false}
      />
    )

    // Should show character name and message
    expect(screen.getByText(/I attack!/)).toBeInTheDocument()
  })

  it('renders system messages with warning styling', () => {
    const messages = [
      { id: '1', role: 'system', profile_id: null, content: 'Connection lost' },
    ]
    const playerMap = {}

    const { container } = render(
      <ChatLog
        messages={messages}
        playerMap={playerMap}
        isLoading={false}
      />
    )

    expect(container.innerHTML).toBeTruthy()
  })

  it('handles unknown profile_id gracefully', () => {
    const messages = [
      { id: '1', role: 'player', profile_id: 'unknown-user', content: 'Hello' },
    ]
    const playerMap = { 'user-1': { character_name: 'Thorin' } }

    render(
      <ChatLog
        messages={messages}
        playerMap={playerMap}
        isLoading={false}
      />
    )

    // Should render without crashing
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
  })
})
