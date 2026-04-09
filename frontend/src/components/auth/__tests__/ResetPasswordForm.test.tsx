import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResetPasswordForm } from '../ResetPasswordForm'

const mockUpdateUser = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ResetPasswordForm', () => {
  describe('rendering', () => {
    it('renders both password inputs and submit button', () => {
      render(<ResetPasswordForm />)

      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Update password/i })
      ).toBeInTheDocument()
    })

    it('does not show an error initially', () => {
      render(<ResetPasswordForm />)
      expect(
        screen.queryByText(/Password must be at least 8 characters/i)
      ).not.toBeInTheDocument()
    })
  })

  describe('Zod validation', () => {
    it('shows error when password is too short', async () => {
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      await user.type(screen.getByLabelText(/new password/i), 'short')
      await user.type(screen.getByLabelText(/confirm password/i), 'short')
      await user.click(screen.getByRole('button', { name: /Update password/i }))

      expect(
        screen.getByText(/Password must be at least 8 characters/i)
      ).toBeInTheDocument()
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      await user.type(screen.getByLabelText(/new password/i), 'longenough1')
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'longenough2'
      )
      await user.click(screen.getByRole('button', { name: /Update password/i }))

      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })
  })

  describe('submission', () => {
    it('calls supabase updateUser with the new password on success', async () => {
      mockUpdateUser.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      await user.type(screen.getByLabelText(/new password/i), 'a-new-secret')
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'a-new-secret'
      )
      await user.click(screen.getByRole('button', { name: /Update password/i }))

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          password: 'a-new-secret',
        })
      })
    })

    it('navigates to /dashboard on success', async () => {
      mockUpdateUser.mockResolvedValue({ error: null })
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      await user.type(screen.getByLabelText(/new password/i), 'a-new-secret')
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'a-new-secret'
      )
      await user.click(screen.getByRole('button', { name: /Update password/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('shows the Supabase error message and does not navigate on failure', async () => {
      mockUpdateUser.mockResolvedValue({
        error: { message: 'Password reset token is expired' },
      })
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      await user.type(screen.getByLabelText(/new password/i), 'a-new-secret')
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'a-new-secret'
      )
      await user.click(screen.getByRole('button', { name: /Update password/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/Password reset token is expired/i)
        ).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows "Updating…" while the request is in flight', async () => {
      let resolveUpdate: (value: { error: null }) => void = () => {}
      mockUpdateUser.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve
        })
      )
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      await user.type(screen.getByLabelText(/new password/i), 'a-new-secret')
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'a-new-secret'
      )
      await user.click(screen.getByRole('button', { name: /Update password/i }))

      expect(
        screen.getByRole('button', { name: /Updating/i })
      ).toBeInTheDocument()

      resolveUpdate({ error: null })
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })
  })
})
