import { fetchGameById } from '@/lib/supabase/games'
import { createClient } from '@/lib/supabase/server'
import {
  getPlayerByGameAndProfile,
  getPlayerInventory,
} from '@/lib/supabase/players'
import { CharacterPanel } from '@/components/games/CharacterPanel'
import Link from 'next/link'

export default async function GameLobbyPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const [game, supabase] = await Promise.all([
    fetchGameById(gameId),
    createClient(),
  ])

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-200">Game not found</h1>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const player = user
    ? await getPlayerByGameAndProfile(gameId, user.id)
    : null

  const inventory = player ? await getPlayerInventory(player.id) : []

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Decorative top border */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />

      <div className="mx-auto max-w-xl px-4 py-10">
        {/* Game Header */}
        <header className="mb-8 text-center">
          <Link
            href="/dashboard"
            className="mb-4 inline-block text-xs tracking-widest text-stone-600 uppercase transition hover:text-stone-400"
          >
            &larr; Dashboard
          </Link>
          <h1 className="font-serif text-3xl tracking-wide text-amber-100">
            {game.name}
          </h1>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-800 bg-stone-900/60 px-3 py-1 text-xs text-stone-400">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  game.status === 'active'
                    ? 'bg-emerald-500'
                    : game.status === 'lobby'
                      ? 'bg-amber-500'
                      : 'bg-stone-600'
                }`}
              />
              {game.status}
            </span>
          </div>
          {game.dm_persona && (
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-stone-500 italic">
              &ldquo;{game.dm_persona}&rdquo;
            </p>
          )}
        </header>

        {/* Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-stone-800" />
          <span className="text-xs tracking-[0.2em] text-stone-600 uppercase">
            Your Character
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-stone-800" />
        </div>

        {/* Character Panel */}
        <CharacterPanel
          gameId={gameId}
          initialPlayer={player}
          initialInventory={inventory}
        />
      </div>
    </div>
  )
}
