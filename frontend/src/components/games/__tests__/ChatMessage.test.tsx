import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders retry button on system message when onRetry is provided', () => {
    const onRetry = jest.fn()
    render(<ChatMessage role="system" content="An error occurred." onRetry={onRetry} />)

    expect(screen.getByRole('button', { name: /retry last action/i })).toBeInTheDocument()
  })

  it('does not render retry button on system message when onRetry is not provided', () => {
    render(<ChatMessage role="system" content="An error occurred." />)

    expect(screen.queryByRole('button', { name: /retry last action/i })).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn()
    render(<ChatMessage role="system" content="An error occurred." onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: /retry last action/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
