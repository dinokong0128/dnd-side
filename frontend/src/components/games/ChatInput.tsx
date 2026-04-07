'use client'

import { useRef, useState } from 'react'

interface ChatInputProps {
  gameStatus: string
  isWaitingForDm: boolean
  hasCharacter?: boolean
  onSubmit?: (text: string) => void
}

export function ChatInput({
  gameStatus,
  isWaitingForDm,
  hasCharacter,
  onSubmit,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !onSubmit) return

    onSubmit(text)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
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
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder={getPlaceholder()}
            disabled={true}
            className="dnd-input dnd-textarea flex-1 resize-none"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '96px',
            }}
          />
          <button
            type="submit"
            disabled={true}
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
