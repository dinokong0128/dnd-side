import { createClient } from '@/lib/supabase/server'
import { fetchGameById } from '@/lib/supabase/games'
import { CharacterLobby } from '@/components/games/CharacterLobby'

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

  // Fetch existing player for this user in this game
  let initialPlayer = null
  let initialInventory: {
    id: string
    player_id: string
    item_name: string
    quantity: number
    properties: Record<string, unknown> | null
    created_at: string
  }[] = []

  if (user) {
    const { data: player } = await supabase
      .from('players')
      .select(
        'id, game_id, profile_id, character_name, character_class, hp_current, hp_max, stats, status, joined_at'
      )
      .eq('profile_id', user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (player) {
      initialPlayer = {
        id: player.id,
        character_name: player.character_name,
        character_class: player.character_class,
        hp_max: player.hp_max,
        stats: player.stats as Record<string, number>,
      }

      const { data: inventory } = await supabase
        .from('player_inventory')
        .select('id, player_id, item_name, quantity, properties, created_at')
        .eq('player_id', player.id)
        .order('created_at', { ascending: true })

      initialInventory = inventory ?? []
    }
  }

  return (
    <CharacterLobby
      gameId={gameId}
      gameName={game.name}
      initialPlayer={initialPlayer}
      initialInventory={initialInventory}
    />
  )
}
