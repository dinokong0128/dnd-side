import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

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
  it('renders fields and submit button', () => {
    render(<LoginForm />)
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('shows Zod errors on empty submit', async () => {
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

  it('calls signInWithPassword with correct args', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
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

  it('shows form-error on auth error', async () => {
    mockSignIn.mockResolvedValue({
      data: {},
      error: { message: 'Invalid credentials' },
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'wrongpassword')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'Invalid email or password'
      )
    })
  })
})
