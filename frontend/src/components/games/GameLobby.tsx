'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'
import type { Player, InventoryItem } from '@/lib/supabase/players'

type Props = {
  gameId: string
  gameStatus: string
}

export function GameLobby({ gameId, gameStatus }: Props) {
  const [player, setPlayer] = useState<Player | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPlayerData = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/players`)
      if (response.ok) {
        const data = await response.json()
        setPlayer(data.player)
        setInventory(data.inventory ?? [])
      }
    } catch {
      // Silently handle fetch errors on load
    } finally {
      setIsLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    fetchPlayerData()
  }, [fetchPlayerData])

  // Subscribe to inventory changes via Supabase Realtime
  useEffect(() => {
    if (!player?.id) return

    const supabase = createClient()
    const channel = supabase
      .channel(`inventory-${player.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_inventory',
          filter: `player_id=eq.${player.id}`,
        },
        () => {
          // Refetch inventory on any change
          fetchPlayerData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [player?.id, fetchPlayerData])

  function handleSave(savedPlayer: Player, savedInventory: InventoryItem[]) {
    setPlayer(savedPlayer)
    setInventory(savedInventory)
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="text-center py-12 text-[var(--dnd-parchment-dim)] italic">
        Preparing your adventure...
      </div>
    )
  }

  const showForm = !player || isEditing
  const hasCharacter = !!player?.character_name

  return (
    <div className="space-y-6" data-testid="game-lobby">
      {showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          existingPlayer={isEditing ? player : null}
          onSave={handleSave}
        />
      ) : (
        <CharacterSummaryCard
          player={player}
          gameStatus={gameStatus}
          onEdit={() => setIsEditing(true)}
        />
      )}

      <InventoryPanel
        inventory={inventory}
        hasCharacter={hasCharacter}
      />
    </div>
  )
}
