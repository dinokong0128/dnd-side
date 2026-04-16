import { render, screen, fireEvent, act } from '@testing-library/react'
import { ChatMessage } from '../ChatMessage'
import type { DiceRollEvent } from '@/lib/types/message'

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

describe('DIN-24: dice_rolls rendering in DM messages', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  const stealth: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 14,
    modifier: 3,
    total: 17,
    label: 'Stealth Check',
    dc: 15,
    success: true,
  }

  it('renders DiceRoller components when dice_rolls present', () => {
    render(
      <ChatMessage
        role="dm"
        content="You slip into the shadows undetected."
        diceRolls={[stealth]}
      />
    )
    expect(screen.getByText('Stealth Check')).toBeInTheDocument()
  })

  it('hides narration text until all dice have settled', () => {
    render(
      <ChatMessage
        role="dm"
        content="You slip into the shadows undetected."
        diceRolls={[stealth]}
      />
    )
    // Narration should be hidden initially
    expect(screen.queryByText('You slip into the shadows undetected.')).not.toBeVisible()
    // After timers (animation complete) narration appears
    act(() => { jest.runAllTimers() })
    expect(screen.getByText('You slip into the shadows undetected.')).toBeVisible()
  })

  it('renders narration immediately when no dice_rolls', () => {
    render(
      <ChatMessage
        role="dm"
        content="The dragon stirs."
      />
    )
    expect(screen.getByText('The dragon stirs.')).toBeVisible()
  })
})

describe('DIN-25: ability check outcome badge and advantage display', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  const successRoll: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 14,
    modifier: 3,
    total: 17,
    label: 'Stealth Check',
    dc: 15,
    success: true,
  }

  const failureRoll: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 6,
    modifier: 1,
    total: 7,
    label: 'Athletics Check',
    dc: 12,
    success: false,
  }

  const nat20Roll: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 20,
    modifier: 2,
    total: 22,
    label: 'Perception Check',
    dc: 15,
    success: true,
  }

  const nat1Roll: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 1,
    modifier: 2,
    total: 3,
    label: 'Acrobatics Check',
    dc: 12,
    success: false,
  }

  const advantageRoll: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 18,
    modifier: 3,
    total: 21,
    label: 'Perception Check',
    dc: 15,
    success: true,
    advantage: true,
    all_rolls: [11, 18],
  }

  const disadvantageRoll: DiceRollEvent = {
    type: 'dice_roll',
    die: 'd20',
    count: 1,
    result: 5,
    modifier: 1,
    total: 6,
    label: 'Stealth Check',
    dc: 12,
    success: false,
    advantage: false,
    all_rolls: [5, 14],
  }

  it('success badge renders after animation with dc label', () => {
    render(
      <ChatMessage
        role="dm"
        content="You slip past unnoticed."
        diceRolls={[successRoll]}
      />
    )
    // Badge not visible before animation
    expect(screen.queryByTestId('outcome-badge')).not.toBeInTheDocument()

    act(() => { jest.runAllTimers() })

    const badge = screen.getByTestId('outcome-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Success')
    expect(badge).toHaveTextContent('DC 15')
  })

  it('failure badge renders after animation with dc label', () => {
    render(
      <ChatMessage
        role="dm"
        content="You stumble and fall."
        diceRolls={[failureRoll]}
      />
    )
    act(() => { jest.runAllTimers() })

    const badge = screen.getByTestId('outcome-badge')
    expect(badge).toHaveTextContent('Failure')
    expect(badge).toHaveTextContent('DC 12')
  })

  it('natural 20 shows critical success label', () => {
    render(
      <ChatMessage
        role="dm"
        content="You notice every detail."
        diceRolls={[nat20Roll]}
      />
    )
    act(() => { jest.runAllTimers() })

    const badge = screen.getByTestId('outcome-badge')
    expect(badge).toHaveTextContent('Critical Success')
  })

  it('natural 1 shows critical failure label', () => {
    render(
      <ChatMessage
        role="dm"
        content="You completely botch it."
        diceRolls={[nat1Roll]}
      />
    )
    act(() => { jest.runAllTimers() })

    const badge = screen.getByTestId('outcome-badge')
    expect(badge).toHaveTextContent('Critical Failure')
  })

  it('no outcome badge for non-d20 rolls without dc', () => {
    const damageRoll: DiceRollEvent = {
      type: 'dice_roll',
      die: 'd6',
      count: 1,
      result: 4,
      modifier: 2,
      total: 6,
      label: 'Damage',
    }
    render(
      <ChatMessage
        role="dm"
        content="The blade strikes."
        diceRolls={[damageRoll]}
      />
    )
    act(() => { jest.runAllTimers() })

    expect(screen.queryByTestId('outcome-badge')).not.toBeInTheDocument()
  })

  it('advantage: both all_rolls shown; kept die not struck through, discarded die struck through', () => {
    render(
      <ChatMessage
        role="dm"
        content="You spot the hidden door."
        diceRolls={[advantageRoll]}
      />
    )
    act(() => { jest.runAllTimers() })

    const kept = screen.getByTestId('adv-kept')
    const discarded = screen.getByTestId('adv-discarded')

    // kept die is the result (18 for advantage)
    expect(kept).toHaveTextContent('18')
    expect(kept).not.toHaveStyle({ textDecoration: 'line-through' })

    // discarded die is the other roll (11)
    expect(discarded).toHaveTextContent('11')
    expect(discarded).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('disadvantage: kept die is the lower roll; higher roll is struck through', () => {
    render(
      <ChatMessage
        role="dm"
        content="You fail to stay silent."
        diceRolls={[disadvantageRoll]}
      />
    )
    act(() => { jest.runAllTimers() })

    const kept = screen.getByTestId('adv-kept')
    const discarded = screen.getByTestId('adv-discarded')

    // kept die is the result (5 for disadvantage)
    expect(kept).toHaveTextContent('5')
    expect(discarded).toHaveTextContent('14')
    expect(discarded).toHaveStyle({ textDecoration: 'line-through' })
  })
})
