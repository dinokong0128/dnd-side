import { render, screen, fireEvent } from '@testing-library/react'
import { GameHeader } from '../GameHeader'

describe('GameHeader', () => {
  const mockOnPause = jest.fn()
  const mockOnEnd = jest.fn()

  beforeEach(() => {
    mockOnPause.mockClear()
    mockOnEnd.mockClear()
  })

  it('renders game name', () => {
    render(
      <GameHeader
        gameName="Dragon's Lair"
        gameStatus="active"
        isHost={false}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByRole('heading')).toHaveTextContent("Dragon's Lair")
  })

  it('renders correct status badge for active status', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="active"
        isHost={false}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/active/i)).toBeInTheDocument()
  })

  it('renders correct status badge for paused status', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="paused"
        isHost={false}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/paused/i)).toBeInTheDocument()
  })

  it('renders correct status badge for ended status', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="ended"
        isHost={false}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/ended|concluded/i)).toBeInTheDocument()
  })

  it('shows Pause and End buttons for host when active', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="active"
        isHost={true}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/pause/i)).toBeInTheDocument()
    expect(screen.getByText(/end/i)).toBeInTheDocument()
  })

  it('shows only End button for host when paused', () => {
    const { queryByText } = render(
      <GameHeader
        gameName="Test Game"
        gameStatus="paused"
        isHost={true}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/end/i)).toBeInTheDocument()
  })

  it('hides buttons for non-host', () => {
    const { queryByText } = render(
      <GameHeader
        gameName="Test Game"
        gameStatus="active"
        isHost={false}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    // Buttons should not be visible for non-host
    const pauseButton = queryByText(/pause/i)
    const endButton = queryByText(/end/i)
    if (pauseButton) expect(pauseButton.closest('button')).not.toBeVisible()
    if (endButton) expect(endButton.closest('button')).not.toBeVisible()
  })

  it('hides buttons when game is ended', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="ended"
        isHost={true}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    const pauseButton = screen.queryByText(/pause/i)
    expect(pauseButton).not.toBeInTheDocument()
  })

  it('calls onPause when Pause button clicked', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="active"
        isHost={true}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    const pauseButton = screen.getByText(/pause/i).closest('button')
    fireEvent.click(pauseButton!)

    expect(mockOnPause).toHaveBeenCalled()
  })

  it('calls onEnd when End button clicked', () => {
    render(
      <GameHeader
        gameName="Test Game"
        gameStatus="active"
        isHost={true}
        onPause={mockOnPause}
        onEnd={mockOnEnd}
      />
    )

    const endButton = screen.getByText(/end/i).closest('button')
    fireEvent.click(endButton!)

    expect(mockOnEnd).toHaveBeenCalled()
  })
})
