import { fetchGameById } from '@/lib/supabase/games'
import { fetchPlayerByGameAndUser, fetchInventoryByPlayer } from '@/lib/supabase/players'
import { createClient } from '@/lib/supabase/server'
import { GameLobbyClient } from '@/components/games/GameLobbyClient'

export default async function GameLobbyPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await fetchGameById(gameId)

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-amber-50">Game not found</h1>
          <p className="mt-2 text-sm text-amber-100/40">
            This adventure doesn&apos;t exist or has been removed.
          </p>
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
    player = await fetchPlayerByGameAndUser(gameId, user.id)
    if (player) {
      inventory = await fetchInventoryByPlayer(player.id)
    }
  }

  return (
    <GameLobbyClient
      game={game}
      initialPlayer={player}
      initialInventory={inventory}
    />
  )
}
