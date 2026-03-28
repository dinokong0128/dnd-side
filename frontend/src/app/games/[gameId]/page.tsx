import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { CharacterLobby } from '@/components/games/CharacterLobby'
import Link from 'next/link'

export default async function GameLobbyPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await fetchGameById(gameId)

  if (!game) {
    return (
      <div className="dnd-page flex items-center justify-center">
        <div className="text-center">
          <h1 className="dnd-heading text-2xl">Game not found</h1>
          <Link
            href="/dashboard"
            className="text-sm mt-2 inline-block hover:underline"
            style={{ color: 'var(--dnd-text-dim)' }}
          >
            \u2190 Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Fetch current player data server-side
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let player = null
  let inventory: Array<{
    id: string
    player_id: string
    item_name: string
    quantity: number
    properties: Record<string, unknown>
  }> = []

  if (user) {
    const { data: playerRow } = await supabase
      .from('players')
      .select(
        'id, game_id, profile_id, character_name, character_class, stats, hp_max, created_at'
      )
      .eq('profile_id', user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (playerRow) {
      player = playerRow
      const { data: inventoryRows } = await supabase
        .from('player_inventory')
        .select('id, player_id, item_name, quantity, properties')
        .eq('player_id', playerRow.id)
        .order('item_name')

      inventory = inventoryRows ?? []
    }
  }

  const statusLabel =
    game.status === 'pending'
      ? 'Lobby'
      : game.status.charAt(0).toUpperCase() + game.status.slice(1)

  return (
    <div className="dnd-page">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-block mb-6 text-sm hover:underline"
          style={{ color: 'var(--dnd-text-dim)' }}
        >
          \u2190 Back to dashboard
        </Link>

        {/* Game Header */}
        <div className="dnd-card mb-6">
          <div className="flex items-center justify-between">
            <h1 className="dnd-heading text-2xl">{game.name}</h1>
            <span
              className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                fontFamily: "var(--font-cinzel), 'Cinzel', serif",
                background:
                  game.status === 'pending'
                    ? 'rgba(201, 168, 76, 0.12)'
                    : game.status === 'active'
                      ? 'rgba(61, 153, 112, 0.12)'
                      : 'rgba(154, 142, 124, 0.12)',
                color:
                  game.status === 'pending'
                    ? 'var(--dnd-gold)'
                    : game.status === 'active'
                      ? 'var(--dnd-emerald)'
                      : 'var(--dnd-text-dim)',
                border: `1px solid ${
                  game.status === 'pending'
                    ? 'rgba(201, 168, 76, 0.2)'
                    : game.status === 'active'
                      ? 'rgba(61, 153, 112, 0.2)'
                      : 'rgba(154, 142, 124, 0.2)'
                }`,
              }}
            >
              {statusLabel}
            </span>
          </div>
          {game.dm_persona && (
            <p
              className="text-sm mt-2 italic"
              style={{ color: 'var(--dnd-text-dim)' }}
            >
              {game.dm_persona}
            </p>
          )}
        </div>

        {/* Character Section */}
        <CharacterLobby
          gameId={gameId}
          gameStatus={game.status}
          initialPlayer={player}
          initialInventory={inventory}
        />
      </div>
    </div>
  )
}
