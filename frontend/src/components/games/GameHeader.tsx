'use client'

import { useMemo } from 'react'

interface GameHeaderProps {
  gameName: string
  gameStatus: string
}

export function GameHeader({ gameName, gameStatus }: GameHeaderProps) {
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
          <span className={`dnd-badge ${statusBadgeClass}`}>
            {gameStatus}
          </span>
        </div>
      </div>
    </header>
  )
}
