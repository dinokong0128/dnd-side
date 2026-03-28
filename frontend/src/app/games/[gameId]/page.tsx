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
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-lg border border-card-border bg-card-bg p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            Game Not Found
          </h1>
          <p className="mt-2 text-sm text-muted-text">
            This quest does not exist — or it has already ended.
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
  let inventory: Awaited<ReturnType<typeof fetchPlayerInventory>> = []

  if (user) {
    player = await fetchPlayerByGameAndProfile(gameId, user.id)
    if (player) {
      inventory = await fetchPlayerInventory(player.id)
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6 pb-16">
      <GameLobby
        gameId={game.id}
        gameName={game.name}
        dmPersona={game.dm_persona}
      />
    </div>
  )
}
