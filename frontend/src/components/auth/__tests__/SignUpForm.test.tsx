import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpForm } from '../SignUpForm'

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SignUpForm', () => {
  const defaultProps = { gameId: 'game-123', inviteCode: 'invite-abc' }

  describe('rendering', () => {
    it('renders the email input with data-testid', () => {
      render(<SignUpForm {...defaultProps} />)
      expect(screen.getByTestId('email-input')).toBeInTheDocument()
    })

    it('renders the password input with data-testid', () => {
      render(<SignUpForm {...defaultProps} />)
      expect(screen.getByTestId('password-input')).toBeInTheDocument()
    })

    it('renders the submit button with text "Join the Adventure"', () => {
      render(<SignUpForm {...defaultProps} />)
      const button = screen.getByTestId('submit-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Join the Adventure')
    })

    it('renders the "Join the Adventure" heading', () => {
      render(<SignUpForm {...defaultProps} />)
      expect(
        screen.getByRole('heading', { name: 'Join the Adventure' })
      ).toBeInTheDocument()
    })

    it('does not show success message initially', () => {
      render(<SignUpForm {...defaultProps} />)
      expect(screen.queryByTestId('success-message')).not.toBeInTheDocument()
    })

    it('does not show form error initially', () => {
      render(<SignUpForm {...defaultProps} />)
      expect(screen.queryByTestId('form-error')).not.toBeInTheDocument()
    })
  })

  describe('Zod validation', () => {
    it('shows email error on empty submit', async () => {
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })
    })

    it('shows password error for password < 8 chars', async () => {
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'short')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Password must be at least 8 characters/)
        ).toBeInTheDocument()
      })
    })

    it('shows both email and password errors when both are invalid', async () => {
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
        expect(
          screen.getByText(/Password must be at least 8 characters/)
        ).toBeInTheDocument()
      })
    })

    it('does not call the API when validation fails', async () => {
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('clears previous validation errors on re-submit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      // First submit: triggers validation errors
      await user.click(screen.getByTestId('submit-button'))
      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })

      // Fill valid data and re-submit
      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'validpassword')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.queryByText(/Please enter a valid email address/)
        ).not.toBeInTheDocument()
      })
    })

    it('accepts password of exactly 8 characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), '12345678')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('successful submission', () => {
    it('sends a POST to /api/auth/signup with invite code and game ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'hero@example.com')
      await user.type(screen.getByTestId('password-input'), 'strongpass99')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'hero@example.com',
            password: 'strongpass99',
            invite_code: 'invite-abc',
            game_id: 'game-123',
          }),
        })
      })
    })

    it('passes custom gameId and inviteCode from props', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      const user = userEvent.setup()
      render(<SignUpForm gameId="custom-game-id" inviteCode="custom-code" />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        const body = JSON.parse(
          (mockFetch.mock.calls[0][1] as RequestInit).body as string
        )
        expect(body.invite_code).toBe('custom-code')
        expect(body.game_id).toBe('custom-game-id')
      })
    })

    it('shows success message after successful sign up', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
        expect(
          screen.getByText(/Check your email to confirm your account/)
        ).toBeInTheDocument()
      })
    })

    it('hides the form after successful sign up', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('email-input')).not.toBeInTheDocument()
        expect(screen.queryByTestId('password-input')).not.toBeInTheDocument()
        expect(screen.queryByTestId('submit-button')).not.toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows the server error message in form-error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'User already registered' }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'User already registered'
        )
      })
    })

    it('shows error when invite code is invalid (403)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ error: 'Invalid or expired invite code' }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Invalid or expired invite code'
        )
      })
    })

    it('does not show success message on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Signup disabled' }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('success-message')).not.toBeInTheDocument()
    })

    it('keeps the form visible so user can correct and retry', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Error' }),
      })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })
      expect(screen.getByTestId('email-input')).toBeInTheDocument()
      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
    })

    it('shows generic error when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'An unexpected error occurred'
        )
      })
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
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      expect(screen.getByTestId('submit-button')).toBeDisabled()

      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
      })
    })
  })
})
