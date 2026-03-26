import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateGameForm } from '../CreateGameForm'

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
  describe('rendering', () => {
    it('renders the game name input with data-testid', () => {
      render(<CreateGameForm />)
      expect(screen.getByTestId('game-name-input')).toBeInTheDocument()
    })

    it('renders the DM persona textarea with data-testid', () => {
      render(<CreateGameForm />)
      expect(screen.getByTestId('dm-persona-input')).toBeInTheDocument()
    })

    it('renders the submit button with text "Create Game"', () => {
      render(<CreateGameForm />)
      const button = screen.getByTestId('submit-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Create Game')
    })

    it('renders the "Create New Game" heading', () => {
      render(<CreateGameForm />)
      expect(
        screen.getByRole('heading', { name: 'Create New Game' })
      ).toBeInTheDocument()
    })

    it('shows placeholder text on the DM persona textarea', () => {
      render(<CreateGameForm />)
      expect(screen.getByTestId('dm-persona-input')).toHaveAttribute(
        'placeholder',
        'A gritty dark fantasy world where magic is forbidden...'
      )
    })

    it('does not show form error initially', () => {
      render(<CreateGameForm />)
      expect(screen.queryByTestId('form-error')).not.toBeInTheDocument()
    })
  })

  describe('Zod validation', () => {
    it('shows error when name is empty', async () => {
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText(/Game name is required/)).toBeInTheDocument()
      })
    })

    it('does not call fetch when validation fails', async () => {
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText(/Game name is required/)).toBeInTheDocument()
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('shows error when name exceeds 100 characters', async () => {
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'A'.repeat(101))
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Game name must be 100 characters or less/)
        ).toBeInTheDocument()
      })
    })

    it('accepts a name of exactly 100 characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'game-1' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'A'.repeat(100))
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('clears validation errors on re-submit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'game-1' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      // Trigger error
      await user.click(screen.getByTestId('submit-button'))
      await waitFor(() => {
        expect(screen.getByText(/Game name is required/)).toBeInTheDocument()
      })

      // Fix and re-submit
      await user.type(screen.getByTestId('game-name-input'), 'Valid Name')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.queryByText(/Game name is required/)
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('successful submission', () => {
    it('sends a POST to /api/games with correct payload', async () => {
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

    it('uses the default dm_persona when textarea is left blank', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'g1' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Test')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        const body = JSON.parse(
          (mockFetch.mock.calls[0][1] as RequestInit).body as string
        )
        expect(body.dm_persona).toBe('A classic high-fantasy D&D adventure.')
      })
    })

    it('uses the custom dm_persona when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'g1' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Dark Campaign')
      await user.type(
        screen.getByTestId('dm-persona-input'),
        'A gritty world of shadows'
      )
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        const body = JSON.parse(
          (mockFetch.mock.calls[0][1] as RequestInit).body as string
        )
        expect(body.dm_persona).toBe('A gritty world of shadows')
      })
    })

    it('trims whitespace-only dm_persona and falls back to default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'g1' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Test')
      await user.type(screen.getByTestId('dm-persona-input'), '   ')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        const body = JSON.parse(
          (mockFetch.mock.calls[0][1] as RequestInit).body as string
        )
        expect(body.dm_persona).toBe('A classic high-fantasy D&D adventure.')
      })
    })

    it('redirects to /games/[id] on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'created-game-42' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'My Campaign')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/games/created-game-42')
      })
    })
  })

  describe('error handling', () => {
    it('shows server error message in form-error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Test')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Unauthorized'
        )
      })
    })

    it('shows fallback error when server returns no error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Test')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Failed to create game'
        )
      })
    })

    it('shows generic error when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Test')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'An unexpected error occurred'
        )
      })
    })

    it('does not redirect on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'Test')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('disables the submit button while loading', async () => {
      let resolveFetch: (value: unknown) => void
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.type(screen.getByTestId('game-name-input'), 'My Game')
      await user.click(screen.getByTestId('submit-button'))

      expect(screen.getByTestId('submit-button')).toBeDisabled()

      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ id: 'g1' }),
      })
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })
  })
})
