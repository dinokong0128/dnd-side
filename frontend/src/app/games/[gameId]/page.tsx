import { fetchGameById } from '@/lib/supabase/games'
import { getPlayerByProfileAndGame, getInventoryByPlayerId } from '@/lib/supabase/players'
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
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold">Game not found</h1>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let player = null
  let inventory: Awaited<ReturnType<typeof getInventoryByPlayerId>> = []

  if (user) {
    player = await getPlayerByProfileAndGame(user.id, gameId)
    if (player) {
      inventory = await getInventoryByPlayerId(player.id)
    }
  }

  return (
    <GameLobbyClient
      gameId={gameId}
      gameName={game.name}
      gameStatus={game.status}
      player={player}
      inventory={inventory}
    />
  )
}
