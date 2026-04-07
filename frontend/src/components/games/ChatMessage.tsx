'use client'

interface ChatMessageProps {
  role: 'player' | 'dm' | 'system'
  characterName?: string
  content: string
}

export function ChatMessage({
  role,
  characterName,
  content,
}: ChatMessageProps) {
  if (role === 'dm') {
    return (
      <div className="mb-4 flex justify-start">
        <div
          className="max-w-2xl rounded-lg border px-5 py-4"
          style={{
            background: 'rgba(45, 106, 79, 0.12)',
            borderColor: 'rgba(45, 106, 79, 0.25)',
          }}
        >
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: '#6fcf97' }}
          >
            Dungeon Master
          </div>
          <p
            className="font-serif italic"
            style={{ color: 'var(--dnd-parchment)' }}
          >
            {content}
          </p>
        </div>
      </div>
    )
  }

  if (role === 'player') {
    return (
      <div className="mb-4 flex justify-end">
        <div
          className="max-w-2xl rounded-lg border px-5 py-4"
          style={{
            background: 'rgba(201, 168, 76, 0.08)',
            borderColor: 'rgba(201, 168, 76, 0.15)',
          }}
        >
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--dnd-gold)' }}
          >
            {characterName || 'Unknown Character'}
          </div>
          <p
            className="font-serif"
            style={{ color: 'var(--dnd-parchment)' }}
          >
            {content}
          </p>
        </div>
      </div>
    )
  }

  // System message
  return (
    <div className="mb-4 flex justify-center">
      <div
        className="max-w-2xl rounded-lg border px-5 py-4 text-center text-sm"
        style={{
          background: 'rgba(212, 168, 67, 0.08)',
          borderColor: 'rgba(212, 168, 67, 0.2)',
          color: 'var(--dnd-amber)',
        }}
      >
        <p className="font-serif italic">{content}</p>
      </div>
    </div>
  )
}
