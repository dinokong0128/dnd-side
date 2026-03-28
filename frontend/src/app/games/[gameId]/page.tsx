import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { fetchPlayerByProfileAndGame } from '@/lib/supabase/players'
import { CharacterSection } from '@/components/games/CharacterSection'

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
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  const player = user
    ? await fetchPlayerByProfileAndGame(user.id, gameId)
    : null

  const serializedPlayer = player
    ? {
        id: player.id,
        character_name: player.character_name,
        character_class: player.character_class,
        hp_current: player.hp_current,
        hp_max: player.hp_max,
        stats: player.stats as Record<string, number>,
      }
    : null

  return (
    <div data-testid="game-lobby" className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{game.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Status:{' '}
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium uppercase">
            {game.status}
          </span>
        </p>
      </div>

      <CharacterSection
        gameId={gameId}
        initialPlayer={serializedPlayer}
        gameStatus={game.status}
      />
    </div>
  )
}
