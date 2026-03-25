import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateGameForm } from './CreateGameForm'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
})

describe('CreateGameForm', () => {
  it('renders fields', () => {
    render(<CreateGameForm />)
    expect(screen.getByTestId('game-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('dm-persona-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('shows Zod error on empty name', async () => {
    const user = userEvent.setup()
    render(<CreateGameForm />)

    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(screen.getByText(/Game name is required/)).toBeInTheDocument()
    })
  })

  it('submits with correct payload including default dm_persona', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'new-game-id' }),
    })
    const user = userEvent.setup()
    render(<CreateGameForm />)

    await user.type(screen.getByTestId('game-name-input'), 'My Campaign')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Campaign',
          dm_persona: 'A classic high-fantasy D&D adventure.',
        }),
      })
    })
  })

  it('routes to game on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'new-game-id' }),
    })
    const user = userEvent.setup()
    render(<CreateGameForm />)

    await user.type(screen.getByTestId('game-name-input'), 'My Campaign')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/games/new-game-id')
    })
  })

  it('shows form-error on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    })
    const user = userEvent.setup()
    render(<CreateGameForm />)

    await user.type(screen.getByTestId('game-name-input'), 'My Campaign')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'Server error'
      )
    })
  })
})
