import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountView } from '../AccountView'

const mockResetPasswordForEmail = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn() as jest.Mock
})

describe('AccountView', () => {
  describe('rendering', () => {
    it('shows the username, email, and initials', () => {
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      expect(
        screen.getByRole('heading', { name: 'Aragorn' })
      ).toBeInTheDocument()
      expect(screen.getByText('a@example.com')).toBeInTheDocument()
      // getInitials("Aragorn") → "AR"
      expect(screen.getByText('AR')).toBeInTheDocument()
    })
  })

  describe('display name saving', () => {
    it('shows a validation error when the name is empty', async () => {
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      const input = screen.getByLabelText(/Display name/i)
      await user.clear(input)
      await user.click(screen.getByRole('button', { name: /^Save$/i }))

      expect(
        screen.getByText(/Display name is required/i)
      ).toBeInTheDocument()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('shows a validation error when the name is too long', async () => {
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      const input = screen.getByLabelText(/Display name/i)
      await user.clear(input)
      await user.type(input, 'a'.repeat(51))
      await user.click(screen.getByRole('button', { name: /^Save$/i }))

      expect(
        screen.getByText(/Display name is too long/i)
      ).toBeInTheDocument()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('PATCHes /api/auth/profile and shows success message on success', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, username: 'Elrond' }),
      })
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      const input = screen.getByLabelText(/Display name/i)
      await user.clear(input)
      await user.type(input, 'Elrond')
      await user.click(screen.getByRole('button', { name: /^Save$/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'Elrond' }),
        })
      })
      expect(
        await screen.findByText(/Display name saved/i)
      ).toBeInTheDocument()
    })

    it('shows server error message on failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Name already in use' }),
      })
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      await user.click(screen.getByRole('button', { name: /^Save$/i }))

      await waitFor(() => {
        expect(screen.getByText(/Name already in use/i)).toBeInTheDocument()
      })
    })

    it('falls back to a generic message when the server returns no error field', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      await user.click(screen.getByRole('button', { name: /^Save$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to save display name/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('password reset', () => {
    it('sends a reset email with the correct redirectTo and shows success', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      await user.click(
        screen.getByRole('button', { name: /Send password reset email/i })
      )

      await waitFor(() => {
        expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
          'a@example.com',
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
          }
        )
      })
      expect(
        await screen.findByText(/Check your inbox for a password reset link/i)
      ).toBeInTheDocument()
    })

    it('shows the Supabase error message on failure', async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        error: { message: 'User not found' },
      })
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      await user.click(
        screen.getByRole('button', { name: /Send password reset email/i })
      )

      await waitFor(() => {
        expect(screen.getByText(/User not found/i)).toBeInTheDocument()
      })
    })

    it('shows a validation error when the email is invalid', async () => {
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="not-an-email" />)

      await user.click(
        screen.getByRole('button', { name: /Send password reset email/i })
      )

      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument()
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
    })
  })

  describe('sign out', () => {
    it('POSTs to /api/auth/logout when Sign Out is clicked', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
      const user = userEvent.setup()
      render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

      await user.click(screen.getByRole('button', { name: /Sign Out/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
          method: 'POST',
        })
      })
      // Post-logout navigation (window.location.assign('/')) is verified
      // in the e2e suite; jsdom does not permit stubbing that method.
    })
  })

  it('links back to the dashboard', () => {
    render(<AccountView initialUsername="Aragorn" email="a@example.com" />)

    expect(
      screen.getByRole('link', { name: /Back to dashboard/i })
    ).toHaveAttribute('href', '/dashboard')
  })
})
