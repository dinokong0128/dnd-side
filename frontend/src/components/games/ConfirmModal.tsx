'use client'

import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel: string
  variant?: 'default' | 'destructive'
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Auto-focus the Cancel button when modal opens
      cancelRef.current?.focus()
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const confirmButtonStyle = {
    background:
      variant === 'destructive'
        ? 'linear-gradient(180deg, var(--dnd-crimson-bright), var(--dnd-crimson))'
        : 'linear-gradient(180deg, var(--dnd-amber), #b8942e)',
    border:
      variant === 'destructive'
        ? '1px solid var(--dnd-crimson)'
        : '1px solid var(--dnd-amber)',
    color: variant === 'destructive' ? 'var(--dnd-parchment)' : 'var(--dnd-black)',
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="dnd-card"
        style={{
          maxWidth: '28rem',
          padding: '2rem',
        }}
      >
        <h2
          className="text-xl font-bold mb-4"
          style={{
            fontFamily: "'Cinzel', serif",
            color: 'var(--dnd-parchment)',
          }}
        >
          {title}
        </h2>

        <p
          className="mb-6"
          style={{
            fontFamily: "'Lora', serif",
            color: 'var(--dnd-parchment-dim)',
            fontSize: '0.9rem',
          }}
        >
          {body}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={isLoading}
            className="dnd-btn-secondary"
            style={{
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-sm px-6 py-2 font-semibold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '0.7rem',
              ...confirmButtonStyle,
            }}
          >
            {isLoading ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <svg
                  style={{
                    animation: 'spin 1s linear infinite',
                    width: '1rem',
                    height: '1rem',
                  }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ opacity: 0.25 }}
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  )
}
