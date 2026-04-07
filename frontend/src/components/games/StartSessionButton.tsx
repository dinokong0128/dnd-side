'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface StartSessionButtonProps {
  gameId: string
}

export function StartSessionButton({ gameId }: StartSessionButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartSession = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/games/${gameId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start session')
      }

      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleStartSession}
        disabled={isLoading}
        className="w-full rounded-sm px-6 py-3 font-semibold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
        style={{
          background: 'linear-gradient(180deg, #3a9d6e, #2d6a4f)',
          border: '1px solid #2d6a4f',
          color: 'var(--dnd-parchment)',
          fontFamily: "'Cinzel', serif",
        }}
      >
        {isLoading ? 'Starting...' : '⚔ Begin the Adventure'}
      </button>
      {error && (
        <div className="dnd-error-banner">
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
