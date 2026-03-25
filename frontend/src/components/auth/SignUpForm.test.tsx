import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpForm } from './SignUpForm'

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
  delete (process.env as Record<string, string | undefined>)
    .NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
})

describe('SignUpForm', () => {
  it('renders all fields', () => {
    render(<SignUpForm gameId="g1" inviteCode="code1" />)
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('shows Zod error on empty submit', async () => {
    const user = userEvent.setup()
    render(<SignUpForm gameId="g1" inviteCode="code1" />)

    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid email address/)
      ).toBeInTheDocument()
    })
  })

  it('shows Zod error for password < 8 chars', async () => {
    const user = userEvent.setup()
    render(<SignUpForm gameId="g1" inviteCode="code1" />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'short')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(
        screen.getByText(/Password must be at least 8 characters/)
      ).toBeInTheDocument()
    })
  })

  it('calls signUp with correct args on valid submit', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<SignUpForm gameId="g1" inviteCode="code1" />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?next=/games/g1',
        },
      })
    })
  })

  it('shows success message on resolve', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<SignUpForm gameId="g1" inviteCode="code1" />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument()
    })
  })

  it('shows form-error on Supabase error', async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: 'User already exists' },
    })
    const user = userEvent.setup()
    render(<SignUpForm gameId="g1" inviteCode="code1" />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'User already exists'
      )
    })
  })
})
