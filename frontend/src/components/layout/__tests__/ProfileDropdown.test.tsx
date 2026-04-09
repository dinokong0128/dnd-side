import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileDropdown } from '../ProfileDropdown'

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock
})

describe('ProfileDropdown', () => {
  it('renders the initials inside the trigger button', () => {
    render(<ProfileDropdown initials="JD" />)

    expect(
      screen.getByRole('button', { name: /Open profile menu/i })
    ).toHaveTextContent('JD')
  })

  it('does not render the menu initially', () => {
    render(<ProfileDropdown initials="JD" />)

    expect(
      screen.queryByRole('menu', { name: /Profile menu/i })
    ).not.toBeInTheDocument()
  })

  it('opens the menu when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown initials="JD" />)

    await user.click(screen.getByRole('button', { name: /Open profile menu/i }))

    expect(
      screen.getByRole('menu', { name: /Profile menu/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /My Profile/i })).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /Sign Out/i })
    ).toBeInTheDocument()
  })

  it('toggles the menu closed when the trigger is clicked a second time', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown initials="JD" />)

    const trigger = screen.getByRole('button', { name: /Open profile menu/i })
    await user.click(trigger)
    await user.click(trigger)

    expect(
      screen.queryByRole('menu', { name: /Profile menu/i })
    ).not.toBeInTheDocument()
  })

  it('closes the menu when the Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown initials="JD" />)

    await user.click(screen.getByRole('button', { name: /Open profile menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu when a mousedown occurs outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <ProfileDropdown initials="JD" />
        <div data-testid="outside">Outside</div>
      </div>
    )

    await user.click(screen.getByRole('button', { name: /Open profile menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('POSTs to /api/auth/logout when Sign Out is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown initials="JD" />)

    await user.click(screen.getByRole('button', { name: /Open profile menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /Sign Out/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
      })
    })
    // Post-logout navigation (window.location.assign('/')) is verified
    // in the e2e suite; jsdom does not permit stubbing that method.
  })

  it('closes the menu when My Profile is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfileDropdown initials="JD" />)

    await user.click(screen.getByRole('button', { name: /Open profile menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /My Profile/i }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
