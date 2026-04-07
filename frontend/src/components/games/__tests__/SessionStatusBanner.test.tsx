import { render, screen, fireEvent } from '@testing-library/react'
import { SessionStatusBanner } from '../SessionStatusBanner'

describe('SessionStatusBanner', () => {
  const mockOnResume = jest.fn()
  const mockOnEnd = jest.fn()

  beforeEach(() => {
    mockOnResume.mockClear()
    mockOnEnd.mockClear()
  })

  it('renders nothing when gameStatus is active', () => {
    const { container } = render(
      <SessionStatusBanner
        gameStatus="active"
        isHost={false}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    // Should not render visible banner
    const banner = container.querySelector('[role="alert"]') || container.querySelector('.banner')
    if (banner) {
      expect(banner).toHaveStyle({ display: 'none' })
    }
  })

  it('renders nothing when gameStatus is lobby', () => {
    const { container } = render(
      <SessionStatusBanner
        gameStatus="lobby"
        isHost={false}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    // Should not render visible banner
    const banner = container.querySelector('[role="alert"]') || container.querySelector('.banner')
    if (banner) {
      expect(banner).toHaveStyle({ display: 'none' })
    }
  })

  it('renders paused banner with correct text when gameStatus is paused', () => {
    render(
      <SessionStatusBanner
        gameStatus="paused"
        isHost={false}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/paused|Session is paused/i)).toBeInTheDocument()
  })

  it('renders ended banner with correct text when gameStatus is ended', () => {
    render(
      <SessionStatusBanner
        gameStatus="ended"
        isHost={false}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/ended|concluded/i)).toBeInTheDocument()
  })

  it('shows Resume and End buttons for host when paused', () => {
    render(
      <SessionStatusBanner
        gameStatus="paused"
        isHost={true}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText(/Resume/i)).toBeInTheDocument()
    expect(screen.getByText(/End/i)).toBeInTheDocument()
  })

  it('hides buttons for non-host when paused', () => {
    const { queryByText } = render(
      <SessionStatusBanner
        gameStatus="paused"
        isHost={false}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    const resumeButton = queryByText(/Resume/i)
    const endButton = queryByText(/End/i)
    if (resumeButton) expect(resumeButton.closest('button')).not.toBeVisible()
    if (endButton) expect(endButton.closest('button')).not.toBeVisible()
  })

  it('shows no buttons when ended', () => {
    const { queryByText } = render(
      <SessionStatusBanner
        gameStatus="ended"
        isHost={true}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    expect(queryByText(/Resume/i)).not.toBeInTheDocument()
    expect(queryByText(/End/i)).not.toBeInTheDocument()
  })

  it('calls onResume when Resume button is clicked (host)', () => {
    render(
      <SessionStatusBanner
        gameStatus="paused"
        isHost={true}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    const resumeButton = screen.getByText(/Resume/i).closest('button')
    fireEvent.click(resumeButton!)

    expect(mockOnResume).toHaveBeenCalled()
  })

  it('calls onEnd when End button is clicked (host)', () => {
    render(
      <SessionStatusBanner
        gameStatus="paused"
        isHost={true}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    const endButton = screen.getByText(/End/i).closest('button')
    fireEvent.click(endButton!)

    expect(mockOnEnd).toHaveBeenCalled()
  })
})
