import Link from 'next/link'
import { fetchGameById } from '@/lib/supabase/games'
import { createClient } from '@/lib/supabase/server'
import {
  fetchPlayerByGameAndProfile,
  fetchInventoryByPlayerId,
} from '@/lib/supabase/players'
import { CharacterSection } from '@/components/games/CharacterSection'

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

  const player = user
    ? await fetchPlayerByGameAndProfile(gameId, user.id)
    : null

  const inventory = player
    ? await fetchInventoryByPlayerId(player.id)
    : []

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Atmospheric top bar */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/50">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            &larr; Dashboard
          </Link>
          <span className="rounded-full border border-zinc-700/50 bg-zinc-800/50 px-3 py-0.5 text-xs uppercase tracking-widest text-zinc-500">
            {game.status}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Game header */}
        <div className="mb-10">
          <h1
            data-testid="game-lobby-title"
            className="text-3xl font-bold tracking-tight text-amber-50"
          >
            {game.name}
          </h1>
          {game.dm_persona && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 italic">
              &ldquo;{game.dm_persona}&rdquo;
            </p>
          )}
        </div>

        {/* Character creation / summary + inventory */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <CharacterSection
            gameId={gameId}
            initialPlayer={player}
            initialInventory={inventory}
          />
        </div>
      </div>
    </div>
  )
}
