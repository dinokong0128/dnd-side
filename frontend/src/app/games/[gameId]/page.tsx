import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { fetchPlayerByProfileAndGame } from '@/lib/supabase/players'
import { CharacterLobby } from '@/components/games/CharacterLobby'

export default async function GameLobbyPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const game = await fetchGameById(gameId)

  if (!game) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold">Game not found</h1>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-amber-400 hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const player = user
    ? await fetchPlayerByProfileAndGame(user.id, gameId)
    : null

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Game Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-2 inline-block text-xs text-gray-500 hover:text-gray-300"
        >
          &larr; Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-gray-100">
          {game.name}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-gray-700 px-2 py-0.5 text-xs uppercase tracking-wide text-gray-300">
            {game.status}
          </span>
        </div>
      </div>

      {/* Character Section */}
      <CharacterLobby
        gameId={gameId}
        gameStatus={game.status}
        initialPlayer={player ? {
          id: player.id,
          character_name: player.character_name,
          character_class: player.character_class,
          hp_current: player.hp_current,
          hp_max: player.hp_max,
          stats: player.stats as Record<string, number>,
        } : null}
      />
    </div>
  )
}
