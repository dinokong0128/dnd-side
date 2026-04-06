import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { getPlayer, getPlayerInventory } from '@/lib/supabase/players'
import { CharacterLobbyPanel } from '@/components/games/CharacterLobbyPanel'
import { InviteSection } from '@/components/games/InviteSection'
import { InventoryPanel } from '@/components/games/InventoryPanel'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params

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
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Game not found</h1>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{game.name}</h1>
          <p className="text-lg text-gray-600">
            Status:{' '}
            <span className="font-semibold capitalize">{game.status}</span>
          </p>
        </div>

        {game.created_by === user.id && game.status === 'lobby' && (
          <div className="mb-6">
            <InviteSection gameId={gameId} />
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
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
      </div>
    </main>
  )
}
