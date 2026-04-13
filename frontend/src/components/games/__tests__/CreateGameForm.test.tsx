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

    it('renders the submit button with text "Begin the Campaign"', () => {
      render(<CreateGameForm />)
      const button = screen.getByTestId('submit-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Begin the Campaign')
    })

    it('renders the "Begin a New Campaign" heading', () => {
      render(<CreateGameForm />)
      expect(
        screen.getByRole('heading', { name: 'Begin a New Campaign' })
      ).toBeInTheDocument()
    })

    it('shows placeholder text on the DM persona textarea', () => {
      render(<CreateGameForm />)
      expect(screen.getByTestId('dm-persona-input')).toHaveAttribute(
        'placeholder',
        expect.stringContaining('gritty pirate adventure')
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

  describe('auto-generate wand buttons (DIN-63)', () => {
    it('renders a wand button next to the Campaign Name input', () => {
      render(<CreateGameForm />)
      expect(screen.getByTestId('generate-game-name')).toBeInTheDocument()
    })

    it('renders a wand button next to the DM Persona textarea', () => {
      render(<CreateGameForm />)
      expect(screen.getByTestId('generate-dm-persona')).toBeInTheDocument()
    })

    it('calls /api/generate-text with type=game_name and populates the input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestion: 'The Shattered Crown' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.click(screen.getByTestId('generate-game-name'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/generate-text',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ type: 'game_name' }),
          })
        )
      })

      await waitFor(() => {
        expect(
          (screen.getByTestId('game-name-input') as HTMLInputElement).value
        ).toBe('The Shattered Crown')
      })
    })

    it('calls /api/generate-text with type=dm_persona and populates the textarea', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestion: 'A gritty pirate campaign.' }),
      })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.click(screen.getByTestId('generate-dm-persona'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/generate-text',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ type: 'dm_persona' }),
          })
        )
      })

      await waitFor(() => {
        expect(
          (screen.getByTestId('dm-persona-input') as HTMLTextAreaElement).value
        ).toBe('A gritty pirate campaign.')
      })
    })

    it('disables wand button during in-flight request and re-enables after', async () => {
      let resolveFetch!: (value: unknown) => void
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => { resolveFetch = resolve })
      )
      const user = userEvent.setup()
      render(<CreateGameForm />)

      await user.click(screen.getByTestId('generate-game-name'))

      expect(screen.getByTestId('generate-game-name')).toBeDisabled()

      resolveFetch({ ok: true, json: () => Promise.resolve({ suggestion: 'Test' }) })

      await waitFor(() => {
        expect(screen.getByTestId('generate-game-name')).not.toBeDisabled()
      })
    })

    it('silently fails and re-enables button when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })
      const user = userEvent.setup()
      render(<CreateGameForm />)

      const nameInput = screen.getByTestId('game-name-input') as HTMLInputElement
      const prevValue = nameInput.value

      await user.click(screen.getByTestId('generate-game-name'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-game-name')).not.toBeDisabled()
      })
      expect(nameInput.value).toBe(prevValue)
    })
  })
})
