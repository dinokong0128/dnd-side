import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { getPlayer, getPlayerInventory } from '@/lib/supabase/players'
import { CharacterLobbyPanel } from '@/components/games/CharacterLobbyPanel'
import { InviteSection } from '@/components/games/InviteSection'
import { InventoryPanel } from '@/components/games/InventoryPanel'
import { GameSessionView } from '@/components/games/GameSessionView'
import { StartSessionButton } from '@/components/games/StartSessionButton'
import { DashboardHeader } from '@/components/layout/DashboardHeader'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params

  // E2E testing: bypass server-side fetching — client component handles it
  if (process.env.E2E_TESTING === 'true') {
    const { E2EGamePage } = await import('@/components/games/E2EGamePage')
    return <E2EGamePage gameId={gameId} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [game, player, inventory] = await Promise.all([
    fetchGameById(gameId),
    getPlayer(gameId, user.id),
    getPlayerInventory(gameId, user.id),
  ])

  if (!game) {
    return (
      <div className="dnd-page-bg flex min-h-screen items-center justify-center p-6 text-center">
        <h1 className="dnd-heading text-2xl font-bold">Game not found</h1>
      </div>
    )
  }

  // Show session view when game is active (or paused/ended)
  if (game.status !== 'lobby') {
    return <GameSessionView gameId={gameId} game={game} userId={user.id} />
  }

  // Show lobby view when status is 'lobby'
  return (
    <main className="dnd-page-bg min-h-screen">
      <DashboardHeader />
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-6 space-y-2">
          <h1 className="dnd-heading text-2xl font-bold">
            {game.name}
          </h1>
          <span className={`dnd-badge dnd-badge-${game.status}`}>
            {game.status}
          </span>
        </div>

        {game.created_by === user.id && game.status === 'lobby' && (
          <div className="mb-6">
            <InviteSection gameId={gameId} />
          </div>
        )}

        <div className="dnd-card p-6">
          <h2 className="dnd-heading mb-4 text-lg font-semibold">
            Your Character
          </h2>
          <CharacterLobbyPanel
            gameId={gameId}
            gameStatus={game.status as 'lobby' | 'active' | 'paused' | 'ended'}
            initialPlayer={player}
          />
        </div>

        {player?.character_name && (
          <div className="mt-4">
            <InventoryPanel items={inventory.map(i => ({
              id: i.id,
              item_name: i.item_name,
              quantity: i.quantity,
            }))} />
          </div>
        )}

        {game.created_by === user.id && game.status === 'lobby' && (
          <div className="mt-6">
            <StartSessionButton gameId={gameId} />
          </div>
        )}
      </div>
    </main>
  )
}
