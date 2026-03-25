import { render, screen } from '@testing-library/react'
import { InviteRequiredMessage } from './InviteRequiredMessage'

describe('InviteRequiredMessage', () => {
  it('renders heading and body text', () => {
    render(<InviteRequiredMessage />)
    expect(screen.getByText('Invite required')).toBeInTheDocument()
    expect(
      screen.getByText(/You need a valid invite link to sign up/)
    ).toBeInTheDocument()
  })

  it('has the correct data-testid', () => {
    render(<InviteRequiredMessage />)
    expect(screen.getByTestId('invite-required-message')).toBeInTheDocument()
  })
})
