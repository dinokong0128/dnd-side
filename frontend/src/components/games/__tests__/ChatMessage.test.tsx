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

describe('✏ edit/delete controls (DIN-61)', () => {
  it('shows edit and delete buttons when hovering the last owned player message', () => {
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={true}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)

    expect(screen.getByTestId('edit-message-btn')).toBeInTheDocument()
    expect(screen.getByTestId('delete-message-btn')).toBeInTheDocument()
  })

  it('does not show controls on DM messages', () => {
    render(
      <ChatMessage
        role="dm"
        content="The dragon roars."
        profileId={null}
        userId="user-1"
        isLastMessage={true}
      />
    )

    expect(screen.queryByTestId('edit-message-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-message-btn')).not.toBeInTheDocument()
  })

  it('does not show controls when isLastMessage is false', () => {
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={false}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)

    expect(screen.queryByTestId('edit-message-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-message-btn')).not.toBeInTheDocument()
  })

  it('does not show controls when userId does not match profileId', () => {
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="other-user"
        userId="user-1"
        isLastMessage={true}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)

    expect(screen.queryByTestId('edit-message-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-message-btn')).not.toBeInTheDocument()
  })

  it('clicking edit button switches to edit mode', () => {
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={true}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)
    fireEvent.click(screen.getByTestId('edit-message-btn'))

    expect(screen.getByTestId('edit-textarea')).toBeInTheDocument()
    expect((screen.getByTestId('edit-textarea') as HTMLTextAreaElement).value).toBe('I attack!')
    expect(screen.getByTestId('save-edit-btn')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-edit-btn')).toBeInTheDocument()
  })

  it('cancel reverts to view mode with original content', () => {
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={true}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)
    fireEvent.click(screen.getByTestId('edit-message-btn'))
    fireEvent.change(screen.getByTestId('edit-textarea'), { target: { value: 'Different text' } })
    fireEvent.click(screen.getByTestId('cancel-edit-btn'))

    expect(screen.queryByTestId('edit-textarea')).not.toBeInTheDocument()
    expect(screen.getByText('I attack!')).toBeInTheDocument()
  })

  it('save calls onEdit with trimmed content', () => {
    const onEdit = jest.fn()
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={true}
        onEdit={onEdit}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)
    fireEvent.click(screen.getByTestId('edit-message-btn'))
    fireEvent.change(screen.getByTestId('edit-textarea'), { target: { value: '  I search for traps.  ' } })
    fireEvent.click(screen.getByTestId('save-edit-btn'))

    expect(onEdit).toHaveBeenCalledWith('I search for traps.')
    expect(screen.queryByTestId('edit-textarea')).not.toBeInTheDocument()
  })

  it('save button is disabled when edit text is empty or whitespace', () => {
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={true}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)
    fireEvent.click(screen.getByTestId('edit-message-btn'))
    fireEvent.change(screen.getByTestId('edit-textarea'), { target: { value: '   ' } })

    expect(screen.getByTestId('save-edit-btn')).toBeDisabled()
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = jest.fn()
    render(
      <ChatMessage
        role="player"
        content="I attack!"
        profileId="user-1"
        userId="user-1"
        isLastMessage={true}
        onDelete={onDelete}
      />
    )

    fireEvent.mouseEnter(screen.getByText('I attack!').closest('div')!)
    fireEvent.click(screen.getByTestId('delete-message-btn'))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
