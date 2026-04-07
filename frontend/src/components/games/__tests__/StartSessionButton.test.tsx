import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StartSessionButton } from '../StartSessionButton'
import { useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

global.fetch = jest.fn()

describe('StartSessionButton', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    mockPush.mockClear()
    ;(fetch as jest.Mock).mockClear()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  })

  it('renders "Begin the Adventure" button', () => {
    render(<StartSessionButton gameId="game-1" />)

    expect(screen.getByText(/Begin the Adventure/i)).toBeInTheDocument()
  })

  it('calls /api/games/{gameId}/start on click', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'active' }),
    })

    render(<StartSessionButton gameId="game-1" />)
    const button = screen.getByText(/Begin the Adventure/i).closest('button')

    fireEvent.click(button!)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/games/game-1/start',
        expect.any(Object)
      )
    })
  })

  it('shows loading state while request is in-flight', async () => {
    ;(fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    render(<StartSessionButton gameId="game-1" />)
    const button = screen.getByText(/Begin the Adventure/i).closest('button')

    fireEvent.click(button!)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })

  it('disables button while loading', async () => {
    ;(fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {}))

    render(<StartSessionButton gameId="game-1" />)
    const button = screen.getByText(/Begin the Adventure/i).closest('button')

    fireEvent.click(button!)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })

  it('handles API error gracefully', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    render(<StartSessionButton gameId="game-1" />)
    const button = screen.getByText(/Begin the Adventure/i).closest('button')

    fireEvent.click(button!)

    await waitFor(() => {
      // Should not crash
      expect(button).toBeInTheDocument()
    })
  })
})
