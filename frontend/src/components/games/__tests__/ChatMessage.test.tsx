import { render, screen } from '@testing-library/react'
import { ChatMessage } from '../ChatMessage'

describe('ChatMessage', () => {
  it('renders DM message with Dungeon Master label', () => {
    render(<ChatMessage role="dm" content="The story unfolds..." />)

    expect(screen.getByText('Dungeon Master')).toBeInTheDocument()
    expect(screen.getByText(/The story unfolds/)).toBeInTheDocument()
  })

  it('renders player message with character name', () => {
    render(
      <ChatMessage role="player" characterName="Elara" content="I cast a spell!" />
    )

    expect(screen.getByText('Elara')).toBeInTheDocument()
    expect(screen.getByText(/I cast a spell/)).toBeInTheDocument()
  })

  it('renders system message without role label', () => {
    render(<ChatMessage role="system" content="Connection restored" />)

    expect(screen.getByText(/Connection restored/)).toBeInTheDocument()
    expect(screen.queryByText('Dungeon Master')).not.toBeInTheDocument()
  })

  it('renders message content as text', () => {
    render(
      <ChatMessage
        role="dm"
        content="A long narration about the world..."
      />
    )

    expect(screen.getByText(/A long narration/)).toBeInTheDocument()
  })

  it('falls back to "Unknown Character" when player role has no characterName', () => {
    render(<ChatMessage role="player" content="Hello" />)

    expect(screen.getByText('Unknown Character')).toBeInTheDocument()
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
  })

  it('falls back to "Unknown Character" when player role has empty characterName', () => {
    render(<ChatMessage role="player" characterName="" content="Hello" />)

    expect(screen.getByText('Unknown Character')).toBeInTheDocument()
  })
})
