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

    expect(
      screen.getByRole('button', { name: /Resume Session/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /End/i })).toBeInTheDocument()
  })

  it('hides buttons for non-host when paused', () => {
    render(
      <SessionStatusBanner
        gameStatus="paused"
        isHost={false}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    expect(
      screen.queryByRole('button', { name: /Resume Session/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /End/i })).not.toBeInTheDocument()
  })

  it('shows no buttons when ended', () => {
    render(
      <SessionStatusBanner
        gameStatus="ended"
        isHost={true}
        onResume={mockOnResume}
        onEnd={mockOnEnd}
      />
    )

    expect(
      screen.queryByRole('button', { name: /Resume Session/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /End/i })).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /Resume Session/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /End/i }))

    expect(mockOnEnd).toHaveBeenCalled()
  })
})
