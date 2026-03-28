import Link from 'next/link'
import { fetchGameById } from '@/lib/supabase/games'
import { createClient } from '@/lib/supabase/server'
import { fetchPlayerByProfileAndGame, fetchInventoryByPlayer } from '@/lib/supabase/players'
import { CharacterLobby } from '@/components/games/CharacterLobby'

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'lobby':
    case 'pending':
      return 'dnd-badge dnd-badge-lobby'
    case 'active':
      return 'dnd-badge dnd-badge-active'
    case 'paused':
      return 'dnd-badge dnd-badge-paused'
    default:
      return 'dnd-badge dnd-badge-lobby'
  }
}

export default async function GameLobbyPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await fetchGameById(gameId)

  if (!game) {
    return (
      <div className="dnd-page-bg flex min-h-screen items-center justify-center">
        <div className="dnd-card px-8 py-6 text-center">
          <h1 className="dnd-heading text-xl font-bold mb-2">Game Not Found</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            This game doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Link href="/dashboard" className="dnd-link text-sm mt-4 inline-block">
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let player = null
  let inventory: Awaited<ReturnType<typeof fetchInventoryByPlayer>> = []

  if (user) {
    player = await fetchPlayerByProfileAndGame(user.id, gameId)
    if (player) {
      inventory = await fetchInventoryByPlayer(player.id)
    }
  }

  return (
    <div className="dnd-page-bg min-h-screen px-4 py-12" data-testid="game-lobby-stub">
      <div className="mx-auto max-w-lg">
        <Link href="/dashboard" className="dnd-link text-sm mb-6 inline-block">
          &larr; Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="dnd-heading text-2xl font-bold">{game.name}</h1>
            {game.dm_persona && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {game.dm_persona}
              </p>
            )}
          </div>
          <span className={getStatusBadgeClass(game.status)}>
            {game.status === 'pending' ? 'lobby' : game.status}
          </span>
        </div>

        <CharacterLobby
          gameId={gameId}
          gameStatus={game.status}
          initialPlayer={player}
          initialInventory={inventory}
        />
      </div>
    </div>
  )
}
