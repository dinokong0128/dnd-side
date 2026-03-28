import { fetchGameById } from '@/lib/supabase/games'
import { createClient } from '@/lib/supabase/server'
import {
  fetchPlayerByGameAndProfile,
  fetchPlayerInventory,
} from '@/lib/supabase/players'
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
  let inventory: Awaited<ReturnType<typeof fetchPlayerInventory>> = []

  if (user) {
    player = await fetchPlayerByGameAndProfile(gameId, user.id)
    if (player) {
      inventory = await fetchPlayerInventory(player.id)
    }
  }

  return (
    <GameLobby
      gameId={gameId}
      gameName={game.name}
      initialPlayer={player}
      initialInventory={inventory}
    />
  )
}
