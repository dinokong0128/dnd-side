'use client'

import { useState } from 'react'

interface ChatMessageProps {
  role: 'player' | 'dm' | 'system'
  characterName?: string
  content: string
  profileId?: string | null
  userId?: string
  isLastMessage?: boolean
  isWaitingForDm?: boolean
  onRetry?: () => void
  onDelete?: () => void
  onEdit?: (newContent: string) => void
}

export function ChatMessage({
  role,
  characterName,
  content,
  profileId,
  userId,
  isLastMessage,
  isWaitingForDm,
  onRetry,
  onDelete,
  onEdit,
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(content)

  const canEditOrDelete =
    role === 'player' &&
    isLastMessage === true &&
    !!userId &&
    profileId === userId &&
    !isWaitingForDm

  const handleSave = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    onEdit?.(trimmed)
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
          className="relative max-w-2xl rounded-lg border px-5 py-4"
          style={{
            background: 'rgba(201, 168, 76, 0.08)',
            borderColor: 'rgba(201, 168, 76, 0.15)',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {canEditOrDelete && isHovered && !isEditing && (
            <div
              style={{
                position: 'absolute',
                top: '-18px',
                right: 0,
                display: 'flex',
                gap: '4px',
              }}
            >
              <button
                data-testid="edit-message-btn"
                aria-label="Edit message"
                onClick={() => {
                  setEditText(content)
                  setIsEditing(true)
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid rgba(201,168,76,0.3)',
                  background: 'rgba(201,168,76,0.1)',
                  color: 'var(--dnd-gold)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9.5 2.5L11.5 4.5L4 12H2V10L9.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                  <path d="M8.5 3.5L10.5 5.5" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
              <button
                data-testid="delete-message-btn"
                aria-label="Delete message"
                onClick={onDelete}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid rgba(192,57,43,0.3)',
                  background: 'rgba(139,34,50,0.1)',
                  color: '#e8a0a0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          <div
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--dnd-gold)' }}
          >
            {characterName || 'Unknown Character'}
          </div>

          {isEditing ? (
            <div>
              <textarea
                data-testid="edit-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(201,168,76,0.05)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  borderRadius: 4,
                  color: 'var(--dnd-parchment)',
                  padding: '6px 8px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  data-testid="cancel-edit-btn"
                  onClick={handleCancel}
                  className="dnd-btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '0.65rem' }}
                >
                  Cancel
                </button>
                <button
                  data-testid="save-edit-btn"
                  onClick={handleSave}
                  disabled={!editText.trim()}
                  className="dnd-btn"
                  style={{ padding: '4px 12px', fontSize: '0.65rem' }}
                >
                  Save &amp; Resend
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
