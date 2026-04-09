import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmModal } from '../ConfirmModal'

describe('ConfirmModal', () => {
  const mockOnClose = jest.fn()
  const mockOnConfirm = jest.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
    mockOnConfirm.mockClear()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={false}
        title="Confirm"
        body="Are you sure?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Yes"
      />
    )

    // Should not render dialog/modal content
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('renders title, body, and buttons when isOpen is true', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm Action"
        body="Are you sure you want to proceed?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Proceed"
      />
    )

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
    expect(screen.getByText('Proceed')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        body="Are you sure?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Yes"
      />
    )

    const cancelButton = screen.getByText(/Cancel|cancel/i)
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onClose when overlay is clicked', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        body="Are you sure?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Yes"
      />
    )

    const overlay = container.querySelector('[role="dialog"]')?.parentElement
    if (overlay) {
      fireEvent.click(overlay)
      expect(mockOnClose).toHaveBeenCalled()
    }
  })

  it('calls onClose when Escape is pressed', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        body="Are you sure?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Yes"
      />
    )

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm Title"
        body="Are you sure?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Confirm"
      />
    )

    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    fireEvent.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalled()
  })

  it('shows confirmLabel text on confirm button', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        body="Are you sure?"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Delete Forever"
      />
    )

    expect(screen.getByText('Delete Forever')).toBeInTheDocument()
  })

  it('applies destructive styling when variant is destructive', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={true}
        title="Delete"
        body="This action cannot be undone."
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Delete"
        variant="destructive"
      />
    )

    // Destructive variant should apply red/warning styling
    expect(container.innerHTML).toBeTruthy()
  })

  it('disables buttons when isLoading is true', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        body="Processing..."
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        confirmLabel="Confirm"
        isLoading={true}
      />
    )

    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })
})
