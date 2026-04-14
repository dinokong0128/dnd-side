'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/games'
import type { PlayerRow } from '@/lib/types/player'
import type { InventoryRow } from '@/lib/supabase/players'
import { GameSessionView } from './GameSessionView'
import { CharacterLobbyPanel } from './CharacterLobbyPanel'
import { InviteSection } from './InviteSection'
import { InventoryPanel } from './InventoryPanel'
import { StartSessionButton } from './StartSessionButton'

interface E2EGamePageProps {
  gameId: string
}

interface PageState {
  ready: boolean
  userId: string | null
  game: Game | null
  player: PlayerRow | null
  inventory: InventoryRow[]
}

export function E2EGamePage({ gameId }: E2EGamePageProps) {
  const [state, setState] = useState<PageState>({
    ready: false,
    userId: null,
    game: null,
    player: null,
    inventory: [],
  })

  // E2E: listen for game-started event to transition from lobby to active
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_TESTING !== 'true') return
    const handleGameStarted = () => {
      setState((prev) =>
        prev.game ? { ...prev, game: { ...prev.game, status: 'active' } } : prev
      )
    }
    window.addEventListener('e2e-game-started', handleGameStarted)
    return () => window.removeEventListener('e2e-game-started', handleGameStarted)
  }, [])

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()

      // Use a direct browser fetch to /auth/v1/user so page.route() mocks
      // can control which user is returned (e.g., for non-host tests).
      let userId = 'user-1'
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            apikey: anonKey || '',
            Authorization: `Bearer ${anonKey || ''}`,
          },
        })
        if (authRes.ok) {
          const userData = await authRes.json()
          if (userData.id) userId = userData.id as string
        }
      } catch {
        /* fallback to 'user-1' */
      }

      const { data: gamesData } = await supabase
        .from('games')
        .select('id, name, dm_persona, status, created_by, created_at, updated_at')
        .eq('id', gameId)

      // Handle both array (most E2E mocks) and single-object (inventory.spec.ts mock)
      let game: Game | null = null
      if (Array.isArray(gamesData)) {
        game = (gamesData as Game[])[0] ?? null
      } else if (gamesData && typeof gamesData === 'object') {
        game = gamesData as unknown as Game
      }

      let player: PlayerRow | null = null
      let inventory: InventoryRow[] = []

      if (game?.status === 'lobby') {
        const { data: playersData } = await supabase
          .from('players')
          .select(
            'id, game_id, profile_id, character_name, character_class, race, level, hp_current, hp_max, stats, status, joined_at'
          )
          .eq('game_id', gameId)
          .eq('profile_id', userId)

        // Handle both array and single-object mock responses
        if (Array.isArray(playersData)) {
          player = (playersData as PlayerRow[])[0] ?? null
        } else if (playersData && typeof playersData === 'object') {
          player = playersData as unknown as PlayerRow
        }

        if (player?.id) {
          const { data: invData } = await supabase
            .from('player_inventory')
            .select('id, player_id, item_name, quantity, properties, created_at')
            .eq('player_id', player.id)
            .order('item_name')

          inventory = (invData as InventoryRow[]) ?? []
        }
      }

      setState({ ready: true, userId, game, player, inventory })
    })()
  }, [gameId])

  if (!state.ready) {
    return (
      <div className="dnd-page-bg flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-solid"
          style={{
            borderColor: 'var(--dnd-gold)',
            borderRightColor: 'transparent',
          }}
        />
      </div>
    )
  }

  if (!state.game || !state.userId) {
    return (
      <div className="dnd-page-bg flex min-h-screen items-center justify-center p-6 text-center">
        <h1 className="dnd-heading text-2xl font-bold">Game not found</h1>
      </div>
    )
  }

  if (state.game.status !== 'lobby') {
    return (
      <GameSessionView gameId={gameId} game={state.game} userId={state.userId} />
    )
  }

  return (
    <main className="dnd-page-bg min-h-screen">
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-6 space-y-2">
          <h1
            className="text-3xl font-bold tracking-wide"
            style={{ fontFamily: "'Cinzel', serif", color: 'var(--dnd-parchment)' }}
          >
            {state.game.name}
          </h1>
          <p style={{ color: 'var(--dnd-parchment-dim)' }}>
            Status:{' '}
            <span className="font-semibold capitalize">{state.game.status}</span>
          </p>
        </div>

        {state.game.created_by === state.userId && (
          <div className="mb-6">
            <InviteSection gameId={gameId} />
          </div>
        )}

        <div className="dnd-card p-6">
          <h2
            className="mb-4 text-xl font-semibold tracking-wide"
            style={{ fontFamily: "'Cinzel', serif", color: 'var(--dnd-parchment)' }}
          >
            Your Character
          </h2>
          <CharacterLobbyPanel
            gameId={gameId}
            gameStatus={state.game.status as 'lobby' | 'active' | 'paused' | 'ended'}
            initialPlayer={state.player}
          />
        </div>

        {state.player?.character_name && (
          <div className="mt-4">
            <InventoryPanel
              items={state.inventory.map((i) => ({
                id: i.id,
                item_name: i.item_name,
                quantity: i.quantity,
              }))}
            />
          </div>
        )}

        {state.game.created_by === state.userId && (
          <div className="mt-6">
            <StartSessionButton gameId={gameId} />
          </div>
        )}
      </div>
    </main>
  )
}
