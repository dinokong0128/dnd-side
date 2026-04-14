'use client'

import { useRef, useState } from 'react'

interface ChatInputProps {
  gameStatus: string
  isWaitingForDm: boolean
  hasCharacter?: boolean
  onSubmit?: (text: string) => void
  suggestedActions?: string[]
}

export function ChatInput({
  gameStatus,
  isWaitingForDm,
  hasCharacter,
  onSubmit,
  suggestedActions,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [prevSuggestedActions, setPrevSuggestedActions] = useState(suggestedActions)

  // Reset cycling index when new suggestions arrive (state adjustment during render)
  if (prevSuggestedActions !== suggestedActions) {
    setPrevSuggestedActions(suggestedActions)
    setSuggestionIdx(0)
  }

  const getPlaceholder = () => {
    if (gameStatus === 'lobby') {
      return 'Waiting for host to start session…'
    }
    if (gameStatus === 'paused') {
      return 'Session is paused'
    }
    if (gameStatus === 'ended') {
      return 'This adventure has concluded'
    }
    if (isWaitingForDm) {
      return 'The Dungeon Master is writing…'
    }
    return 'What does your character do?'
  }

  const isDisabled = gameStatus !== 'active' || isWaitingForDm || hasCharacter !== true
  const canSend = gameStatus === 'active' && !isWaitingForDm && hasCharacter === true && text.trim().length > 0

  const hasSuggestions = Boolean(
    suggestedActions && suggestedActions.length > 0 && !isDisabled
  )

  const handleCycle = () => {
    if (!suggestedActions || suggestedActions.length === 0) return
    setText(suggestedActions[suggestionIdx])
    setSuggestionIdx((prev) => (prev + 1) % suggestedActions.length)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !onSubmit) return

    onSubmit(text)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend && onSubmit) {
        onSubmit(text)
        setText('')
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      }
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)

    // Auto-grow textarea (max 4 lines)
    const textarea = e.target
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 6 * 16) // ~4 lines at default font
    textarea.style.height = `${newHeight}px`
  }

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{
        borderColor: 'var(--dnd-brown)',
        background: 'var(--dnd-charcoal)',
      }}
    >
      <div className="mx-auto max-w-3xl p-4">
        {hasSuggestions && (
          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: '#8a7234',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Suggestion {suggestionIdx === 0 ? suggestedActions!.length : suggestionIdx} of{' '}
            {suggestedActions!.length} · click ✨ to cycle
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            data-testid="chat-textarea"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isDisabled}
            className="dnd-input dnd-textarea flex-1 resize-none"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '96px',
            }}
          />
          <button
            type="button"
            data-testid="cycle-suggestion-btn"
            onClick={handleCycle}
            disabled={!hasSuggestions}
            title="Cycle action suggestion"
            style={{
              flexShrink: 0,
              width: '42px',
              height: '40px',
              background: hasSuggestions ? 'rgba(201,168,76,0.08)' : '#0f0d0a',
              border: hasSuggestions ? '1px solid #8a7234' : '1px solid #3a332b',
              borderRadius: '0.375rem',
              fontSize: '18px',
              lineHeight: 1,
              opacity: hasSuggestions ? 1 : 0.3,
              cursor: hasSuggestions ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            ✨
          </button>
          <button
            type="submit"
            disabled={!canSend}
            className="flex-shrink-0 rounded-sm px-6 py-2 font-semibold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(180deg, #3a9d6e, #2d6a4f)',
              border: '1px solid #2d6a4f',
              color: 'var(--dnd-parchment)',
              fontFamily: "'Cinzel', serif",
              height: '40px',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
