import { render, screen } from '@testing-library/react'
import { InviteRequiredMessage } from '../InviteRequiredMessage'

describe('InviteRequiredMessage', () => {
  it('renders the "Invite Required" heading', () => {
    render(<InviteRequiredMessage />)
    expect(
      screen.getByRole('heading', { name: 'Invite Required' })
    ).toBeInTheDocument()
  })

  it('renders the explanatory body text', () => {
    render(<InviteRequiredMessage />)
    expect(
      screen.getByText(
        /You need a valid invite link to sign up\. Ask your Dungeon Master for one\./
      )
    ).toBeInTheDocument()
  })

  it('has the data-testid="invite-required-message"', () => {
    render(<InviteRequiredMessage />)
    expect(screen.getByTestId('invite-required-message')).toBeInTheDocument()
  })

  it('does not render any form inputs', () => {
    render(<InviteRequiredMessage />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('wraps content in the data-testid container', () => {
    render(<InviteRequiredMessage />)
    const container = screen.getByTestId('invite-required-message')
    expect(container).toContainElement(
      screen.getByRole('heading', { name: 'Invite Required' })
    )
  })
})
