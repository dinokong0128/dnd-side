'use client'

import { useState } from 'react'

interface ChatMessageProps {
  role: 'player' | 'dm' | 'system'
  characterName?: string
  content: string
  onRetry?: () => void
  // DIN-61: edit/delete for last player message
  isLastMessage?: boolean
  profileId?: string
  userId?: string
  onDelete?: () => void
  onEdit?: (newContent: string) => void
}

export function ChatMessage({
  role,
  characterName,
  content,
  onRetry,
  isLastMessage,
  profileId,
  userId,
  onDelete,
  onEdit,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(content)

  const canEdit = role === 'player' && isLastMessage === true && profileId === userId

  const handleSave = () => {
    onEdit?.(editText)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditText(content)
    setIsEditing(false)
  }

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
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--dnd-gold)' }}
            >
              {characterName || 'Unknown Character'}
            </div>
            {canEdit && !isEditing && (
              <div className="flex gap-1 ml-3">
                <button
                  data-testid="edit-message"
                  onClick={() => { setEditText(content); setIsEditing(true) }}
                  title="Edit message"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(201,168,76,0.5)',
                    fontSize: '13px',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                >
                  ✏️
                </button>
                <button
                  data-testid="delete-message"
                  onClick={onDelete}
                  title="Delete message"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(192,57,43,0.5)',
                    fontSize: '13px',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
          {isEditing ? (
            <div>
              <textarea
                aria-label="Edit message"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="dnd-input dnd-textarea w-full resize-none"
                style={{ marginBottom: '8px' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="dnd-btn-primary"
                  style={{ padding: '4px 14px', fontSize: '0.7rem' }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="dnd-btn-secondary"
                  style={{ padding: '4px 14px', fontSize: '0.7rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              className="font-serif"
              style={{ color: 'var(--dnd-parchment)' }}
            >
              {content}
            </p>
          )}
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
          background: 'rgba(139,34,50,0.15)',
          borderColor: 'rgba(192,57,43,0.3)',
        }}
      >
        <div
          style={{
            color: '#e8a0a0',
            fontFamily: "'Cinzel', serif",
            fontSize: '0.65rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          System
        </div>
        <p className="font-serif italic" style={{ color: '#e8a0a0' }}>
          {content}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="dnd-btn-secondary"
            style={{ marginTop: '10px', padding: '5px 14px', fontSize: '0.65rem' }}
          >
            ↩ Retry last action
          </button>
        )}
      </div>
    </div>
  )
}
