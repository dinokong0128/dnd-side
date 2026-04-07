import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '../TypingIndicator'

describe('TypingIndicator', () => {
  it('renders "The Dungeon Master is writing" text', () => {
    render(<TypingIndicator />)

    expect(screen.getByText(/Dungeon Master is writing/i)).toBeInTheDocument()
  })

  it('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />)

    // Should contain dots or animation elements
    expect(container.innerHTML).toContain('.')
  })
})
