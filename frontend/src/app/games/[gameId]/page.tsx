import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import {
  fetchPlayerByProfileAndGame,
  fetchInventoryByPlayer,
} from '@/lib/supabase/players'
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
        <h1
          className="text-2xl font-bold"
          style={{ color: '#e8d5a3', fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Game not found
        </h1>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm hover:opacity-80"
          style={{ color: '#b09050' }}
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    )
  }

  const player = user
    ? await fetchPlayerByProfileAndGame(user.id, gameId)
    : null

  const inventory = player
    ? await fetchInventoryByPlayer(player.id)
    : []

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at top, #141008 0%, #0a0804 60%, #050302 100%)',
      }}
    >
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Game Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="mb-3 inline-block text-[11px] uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ color: '#6a5a3a' }}
          >
            &larr; Dashboard
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ color: '#e8d5a3', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {game.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  game.status === 'active'
                    ? '#5a8a3a'
                    : game.status === 'lobby'
                      ? '#c4a040'
                      : '#4a4030',
              }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ color: '#6a5a3a' }}
            >
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
          initialInventory={inventory}
        />
      </div>
    </div>
  )
}
