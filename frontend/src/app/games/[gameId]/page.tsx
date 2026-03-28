import Link from 'next/link'
import { fetchGameById } from '@/lib/supabase/games'
import { GameLobby } from '@/components/games/GameLobby'

export default async function GameLobbyPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await fetchGameById(gameId)

  if (!game) {
    return (
      <div className="dnd-page-container">
        <div className="dnd-card text-center py-12">
          <h1 className="text-xl font-bold text-[var(--dnd-parchment)]" style={{ fontFamily: 'Cinzel, serif' }}>
            Game Not Found
          </h1>
          <p className="mt-2 text-[var(--dnd-parchment-dim)] italic">
            This realm does not exist... or has been lost to time.
          </p>
          <Link href="/dashboard" className="dnd-btn-secondary inline-flex mt-6">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dnd-page-container">
      {/* Back nav */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-[var(--dnd-parchment-dim)] hover:text-[var(--dnd-gold)] transition-colors mb-6 text-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Game header */}
      <div className="dnd-card mb-6" data-testid="game-header">
        <h1
          className="text-2xl font-bold text-[var(--dnd-gold-bright)] tracking-wide"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}
        >
          {game.name}
        </h1>
        {game.dm_persona && (
          <p className="mt-2 italic text-[var(--dnd-parchment-dim)] text-sm leading-relaxed">
            &ldquo;{game.dm_persona}&rdquo;
          </p>
        )}
        <span className="dnd-badge-lobby mt-3 inline-block">
          {game.status === 'pending' ? 'Lobby' : game.status}
        </span>
      </div>

      {/* Character creation / summary + inventory */}
      <GameLobby gameId={gameId} gameStatus={game.status} />
    </div>
  )
}
