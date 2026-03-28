import { fetchGameById } from '@/lib/supabase/games'
import { createClient } from '@/lib/supabase/server'
import {
  fetchPlayerByProfileAndGame,
  fetchInventoryByPlayer,
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
    data: { session },
  } = await supabase.auth.getSession()

  let player = null
  let inventory: Awaited<ReturnType<typeof fetchInventoryByPlayer>> = []

  if (session) {
    player = await fetchPlayerByProfileAndGame(session.user.id, gameId)
    if (player) {
      inventory = await fetchInventoryByPlayer(player.id)
    }
  }

  return (
    <GameLobby
      game={game}
      initialPlayer={player}
      initialInventory={inventory}
    />
  )
}
