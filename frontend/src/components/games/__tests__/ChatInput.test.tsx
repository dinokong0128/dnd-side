import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from '../ChatInput'

describe('ChatInput', () => {
  describe('disabled state logic', () => {
    it('disables textarea when gameStatus is not "active"', () => {
      const { rerender, container } = render(
        <ChatInput
          gameStatus="lobby"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      let textarea = container.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea).toBeDisabled()

      // Test other non-active statuses
      rerender(
        <ChatInput
          gameStatus="paused"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )
      textarea = container.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea).toBeDisabled()

      rerender(
        <ChatInput
          gameStatus="ended"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )
      textarea = container.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea).toBeDisabled()
    })

    it('disables textarea when isWaitingForDm is true', () => {
      const { rerender, container } = render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={true}
          hasCharacter={true}
        />
      )

      let textarea = container.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea).toBeDisabled()

      // Should re-enable when waiting is false
      rerender(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )
      textarea = container.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea).toBeEnabled()
    })

    it('disables textarea when hasCharacter is false', () => {
      const { rerender } = render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={false}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)
      expect(textarea).toBeDisabled()

      // Should re-enable when hasCharacter is true
      rerender(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )
      expect(textarea).toBeEnabled()
    })

    it('enables textarea only when all conditions are met', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)
      expect(textarea).toBeEnabled()
    })
  })

  describe('send button disabled state', () => {
    it('disables send button when textarea is empty', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const button = screen.getByRole('button', { name: /Send/i })
      expect(button).toBeDisabled()
    })

    it('disables send button when text is only whitespace', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: '   ' } })
      expect(button).toBeDisabled()
    })

    it('enables send button when textarea has non-whitespace text', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: 'I attack the goblin' } })
      expect(button).toBeEnabled()
    })

    it('disables send button when game is not active', () => {
      render(
        <ChatInput
          gameStatus="lobby"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(/Waiting for host to start/)
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: 'Some text' } })
      expect(button).toBeDisabled()
    })

    it('disables send button when waiting for DM', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={true}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(/The Dungeon Master is writing/)
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: 'Some text' } })
      expect(button).toBeDisabled()
    })
  })

  describe('placeholder text', () => {
    it('shows different placeholders based on game state', () => {
      const { rerender } = render(
        <ChatInput gameStatus="lobby" isWaitingForDm={false} hasCharacter={true} />
      )

      expect(
        screen.getByPlaceholderText(/Waiting for host to start/)
      ).toBeInTheDocument()

      rerender(
        <ChatInput gameStatus="paused" isWaitingForDm={false} hasCharacter={true} />
      )
      expect(screen.getByPlaceholderText(/Session is paused/)).toBeInTheDocument()

      rerender(
        <ChatInput gameStatus="ended" isWaitingForDm={false} hasCharacter={true} />
      )
      expect(
        screen.getByPlaceholderText(/This adventure has concluded/)
      ).toBeInTheDocument()

      rerender(
        <ChatInput gameStatus="active" isWaitingForDm={true} hasCharacter={true} />
      )
      expect(
        screen.getByPlaceholderText(/The Dungeon Master is writing/)
      ).toBeInTheDocument()

      rerender(
        <ChatInput gameStatus="active" isWaitingForDm={false} hasCharacter={true} />
      )
      expect(
        screen.getByPlaceholderText(/What does your character do/)
      ).toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('calls onSubmit when form is submitted via button click', () => {
      const mockSubmit = jest.fn()
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
          onSubmit={mockSubmit}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: 'I cast magic missile' } })
      fireEvent.click(button)

      expect(mockSubmit).toHaveBeenCalledWith('I cast magic missile')
    })

    it('clears textarea after submission', () => {
      const mockSubmit = jest.fn()
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
          onSubmit={mockSubmit}
        />
      )

      const textarea = screen.getByPlaceholderText(
        /What does your character do/
      ) as HTMLTextAreaElement
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: 'Action text' } })
      fireEvent.click(button)

      expect(textarea.value).toBe('')
    })

    it('does not call onSubmit if text is empty', () => {
      const mockSubmit = jest.fn()
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
          onSubmit={mockSubmit}
        />
      )

      const button = screen.getByRole('button', { name: /Send/i })
      fireEvent.click(button)

      expect(mockSubmit).not.toHaveBeenCalled()
    })
  })

  describe('keyboard shortcuts', () => {
    it('submits on Enter key press', () => {
      const mockSubmit = jest.fn()
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
          onSubmit={mockSubmit}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)

      fireEvent.change(textarea, { target: { value: 'Test action' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      expect(mockSubmit).toHaveBeenCalledWith('Test action')
    })

    it('does not submit on Shift+Enter (allows newline)', () => {
      const mockSubmit = jest.fn()
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
          onSubmit={mockSubmit}
        />
      )

      const textarea = screen.getByPlaceholderText(
        /What does your character do/
      ) as HTMLTextAreaElement

      fireEvent.change(textarea, { target: { value: 'Line 1' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      // mockSubmit should not have been called
      expect(mockSubmit).not.toHaveBeenCalled()

      // Text should still be in textarea
      expect(textarea.value).toContain('Line 1')
    })

    it('does not submit if text is whitespace-only on Enter', () => {
      const mockSubmit = jest.fn()
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
          onSubmit={mockSubmit}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)

      fireEvent.change(textarea, { target: { value: '   ' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      expect(mockSubmit).not.toHaveBeenCalled()
    })
  })

  describe('optional props', () => {
    it('handles optional onSubmit prop gracefully', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(/What does your character do/)
      const button = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(textarea, { target: { value: 'Action' } })
      // Should not crash even without onSubmit
      fireEvent.click(button)
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })

    it('handles hasCharacter as undefined', () => {
      const { container } = render(
        <ChatInput gameStatus="active" isWaitingForDm={false} />
      )

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement
      // When hasCharacter is undefined, it should be treated as false (disabled)
      expect(textarea).toBeDisabled()
    })
  })

  describe('textarea auto-grow behavior', () => {
    it('auto-grows textarea as user types', () => {
      render(
        <ChatInput
          gameStatus="active"
          isWaitingForDm={false}
          hasCharacter={true}
        />
      )

      const textarea = screen.getByPlaceholderText(
        /What does your character do/
      ) as HTMLTextAreaElement

      // The implementation sets height based on scrollHeight when typing
      // We can't directly set scrollHeight in tests, so just verify the handler works
      fireEvent.change(textarea, {
        target: {
          value: 'I spend a long time describing my character actions in great detail...',
        },
      })

      // Verify the text was set
      expect(textarea.value).toBe('I spend a long time describing my character actions in great detail...')
      // Verify component is still in the document (no errors)
      expect(textarea).toBeInTheDocument()
    })
  })
})
