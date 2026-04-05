import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteSection } from '../InviteSection'

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockWriteText = jest.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('InviteSection', () => {
  describe('rendering', () => {
    it('renders the "Generate Invite Link" button', () => {
      render(<InviteSection gameId="game-1" />)
      expect(screen.getByTestId('generate-invite-button')).toBeInTheDocument()
      expect(screen.getByTestId('generate-invite-button')).toHaveTextContent(
        'Generate Invite Link'
      )
    })

    it('does not show invite URL input initially', () => {
      render(<InviteSection gameId="game-1" />)
      expect(screen.queryByTestId('invite-url-input')).not.toBeInTheDocument()
    })

    it('does not show error initially', () => {
      render(<InviteSection gameId="game-1" />)
      expect(screen.queryByTestId('invite-error')).not.toBeInTheDocument()
    })
  })

  describe('successful generation', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'abc123',
            invite_url: 'http://localhost:3000/auth/signup?code=abc123',
          }),
      })
    })

    it('calls POST /api/games/{gameId}/invites on button click', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-42" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/games/game-42/invites', {
          method: 'POST',
        })
      })
    })

    it('shows invite URL input after success', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('invite-url-input')).toBeInTheDocument()
        expect(screen.getByTestId('invite-url-input')).toHaveValue(
          'http://localhost:3000/auth/signup?code=abc123'
        )
      })
    })

    it('shows Copy button after success', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('copy-button')).toBeInTheDocument()
        expect(screen.getByTestId('copy-button')).toHaveTextContent('Copy')
      })
    })

    it('shows "Generate another link" after success', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-another-link')).toBeInTheDocument()
      })
    })

    it('hides the generate button after success', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(
          screen.queryByTestId('generate-invite-button')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('copy to clipboard', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'abc123',
            invite_url: 'http://localhost:3000/auth/signup?code=abc123',
          }),
      })
    })

    it('calls navigator.clipboard.writeText with invite URL', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      // Spy after userEvent.setup() which may install its own clipboard stub
      const writeTextSpy = jest
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue(undefined)

      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))
      await waitFor(() => screen.getByTestId('copy-button'))

      await user.click(screen.getByTestId('copy-button'))

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(
          'http://localhost:3000/auth/signup?code=abc123'
        )
      })

      writeTextSpy.mockRestore()
    })

    it('shows "Copied!" text after copy', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))
      await waitFor(() => screen.getByTestId('copy-button'))

      await user.click(screen.getByTestId('copy-button'))

      await waitFor(() => {
        expect(screen.getByTestId('copy-button')).toHaveTextContent('Copied!')
      })
    })

    it('resets "Copied!" text back to "Copy" after 2 seconds', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))
      await waitFor(() => screen.getByTestId('copy-button'))

      await user.click(screen.getByTestId('copy-button'))
      await waitFor(() =>
        expect(screen.getByTestId('copy-button')).toHaveTextContent('Copied!')
      )

      act(() => jest.advanceTimersByTime(2000))

      await waitFor(() => {
        expect(screen.getByTestId('copy-button')).toHaveTextContent('Copy')
      })
    })
  })

  describe('generate another link', () => {
    it('resets UI to initial state when "Generate another link" is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'abc123',
            invite_url: 'http://localhost:3000/auth/signup?code=abc123',
          }),
      })

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))
      await waitFor(() => screen.getByTestId('generate-another-link'))

      await user.click(screen.getByTestId('generate-another-link'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-invite-button')).toBeInTheDocument()
        expect(
          screen.queryByTestId('invite-url-input')
        ).not.toBeInTheDocument()
        expect(
          screen.queryByTestId('generate-another-link')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error message from server', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ error: 'Only the game creator can generate invites' }),
      })

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('invite-error')).toBeInTheDocument()
        expect(screen.getByTestId('invite-error')).toHaveTextContent(
          'Only the game creator can generate invites'
        )
      })
    })

    it('shows fallback error when server returns no error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('invite-error')).toHaveTextContent(
          'Failed to generate invite'
        )
      })
    })

    it('shows network error message when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('invite-error')).toHaveTextContent(
          'Network error. Please try again.'
        )
      })
    })

    it('re-enables the button after an error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      await waitFor(() => {
        expect(screen.getByTestId('generate-invite-button')).not.toBeDisabled()
      })
    })
  })

  describe('loading state', () => {
    it('disables the button while loading', async () => {
      let resolveFetch: (value: unknown) => void
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<InviteSection gameId="game-1" />)

      await user.click(screen.getByTestId('generate-invite-button'))

      expect(screen.getByTestId('generate-invite-button')).toBeDisabled()
      expect(screen.getByTestId('generate-invite-button')).toHaveTextContent(
        'Generating...'
      )

      resolveFetch!({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'abc123',
            invite_url: 'http://localhost:3000/auth/signup?code=abc123',
          }),
      })

      await waitFor(() => {
        expect(
          screen.queryByTestId('generate-invite-button')
        ).not.toBeInTheDocument()
      })
    })
  })
})
