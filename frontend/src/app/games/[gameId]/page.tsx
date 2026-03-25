import { fetchGameById } from '@/lib/supabase/games'

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

  return (
    <div data-testid="game-lobby-stub" className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">{game.name}</h1>
      <p className="mt-4 text-gray-600">Lobby — coming soon</p>
    </div>
  )
}
