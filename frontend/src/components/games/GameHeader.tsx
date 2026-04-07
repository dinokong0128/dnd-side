'use client'

import { useMemo } from 'react'

interface GameHeaderProps {
  gameName: string
  gameStatus: string
  isHost?: boolean
  onPause?: () => void
  onEnd?: () => void
}

export function GameHeader({ gameName, gameStatus, isHost = false, onPause, onEnd }: GameHeaderProps) {
  const statusBadgeClass = useMemo(() => {
    switch (gameStatus) {
      case 'lobby':
        return 'dnd-badge-lobby'
      case 'active':
        return 'dnd-badge-active'
      case 'paused':
        return 'dnd-badge-paused'
      case 'ended':
        return 'dnd-badge-ended'
      default:
        return 'dnd-badge-lobby'
    }
  }, [gameStatus])

  return (
    <header
      className="flex-shrink-0 border-b"
      style={{
        borderColor: 'var(--dnd-brown)',
        background: 'var(--dnd-charcoal)',
        height: '56px',
      }}
    >
      <div className="flex h-full items-center justify-between px-6">
        <h1
          className="text-lg font-bold tracking-wide"
          style={{ fontFamily: "'Cinzel', serif", color: 'var(--dnd-parchment)' }}
        >
          ⚔ {gameName}
        </h1>
        <div className="flex items-center gap-4">
          {isHost && gameStatus === 'active' && (
            <>
              <button
                onClick={onPause}
                className="dnd-btn-secondary"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.4rem 0.8rem',
                  letterSpacing: '0.05em',
                }}
                title="Pause session"
              >
                ⏸ Pause
              </button>
              <button
                onClick={onEnd}
                className="dnd-btn-secondary"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.4rem 0.8rem',
                  color: 'var(--dnd-crimson-bright)',
                  borderColor: 'rgba(139, 34, 50, 0.4)',
                  letterSpacing: '0.05em',
                }}
                title="End session"
              >
                ⏹ End
              </button>
            </>
          )}
          {isHost && gameStatus === 'paused' && (
            <button
              onClick={onEnd}
              className="dnd-btn-secondary"
              style={{
                fontSize: '0.7rem',
                padding: '0.4rem 0.8rem',
                color: 'var(--dnd-crimson-bright)',
                borderColor: 'rgba(139, 34, 50, 0.4)',
                letterSpacing: '0.05em',
              }}
              title="End session permanently"
            >
              ⏹ End
            </button>
          )}
          <span className={`dnd-badge ${statusBadgeClass}`}>
            {gameStatus}
          </span>
        </div>
      </div>
    </header>
  )
}
