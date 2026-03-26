import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpForm } from '../SignUpForm'

const mockSignUp = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
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

    it('renders the submit button with text "Create account"', () => {
      render(<SignUpForm {...defaultProps} />)
      const button = screen.getByTestId('submit-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Create account')
    })

    it('renders the "Create account" heading', () => {
      render(<SignUpForm {...defaultProps} />)
      expect(
        screen.getByRole('heading', { name: 'Create account' })
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

    it('does not call signUp when validation fails', async () => {
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('clears previous validation errors on re-submit', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ data: {}, error: null })
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
      mockSignUp.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), '12345678')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled()
      })
    })
  })

  describe('successful submission', () => {
    it('calls supabase.auth.signUp with correct email and password', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'hero@example.com')
      await user.type(screen.getByTestId('password-input'), 'strongpass99')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'hero@example.com',
          password: 'strongpass99',
          options: {
            emailRedirectTo:
              'http://localhost:3000/auth/callback?next=/games/game-123',
          },
        })
      })
    })

    it('includes the gameId in the emailRedirectTo callback URL', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<SignUpForm gameId="custom-game-id" inviteCode="code" />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            options: {
              emailRedirectTo: expect.stringContaining(
                '/auth/callback?next=/games/custom-game-id'
              ),
            },
          })
        )
      })
    })

    it('shows success message after successful sign up', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
        expect(
          screen.getByText('Check your email to confirm your account.')
        ).toBeInTheDocument()
      })
    })

    it('hides the form after successful sign up', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: null })
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
    it('shows the Supabase error message in form-error', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'User already registered' },
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

    it('does not show success message on error', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'Signup disabled' },
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
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'Error' },
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
  })

  describe('loading state', () => {
    it('disables the submit button while loading', async () => {
      let resolveSignUp: (value: unknown) => void
      mockSignUp.mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve
        })
      )
      const user = userEvent.setup()
      render(<SignUpForm {...defaultProps} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      expect(screen.getByTestId('submit-button')).toBeDisabled()

      resolveSignUp!({ data: {}, error: null })
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument()
      })
    })
  })
})
