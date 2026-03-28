import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'

const mockSignIn = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('LoginForm', () => {
  describe('rendering', () => {
    it('renders the email input with data-testid', () => {
      render(<LoginForm />)
      expect(screen.getByTestId('email-input')).toBeInTheDocument()
    })

    it('renders the password input with data-testid', () => {
      render(<LoginForm />)
      expect(screen.getByTestId('password-input')).toBeInTheDocument()
    })

    it('renders the submit button with text "Enter the Realm"', () => {
      render(<LoginForm />)
      const button = screen.getByTestId('submit-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Enter the Realm')
    })

    it('renders the "Welcome Back" heading', () => {
      render(<LoginForm />)
      expect(
        screen.getByRole('heading', { name: 'Welcome Back' })
      ).toBeInTheDocument()
    })

    it('renders a link to the signup page', () => {
      render(<LoginForm />)
      const link = screen.getByRole('link', { name: /Sign up with an invite/ })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/auth/signup')
    })

    it('does not show form error initially', () => {
      render(<LoginForm />)
      expect(screen.queryByTestId('form-error')).not.toBeInTheDocument()
    })
  })

  describe('Zod validation', () => {
    it('shows email error on empty submit', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })
    })

    it('shows password error when password is empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText(/Password is required/)).toBeInTheDocument()
      })
    })

    it('shows both errors when both fields are empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
        expect(screen.getByText(/Password is required/)).toBeInTheDocument()
      })
    })

    it('does not call signInWithPassword when validation fails', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })
      expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('clears previous validation errors on valid re-submit', async () => {
      mockSignIn.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<LoginForm />)

      // First: trigger errors
      await user.click(screen.getByTestId('submit-button'))
      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })

      // Fix and re-submit
      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.queryByText(/Please enter a valid email address/)
        ).not.toBeInTheDocument()
      })
    })

    it('does not call signInWithPassword when email field is empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('password-input'), 'password')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid email address/)
        ).toBeInTheDocument()
      })
      expect(mockSignIn).not.toHaveBeenCalled()
    })
  })

  describe('successful login', () => {
    it('calls signInWithPassword with correct email and password', async () => {
      mockSignIn.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'hero@example.com')
      await user.type(screen.getByTestId('password-input'), 'mypassword')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'hero@example.com',
          password: 'mypassword',
        })
      })
    })

    it('redirects to /dashboard on success', async () => {
      mockSignIn.mockResolvedValue({ data: {}, error: null })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('error handling', () => {
    it('shows "Invalid email or password" on auth error', async () => {
      mockSignIn.mockResolvedValue({
        data: {},
        error: { message: 'Invalid login credentials' },
      })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'wrongpass')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Invalid email or password'
        )
      })
    })

    it('does not redirect on auth error', async () => {
      mockSignIn.mockResolvedValue({
        data: {},
        error: { message: 'Error' },
      })
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'wrongpass')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('clears form error when user re-submits', async () => {
      mockSignIn
        .mockResolvedValueOnce({
          data: {},
          error: { message: 'fail' },
        })
        .mockResolvedValueOnce({ data: {}, error: null })

      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'wrongpass')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })

      // Re-submit with correct password
      await user.clear(screen.getByTestId('password-input'))
      await user.type(screen.getByTestId('password-input'), 'correctpass')
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('form-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('disables the submit button while loading', async () => {
      let resolveSignIn: (value: unknown) => void
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve
        })
      )
      const user = userEvent.setup()
      render(<LoginForm />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('submit-button'))

      expect(screen.getByTestId('submit-button')).toBeDisabled()

      resolveSignIn!({ data: {}, error: null })
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })
})
