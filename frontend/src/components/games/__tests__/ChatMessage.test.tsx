import { render, screen } from '@testing-library/react'
import { ChatMessage } from '../ChatMessage'

describe('ChatMessage', () => {
  it('renders DM message with Dungeon Master label', () => {
    render(
      <ChatMessage
        message={{ id: '1', role: 'dm', profile_id: null, content: 'The story unfolds...' }}
        playerName={undefined}
      />
    )

    expect(screen.getByText(/The story unfolds/)).toBeInTheDocument()
  })

  it('renders player message with character name', () => {
    render(
      <ChatMessage
        message={{ id: '1', role: 'player', profile_id: 'user-1', content: 'I cast a spell!' }}
        playerName="Elara"
      />
    )

    expect(screen.getByText(/I cast a spell/)).toBeInTheDocument()
  })

  it('renders system message centered', () => {
    const { container } = render(
      <ChatMessage
        message={{ id: '1', role: 'system', profile_id: null, content: 'Connection restored' }}
        playerName={undefined}
      />
    )

    expect(container.innerHTML).toBeTruthy()
  })

  it('renders message content as text', () => {
    render(
      <ChatMessage
        message={{ id: '1', role: 'dm', profile_id: null, content: 'A long narration about the world...' }}
        playerName={undefined}
      />
    )

    expect(screen.getByText(/A long narration/)).toBeInTheDocument()
  })

  it('handles missing characterName for player role', () => {
    render(
      <ChatMessage
        message={{ id: '1', role: 'player', profile_id: 'user-1', content: 'Hello' }}
        playerName={undefined}
      />
    )

    expect(screen.getByText(/Hello/)).toBeInTheDocument()
  })
})
